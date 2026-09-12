export const AppointmentTypes = {
    TEST_HOLIDAY_PROGRAM: 15026605,
    HOLIDAY_PROGRAM: 11036399,
    WERRIBEE_OPENING: 75381458,
    TEST_PRESCHOOL_PROGRAM: 94471769,
    PRESCHOOL_PROGRAM: 95684631,
} as const

export type AppointmentTypeValue = (typeof AppointmentTypes)[keyof typeof AppointmentTypes]
