export const HOLIDAY_PROGRAM_MEDICAL_PLANS = {
    anaphylaxis: {
        label: 'anaphylaxis plan',
        // Keep the existing storage namespace for compatibility with deployed upload permissions.
        storagePrefix: 'anaphylaxisPlans/holiday-program-',
    },
    asthma: {
        label: 'asthma action plan',
        storagePrefix: 'anaphylaxisPlans/holiday-program-asthma-',
    },
} as const

export type HolidayProgramMedicalPlanType = keyof typeof HOLIDAY_PROGRAM_MEDICAL_PLANS

export type HolidayProgramMedicalDetails = {
    allergies: string
    isAnaphylactic: boolean
    anaphylaxisPlan: string
    requiresAsthmaActionPlan: boolean
    asthmaActionPlan: string
}

/** Both plans travel in the existing Acuity allergies field, including legacy signed URLs. */
export function formatHolidayProgramMedicalDetails(details: HolidayProgramMedicalDetails) {
    return [
        details.allergies,
        details.isAnaphylactic && 'Anaphylactic: Yes',
        details.isAnaphylactic && details.anaphylaxisPlan && `Anaphylaxis plan: ${details.anaphylaxisPlan}`,
        details.requiresAsthmaActionPlan && 'Asthma action plan required: Yes',
        details.requiresAsthmaActionPlan &&
            details.asthmaActionPlan &&
            `Asthma action plan: ${details.asthmaActionPlan}`,
    ]
        .filter(Boolean)
        .join('\n\n')
}

export function parseHolidayProgramMedicalDetails(value: string): HolidayProgramMedicalDetails {
    const anaphylaxisPlan = value.match(/(?:^|\n)Anaphylaxis plan:\s*(\S+)/)?.[1] || ''
    const asthmaActionPlan = value.match(/(?:^|\n)Asthma action plan:\s*(\S+)/)?.[1] || ''
    return {
        allergies: value
            .replace(/(?:^|\n)(?:Anaphylaxis plan|Asthma action plan):[^\n]*/g, '')
            .replace(/(?:^|\n)(?:Anaphylactic|Asthma action plan required): Yes/g, '')
            .trim(),
        isAnaphylactic: /(?:^|\n)Anaphylactic: Yes(?:\n|$)/.test(value),
        anaphylaxisPlan,
        requiresAsthmaActionPlan: /(?:^|\n)Asthma action plan required: Yes(?:\n|$)/.test(value),
        asthmaActionPlan,
    }
}
