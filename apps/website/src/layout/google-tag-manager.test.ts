import { runInNewContext } from 'node:vm'

import { describe, expect, it } from 'vite-plus/test'

import bootstrap from './google-tag-manager.js?raw'

type Callback = () => void
type FakeScript = { async?: boolean; src?: string }

function browser({ readyState = 'loading', idleSupported = true, dataLayer = [] as unknown[] } = {}) {
    const scripts: FakeScript[] = []
    const idleTasks: Callback[] = []
    const idleTimeouts: (number | undefined)[] = []
    const timers: Callback[] = []
    const loadListeners: Callback[] = []
    const window: Record<string, unknown> = {
        dataLayer,
        addEventListener(event: string, callback: Callback, options: { once?: boolean }) {
            expect(event).toBe('load')
            expect(options.once).toBe(true)
            loadListeners.push(callback)
        },
        setTimeout(callback: Callback) {
            timers.push(callback)
        },
    }
    if (idleSupported) {
        window.requestIdleCallback = (callback: Callback, options: { timeout?: number }) => {
            idleTimeouts.push(options.timeout)
            idleTasks.push(callback)
        }
    }
    const document = {
        readyState,
        createElement(tag: string) {
            expect(tag).toBe('script')
            return {}
        },
        head: { appendChild: (script: FakeScript) => scripts.push(script) },
    }

    return {
        window,
        scripts,
        idleTasks,
        idleTimeouts,
        timers,
        run: () => runInNewContext(bootstrap, { window, document }),
        finishLoading() {
            document.readyState = 'complete'
            loadListeners.splice(0).forEach((callback) => callback())
        },
    }
}

describe('Google Tag Manager bootstrap', () => {
    it('preserves queued events and waits for load followed by idle before requesting GTM', () => {
        const existingEvent = { event: 'consent_initialized' }
        const dataLayer: Record<string, unknown>[] = [existingEvent]
        const page = browser({ dataLayer })
        page.run()

        expect(page.window.dataLayer).toBe(dataLayer)
        expect(dataLayer[0]).toBe(existingEvent)
        expect(dataLayer[1].event).toBe('gtm.js')
        expect(typeof dataLayer[1]['gtm.start']).toBe('number')

        const lead = { event: 'lead_submit', studio: 'Malvern' }
        dataLayer.push(lead)
        expect(page.scripts).toHaveLength(0)
        expect(page.idleTasks).toHaveLength(0)

        page.finishLoading()
        expect(page.scripts).toHaveLength(0)
        expect(page.idleTasks).toHaveLength(1)
        expect(page.idleTimeouts).toEqual([2000])

        page.idleTasks[0]()
        expect(page.scripts).toEqual([{ async: true, src: 'https://www.googletagmanager.com/gtm.js?id=GTM-NBCZ5XHQ' }])
        expect(dataLayer[2]).toBe(lead)
    })

    it('Astro navigation does not duplicate pending or loaded containers or reset the queue', () => {
        const page = browser()
        page.run()
        const queue = page.window.dataLayer as { event?: string }[]
        page.run()
        page.finishLoading()
        page.run()

        expect(page.idleTasks).toHaveLength(1)
        page.idleTasks[0]()
        page.run()

        expect(page.window.dataLayer).toBe(queue)
        expect(queue.filter((entry) => entry.event === 'gtm.js')).toHaveLength(1)
        expect(page.scripts).toHaveLength(1)
    })

    it('a bootstrap mounted after load schedules immediately without waiting for another load event', () => {
        const page = browser({ readyState: 'complete' })
        page.run()

        expect(page.scripts).toHaveLength(0)
        expect(page.idleTasks).toHaveLength(1)
        page.idleTasks[0]()
        expect(page.scripts).toHaveLength(1)
    })

    it('browsers without requestIdleCallback use a deferred timer after load', () => {
        const page = browser({ idleSupported: false })
        page.run()

        expect(page.timers).toHaveLength(0)
        page.finishLoading()
        expect(page.scripts).toHaveLength(0)
        expect(page.timers).toHaveLength(1)
        page.timers[0]()
        expect(page.scripts).toHaveLength(1)
    })
})
