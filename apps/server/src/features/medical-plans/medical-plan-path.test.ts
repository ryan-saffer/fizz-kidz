import { describe, expect, it } from 'vite-plus/test'

import { MEDICAL_PLAN_PREFIXES, isValidMedicalPlanPath } from './medical-plan-path'

describe('medical plan paths', () => {
    it('keeps holiday and preschool plans scoped to their programs', () => {
        const holiday = 'anaphylaxisPlans/holiday-program-plan.pdf'
        const preschool = 'anaphylaxisPlans/preschool-v2-child-plan.pdf'
        const asthma = 'anaphylaxisPlans/holiday-program-asthma-plan.pdf'
        expect(isValidMedicalPlanPath(holiday, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM)).toBe(true)
        expect(isValidMedicalPlanPath(preschool, MEDICAL_PLAN_PREFIXES.PRESCHOOL_PROGRAM_V2)).toBe(true)
        expect(isValidMedicalPlanPath(asthma, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM_ASTHMA)).toBe(true)
        expect(isValidMedicalPlanPath(holiday, MEDICAL_PLAN_PREFIXES.PRESCHOOL_PROGRAM_V2)).toBe(false)
        expect(isValidMedicalPlanPath(preschool, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM)).toBe(false)
        expect(isValidMedicalPlanPath(preschool, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM_ASTHMA)).toBe(false)
        expect(isValidMedicalPlanPath(holiday, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM_ASTHMA)).toBe(false)
    })

    it.each(['anaphylaxisPlans/holiday-program-asthma-folder/plan.pdf', 'https://example.com/plan.pdf'])(
        'rejects nested or external path %s',
        (path) => expect(isValidMedicalPlanPath(path, MEDICAL_PLAN_PREFIXES.HOLIDAY_PROGRAM_ASTHMA)).toBe(false)
    )
})
