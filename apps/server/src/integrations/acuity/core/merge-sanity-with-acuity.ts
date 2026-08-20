import type { AcuityTypes, HolidayProgramScheduleWeek } from '@fizz-kidz/core'

import { SanityClient } from '@/integrations/sanity/sanity.client'

/**
 * Given a bunch of Acuity classes, get all Sanity holiday programs and match each Acuity
 * class up based on the date and time.
 *
 * If found, it will add the classes 'title' and 'creations' on to the class.
 */
export async function mergeAcuityWithSanity(acuityPrograms: AcuityTypes.Api.Class[]) {
    const sanity = await SanityClient.getInstance()
    const scheduleWeeks = await sanity.getHolidayProgramSchedule()
    const schedulePrograms = scheduleWeeks.reduce(
        (acc, curr) => [...acc, ...curr.programs],
        [] as HolidayProgramScheduleWeek['programs']
    )
    const mergedPrograms = acuityPrograms.map((program) => {
        const scheduleProgram = schedulePrograms.find((candidate) => {
            const [acuityDate, acuityTime] = program.time.split('T')
            // they match if the date is the same, slot is morning and time is 10:00 or slot is afternoon and time is 13:30
            return (
                acuityDate === candidate.date &&
                ((candidate.slot === 'morning' && acuityTime.startsWith('10')) ||
                    (candidate.slot === 'afternoon' && acuityTime.startsWith('13')))
            )
        })
        if (scheduleProgram) {
            return {
                ...program,
                title: scheduleProgram.title,
                creations: scheduleProgram.creations,
            }
        } else {
            return program
        }
    })

    return mergedPrograms
}
