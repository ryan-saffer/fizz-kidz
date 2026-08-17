import { DateTime } from 'luxon'

const DAYS_OF_THE_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
type DayOfTheWeek = (typeof DAYS_OF_THE_WEEK)[number]

/** Returns the next occurrence of a weekday at midnight in Melbourne. */
export function getUpcoming(day: DayOfTheWeek) {
    const today = DateTime.fromJSDate(new Date(), { zone: 'Australia/Melbourne' }).startOf('day')
    const currentDayIndex = today.weekday % 7
    const targetDayIndex = DAYS_OF_THE_WEEK.indexOf(day)

    let daysUntilNext = targetDayIndex - currentDayIndex
    if (daysUntilNext <= 0) {
        daysUntilNext += 7
    }

    return today.plus({ days: daysUntilNext }).toJSDate()
}
