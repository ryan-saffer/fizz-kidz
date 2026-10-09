import type { StudioOrTest } from '@fizz-kidz/core'

export type BaseProps = {
    firstName: string
    lastName?: string
    email: string
    mobile?: string
}

export type WithBaseProps<T> = BaseProps & T

export type Service =
    | 'Birthday Party'
    | 'Holiday Program'
    | 'Preschool Program'
    | 'Birthday Party Guest'
    | 'After School Program'
    | 'Activation / Event'
    | 'Incursion'
    | 'Play Lab'
    | ''

export type ZohoChild = {
    childName: string
    childBirthdayISO: string // !! ISO date string
}

export type HolidayProgramDealRow = {
    appointmentId: number | string
    dateTimeISO: string
    studio: StudioOrTest
    childName: string
    childBirthdayISO: string
    bookingUrl?: string
    squarePaymentLink?: string
}

export type ZohoHolidayProgramStatus = 'Booked' | 'Cancelled'

export type ZohoRequestError = {
    name?: string
    status?: number
    errorBody?: {
        data?: {
            code?: string
            details?: {
                api_name?: string
            }
        }[]
    }
}
