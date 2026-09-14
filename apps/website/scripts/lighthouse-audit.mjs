import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// Usage: node apps/website/scripts/lighthouse-audit.mjs <base-url> <output-dir> [path ...]
// With no paths, audit every URL in the site's sitemap on mobile and desktop.
const [baseUrl, outputDirectory, ...paths] = process.argv.slice(2)
if (!baseUrl || !outputDirectory) {
    throw new Error('Usage: lighthouse-audit.mjs <base-url> <output-dir> [path ...]')
}

const base = new URL(baseUrl)
const output = resolve(outputDirectory)
const throttlingMethod = process.env.LIGHTHOUSE_THROTTLING_METHOD ?? 'simulate'
if (!['simulate', 'devtools'].includes(throttlingMethod)) {
    throw new Error('LIGHTHOUSE_THROTTLING_METHOD must be simulate or devtools')
}
const chromePath = process.env.CHROME_PATH ?? join(homedir(), '.local/bin/chrome-headless')
await access(chromePath, constants.X_OK)
await mkdir(output, { recursive: true })

async function sitemapUrls(url) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Sitemap request failed: ${response.status} ${url}`)
    const xml = await response.text()
    const locations = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => new URL(match[1]))
    if (xml.includes('<sitemapindex')) {
        return (await Promise.all(locations.map((location) => sitemapUrls(new URL(location.pathname, base))))).flat()
    }
    return locations.map((location) => new URL(location.pathname, base).href)
}

const urls = [
    ...new Set(
        paths.length
            ? paths.map((path) => new URL(path, base).href)
            : await sitemapUrls(new URL('/sitemap-index.xml', base))
    ),
]
const profile = await mkdtemp(join(tmpdir(), 'fizz-lighthouse-'))
const chrome = spawn(chromePath, ['--headless', '--remote-debugging-port=0', `--user-data-dir=${profile}`], {
    stdio: ['ignore', 'ignore', 'pipe'],
})
const chromeExited = once(chrome, 'exit')
let activeAudit
const stop = () => {
    activeAudit?.kill('SIGTERM')
    chrome.kill('SIGTERM')
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)

try {
    const port = await new Promise((resolvePort, reject) => {
        let log = ''
        const timeout = setTimeout(() => reject(new Error('Chrome did not expose a debugging port')), 30_000)
        chrome.once('error', reject)
        chrome.once('exit', () => {
            clearTimeout(timeout)
            reject(new Error(`Chrome exited before the audit: ${log}`))
        })
        chrome.stderr.on('data', (data) => {
            log += data.toString()
            const match = log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)
            if (match) {
                clearTimeout(timeout)
                resolvePort(match[1])
            }
        })
    })

    for (const url of urls) {
        for (const mode of ['mobile', 'desktop']) {
            const slug = new URL(url).pathname.replace(/^\/|\/$/g, '').replaceAll('/', '__') || 'home'
            const file = join(output, `${slug}-${mode}.json`)
            activeAudit = spawn(
                'npm',
                [
                    'exec',
                    '--yes',
                    '--package=lighthouse@13.4.1',
                    '--',
                    'lighthouse',
                    url,
                    `--port=${port}`,
                    `--throttling-method=${throttlingMethod}`,
                    '--only-categories=performance,accessibility,best-practices,seo',
                    '--output=json',
                    `--output-path=${file}`,
                    '--quiet',
                    ...(mode === 'desktop' ? ['--preset=desktop'] : []),
                ],
                { stdio: 'inherit', env: { ...process.env, CHROME_PATH: chromePath } }
            )
            const [code] = await once(activeAudit, 'exit')
            if (code !== 0) throw new Error(`Lighthouse failed for ${url} ${mode}, exit ${code}`)
            const report = JSON.parse(await readFile(file, 'utf8'))
            if (report.runtimeError) throw new Error(JSON.stringify(report.runtimeError))
            console.log(
                url,
                mode,
                Object.fromEntries(
                    Object.entries(report.categories).map(([id, category]) => [id, Math.round(category.score * 100)])
                )
            )
        }
    }
} finally {
    stop()
    await chromeExited
    await rm(profile, { recursive: true, force: true })
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
}
