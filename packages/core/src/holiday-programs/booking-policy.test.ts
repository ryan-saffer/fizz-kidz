import { describe, expect, it } from 'vite-plus/test'

import { getHolidayProgramChangeEligibility } from './booking-policy'

const HOUR = 60 * 60 * 1000

describe('holiday program change cutoff', () => {
    const now = Date.parse('2026-10-01T00:00:00Z')
    const inHours = (hours: number) => new Date(now + hours * HOUR).toISOString()

    it.each([
        [72, true, true],
        [48, true, true],
        [47, true, false],
        [0, false, false],
    ])('%i hours before the start', (hours, canCancel, canReschedule) => {
        expect(getHolidayProgramChangeEligibility(inHours(hours), false, now)).toEqual({ canCancel, canReschedule })
    })

    it('does not allow changes to cancelled appointments', () => {
        expect(getHolidayProgramChangeEligibility(inHours(72), true, now)).toEqual({
            canCancel: false,
            canReschedule: false,
        })
    })
})
