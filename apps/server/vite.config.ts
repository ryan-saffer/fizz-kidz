import path from 'node:path'

import { sentryRollupPlugin } from '@sentry/rollup-plugin'
import dotenv from 'dotenv'
import { defineConfig } from 'vite-plus'

function isProdProject() {
    try {
        if (process.env.FIREBASE_CONFIG) {
            const config = JSON.parse(process.env.FIREBASE_CONFIG)
            if (config?.projectId === 'bookings-prod') {
                return true
            }
        }
    } catch {
        // Ignore malformed local Firebase configuration and use the dev environment.
    }

    return process.env.GCLOUD_PROJECT === 'bookings-prod'
}

const serverDir = process.cwd()
dotenv.config({ path: path.join(serverDir, isProdProject() ? '.env.prod' : '.env') })

const isWatch = process.argv.includes('--watch')
const outDir = 'dist'

export default defineConfig({
    pack: {
        entry: 'src/index.ts',
        outDir,
        format: 'cjs',
        fixedExtension: false,
        platform: 'node',
        target: 'node22',
        sourcemap: true,
        clean: !isWatch,
        alias: {
            '@': path.join(serverDir, 'src'),
            '@fizz-kidz/core': path.join(serverDir, '../../packages/core/src'),
        },
        deps: {
            neverBundle: true,
            alwaysBundle: ['@fizz-kidz/core'],
            onlyBundle: false,
        },
        copy: [
            { from: 'src/**/*.html', to: outDir, flatten: false },
            { from: 'src/**/*.mjml', to: outDir, flatten: false },
            { from: 'src/**/*.png', to: outDir, flatten: false },
            { from: 'src/**/*.ttf', to: outDir, flatten: false },
        ],
        checks: { legacyCjs: false },
        plugins:
            isWatch || process.env.FUNCTIONS_EMULATOR === 'true' || !process.env.SENTRY_AUTH_TOKEN
                ? []
                : [
                      sentryRollupPlugin({
                          authToken: process.env.SENTRY_AUTH_TOKEN,
                          org: 'fizz-kidz',
                          project: 'server',
                      }),
                  ],
    },
})
