// This bootstrap stays inline so form events can queue before any other scripts run.
;(() => {
    if (window.fizzGtmScheduled) return
    window.fizzGtmScheduled = true

    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })

    const load = () => {
        const script = document.createElement('script')
        script.async = true
        script.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-NBCZ5XHQ'
        document.head.appendChild(script)
    }

    const schedule = () => {
        if (window.requestIdleCallback) {
            window.requestIdleCallback(load, { timeout: 2000 })
        } else {
            window.setTimeout(load, 0)
        }
    }

    // Wait for eager assets, including the hero, before competing for bandwidth.
    // The window guard also covers Astro navigation while this callback is pending.
    if (document.readyState === 'complete') {
        schedule()
    } else {
        window.addEventListener('load', schedule, { once: true })
    }
})()
