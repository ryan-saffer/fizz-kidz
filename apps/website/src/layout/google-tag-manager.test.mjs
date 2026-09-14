import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const bootstrap = readFileSync(new URL('./google-tag-manager.js', import.meta.url), 'utf8')

function browser({ readyState = 'loading', idleSupported = true, dataLayer = [] } = {}) {
    const scripts = []
    const idleTasks = []
    const timers = []
    const loadListeners = []
    const window = {
        dataLayer,
        addEventListener(event, callback, options) {
            assert.equal(event, 'load')
            assert.equal(options.once, true)
            loadListeners.push(callback)
        },
        setTimeout(callback) {
            timers.push(callback)
        },
    }
    if (idleSupported) {
        window.requestIdleCallback = (callback, options) => {
            assert.equal(options.timeout, 2000)
            idleTasks.push(callback)
        }
    }
    const document = {
        readyState,
        createElement(tag) {
            assert.equal(tag, 'script')
            return {}
        },
        head: { appendChild: (script) => scripts.push(script) },
    }

    return {
        window,
        scripts,
        idleTasks,
        timers,
        run: () => runInNewContext(bootstrap, { window, document }),
        finishLoading() {
            document.readyState = 'complete'
            loadListeners.splice(0).forEach((callback) => callback())
        },
    }
}

test('preserves queued events and waits for load followed by idle before requesting GTM', () => {
    const existingEvent = { event: 'consent_initialized' }
    const dataLayer = [existingEvent]
    const page = browser({ dataLayer })
    page.run()

    assert.equal(page.window.dataLayer, dataLayer)
    assert.equal(dataLayer[0], existingEvent)
    assert.equal(dataLayer[1].event, 'gtm.js')
    assert.equal(typeof dataLayer[1]['gtm.start'], 'number')
    const lead = { event: 'lead_submit', studio: 'Malvern' }
    page.window.dataLayer.push(lead)
    assert.equal(page.scripts.length, 0)
    assert.equal(page.idleTasks.length, 0)

    page.finishLoading()
    assert.equal(page.scripts.length, 0)
    assert.equal(page.idleTasks.length, 1)
    page.idleTasks[0]()

    assert.equal(page.scripts.length, 1)
    assert.equal(page.scripts[0].async, true)
    assert.equal(page.scripts[0].src, 'https://www.googletagmanager.com/gtm.js?id=GTM-NBCZ5XHQ')
    assert.equal(dataLayer[2], lead)
})

test('Astro navigation does not duplicate pending or loaded containers or reset the queue', () => {
    const page = browser()
    page.run()
    const queue = page.window.dataLayer
    page.run()
    page.finishLoading()
    page.run()
    assert.equal(page.idleTasks.length, 1)
    page.idleTasks[0]()
    page.run()

    assert.equal(page.window.dataLayer, queue)
    assert.equal(queue.filter((entry) => entry.event === 'gtm.js').length, 1)
    assert.equal(page.scripts.length, 1)
})

test('a bootstrap mounted after load schedules immediately without waiting for another load event', () => {
    const page = browser({ readyState: 'complete' })
    page.run()
    assert.equal(page.scripts.length, 0)
    assert.equal(page.idleTasks.length, 1)
    page.idleTasks[0]()
    assert.equal(page.scripts.length, 1)
})

test('browsers without requestIdleCallback use a deferred timer after load', () => {
    const page = browser({ idleSupported: false })
    page.run()
    assert.equal(page.timers.length, 0)
    page.finishLoading()
    assert.equal(page.scripts.length, 0)
    assert.equal(page.timers.length, 1)
    page.timers[0]()
    assert.equal(page.scripts.length, 1)
})
