import { DateTime } from 'luxon'

export function formatSessionTime(time: string, duration?: number) {
    const start = DateTime.fromISO(time, { setZone: true })
    const date = start.toFormat('cccc, dd LLL yyyy')
    const times = duration
        ? `${start.toFormat('h:mm a')} to ${start.plus({ minutes: duration }).toFormat('h:mm a')}`
        : start.toFormat('h:mm a')
    return `${date}, ${times}`
}
