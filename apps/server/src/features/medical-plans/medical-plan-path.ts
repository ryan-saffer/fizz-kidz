import { HOLIDAY_PROGRAM_MEDICAL_PLANS } from '@fizz-kidz/core'

export const MEDICAL_PLAN_PREFIXES = {
    HOLIDAY_PROGRAM: HOLIDAY_PROGRAM_MEDICAL_PLANS.anaphylaxis.storagePrefix,
    HOLIDAY_PROGRAM_ASTHMA: HOLIDAY_PROGRAM_MEDICAL_PLANS.asthma.storagePrefix,
    PRESCHOOL_PROGRAM_V2: 'anaphylaxisPlans/preschool-v2-child-',
} as const

/** Validates that a storage path belongs to the expected program and is not nested. */
export function isValidMedicalPlanPath(storagePath: string, allowedPrefix: string) {
    return storagePath.startsWith(allowedPrefix) && !storagePath.slice('anaphylaxisPlans/'.length).includes('/')
}
