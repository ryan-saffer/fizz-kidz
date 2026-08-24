export interface Appointment {
    id: number
    email: string
    firstName: string
    lastName: string
    phone: string
    appointmentTypeID: number
    classID: number
    type: string
    price: string
    labels?: Label[]
    forms: Form[]
    notes: string
    calendarID: number
    calendar: string
    paid: 'yes' | 'no'
    location: string
    datetime: string
    /** ISO timestamp returned by Acuity for when the appointment was originally booked. */
    datetimeCreated?: string
    /** Legacy formatted booking date returned by some Acuity appointment responses. */
    dateCreated?: string
    canceled?: boolean
    confirmationPage: string
    certificate: string
    duration: string
}

export interface MergedAppointment extends Appointment {
    checkoutPerson: string
    checkoutTime: string
}

export interface Label {
    id: number
    name: string
}

export interface AppointmentType {
    id: number
    name: string
    description: string
    category: string
    calendarIDs: number[]
    price: string
    color: string
    image: string
}

export interface Form {
    id: number
    name: string
    values: Array<FormValue>
}

export interface FormValue {
    id: number
    fieldID: number
    value: string
    name: string
}

export interface Error {
    status_code: number
    message: string
    error: string
}

export interface Payment {
    transactionID: string
}

export type Class = {
    title: string
    id: number
    calendarID: number
    calendar: string
    slotsAvailable: number
    time: string
    appointmentTypeID: number
    name: string
    description: string
    price: string
    duration: number
}

export type Calendar = {
    id: number
    name: string
    location: string
    description: string
}
