import { DateTime } from 'luxon'

export type TimeOfWeekProperties = {
    /** 0 to 23, in Melbourne time. */
    hourOfDay: number
    dayOfWeek: string
    /** Business hours are 9am to 5pm, Monday to Friday, in Melbourne time. Public holidays aren't accounted for. */
    timeOfWeek: 'business hours' | 'out of hours'
}

/**
 * When something happened, in Melbourne time, so reports can break it down by time of day and business hours.
 * Mixpanel can't do this itself, and an event's own time isn't always when it happened (e.g. a chat is reported once
 * it has gone idle).
 */
export function getTimeOfWeekProperties(date: Date): TimeOfWeekProperties {
    const melbourne = DateTime.fromJSDate(date).setZone('Australia/Melbourne')
    const isWeekday = melbourne.weekday <= 5
    return {
        hourOfDay: melbourne.hour,
        dayOfWeek: melbourne.weekdayLong,
        timeOfWeek: isWeekday && melbourne.hour >= 9 && melbourne.hour < 17 ? 'business hours' : 'out of hours',
    }
}
