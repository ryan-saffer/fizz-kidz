import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { HolidayProgramScheduleWeek } from '@fizz-kidz/core'

import { HolidayProgramSchedule } from './holiday-program-schedule'

describe('HolidayProgramSchedule', () => {
    it('renders schedule cards from ISO date content', () => {
        const weeks: HolidayProgramScheduleWeek[] = [
            {
                _id: 'week-1',
                order: 1,
                title: 'Week 1',
                programs: [
                    {
                        _key: 'morning',
                        colour: '#21C1EE',
                        creations: ['Galaxy Slime', 'Bubbling Volcanoes', 'Rocket Launcher'],
                        date: '2026-09-21',
                        image: { alt: 'Explosive Energy creations', url: 'https://example.com/program.jpg' },
                        slot: 'morning',
                        title: 'Explosive Energy',
                    },
                ],
            },
        ]

        const html = renderToStaticMarkup(
            <HolidayProgramSchedule bookingUrl="https://example.com/book" weeks={weeks} />
        )

        expect(html).toContain('Week 1')
        expect(html).toContain('21st September')
        expect(html).toContain('Mon 21st')
        expect(html).toContain('Monday 21st Sep')
        expect(html).toContain('Morning Session')
        expect(html).toContain('Galaxy Slime')
        expect(html).toContain('src="https://example.com/program.jpg"')
    })

    it('ignores incomplete sessions while they are being edited', () => {
        const weeks: HolidayProgramScheduleWeek[] = [
            {
                _id: 'week-1',
                order: 1,
                title: 'Week 1',
                programs: [{ _key: 'new-session' } as HolidayProgramScheduleWeek['programs'][number]],
            },
        ]

        expect(() =>
            renderToStaticMarkup(<HolidayProgramSchedule bookingUrl="https://example.com/book" weeks={weeks} />)
        ).not.toThrow()
    })
})
