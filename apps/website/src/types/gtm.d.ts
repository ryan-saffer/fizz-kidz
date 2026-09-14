export {}

declare global {
    interface Window {
        dataLayer: Record<string, unknown>[]
        fizzGtmScheduled?: boolean
    }
}
