import { describe, expect, it } from 'vite-plus/test'

import { getTimeOfWeekProperties } from '../time-of-week-properties'

describe('getTimeOfWeekProperties', () => {
    it.each([
        // Melbourne is on daylight saving time (UTC+11) in October.
        ['2026-10-07T09:00:00+11:00', 9, 'Wednesday', 'business hours'],
        ['2026-10-07T16:59:00+11:00', 16, 'Wednesday', 'business hours'],
        ['2026-10-07T17:00:00+11:00', 17, 'Wednesday', 'out of hours'],
        ['2026-10-07T08:59:00+11:00', 8, 'Wednesday', 'out of hours'],
        ['2026-10-10T11:00:00+11:00', 11, 'Saturday', 'out of hours'],
        // Standard time (UTC+10) in June: 23:30 UTC on Sunday is 9:30am Monday in Melbourne.
        ['2026-06-07T23:30:00Z', 9, 'Monday', 'business hours'],
    ])('places %s in Melbourne time', (iso, hourOfDay, dayOfWeek, timeOfWeek) => {
        expect(getTimeOfWeekProperties(new Date(iso))).toEqual({ hourOfDay, dayOfWeek, timeOfWeek })
    })
})
