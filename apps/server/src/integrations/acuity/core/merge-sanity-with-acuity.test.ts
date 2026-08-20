import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AcuityTypes, HolidayProgramScheduleWeek } from '@fizz-kidz/core'

const getHolidayProgramSchedule = vi.fn()

vi.mock('@/integrations/sanity/sanity.client', () => ({
    SanityClient: {
        getInstance: async () => ({ getHolidayProgramSchedule }),
    },
}))

import { mergeAcuityWithSanity } from './merge-sanity-with-acuity'

describe('mergeAcuityWithSanity', () => {
    beforeEach(() => getHolidayProgramSchedule.mockReset())

    it('matches classes to schedule sessions by ISO date and time slot', async () => {
        const schedule: HolidayProgramScheduleWeek[] = [
            {
                _id: 'week-1',
                order: 0,
                title: 'Week 1',
                programs: [
                    {
                        _key: 'morning',
                        colour: '#21C1EE',
                        creations: ['One', 'Two', 'Three'],
                        date: '2026-09-21',
                        image: { alt: 'Program' },
                        slot: 'morning',
                        title: 'Explosive Energy',
                    },
                ],
            },
        ]
        getHolidayProgramSchedule.mockResolvedValue(schedule)
        const classes = [
            { id: 1, time: '2026-09-21T10:00:00+10:00' },
            { id: 2, time: '2026-09-21T13:30:00+10:00' },
        ] as unknown as AcuityTypes.Api.Class[]

        const result = await mergeAcuityWithSanity(classes)

        expect(result[0]).toMatchObject({ title: 'Explosive Energy', creations: ['One', 'Two', 'Three'] })
        expect(result[1]).toEqual(classes[1])
    })
})
