import { revalidateLogic, useForm } from '@tanstack/react-form'
import { DateTime } from 'luxon'

import { ADDITIONS, ObjectKeys, STUDIOS, combineStrings } from '@fizz-kidz/core'
import type { Addition, Booking, FirestoreBooking, Studio, WithId } from '@fizz-kidz/core'

import { getPartyBookingSchema } from './party-booking-schema'

const ZONE = 'Australia/Melbourne'

export type PartyBookingFormMode = 'create' | 'edit'

export type ChildValues = { name: string; birthday: string; age: string }

/**
 * Every answer for both modes. Creating a booking collects each birthday child; editing keeps the booking's
 * combined child name and age, plus the party details the parent fills in later.
 */
export type PartyBookingFormValues = {
    parentFirstName: string
    parentLastName: string
    parentEmail: string
    parentMobile: string
    zohoDealId: string
    children: ChildValues[]
    childName: string
    childAge: string
    /** `yyyy-MM-dd` in Melbourne */
    date: string
    /** `HH:mm` in Melbourne */
    time: string
    type: Booking['type'] | ''
    location: Studio | ''
    partyLength: Booking['partyLength'] | ''
    address: string
    foodPackage: 'include' | 'self-cater' | ''
    numberOfChildren: string
    notes: string
    /** Up to three creation keys; `''` is no creation. */
    creations: [string, string, string]
    additions: Addition[]
    questions: string
    funFacts: string
    sendConfirmationEmail: boolean
}

export type PartyBookingPrefill = Partial<
    Pick<
        PartyBookingFormValues,
        'parentFirstName' | 'parentLastName' | 'parentEmail' | 'parentMobile' | 'type' | 'location' | 'zohoDealId'
    >
>

export function useCreatePartyBookingForm({
    mode,
    defaultValues,
    onSubmit,
}: {
    mode: PartyBookingFormMode
    defaultValues: PartyBookingFormValues
    onSubmit: (values: PartyBookingFormValues) => Promise<void>
}) {
    return useForm({
        defaultValues,
        // check everything on save, then keep checking as fields change
        validationLogic: revalidateLogic(),
        validators: { onDynamic: getPartyBookingSchema(mode) },
        onSubmit: ({ value }) => onSubmit(value),
    })
}

export type PartyBookingFormApi = ReturnType<typeof useCreatePartyBookingForm>

export const emptyChild = (): ChildValues => ({ name: '', birthday: '', age: '' })

export function getNewBookingValues(prefill: PartyBookingPrefill = {}): PartyBookingFormValues {
    return {
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentMobile: '',
        zohoDealId: '',
        children: [emptyChild()],
        childName: '',
        childAge: '',
        date: '',
        time: '',
        type: '',
        location: '',
        partyLength: '',
        address: '',
        foodPackage: '',
        numberOfChildren: '',
        notes: '',
        creations: ['', '', ''],
        additions: [],
        questions: '',
        funFacts: '',
        sendConfirmationEmail: true,
        ...prefill,
    }
}

export function getExistingBookingValues(booking: FirestoreBooking): PartyBookingFormValues {
    const start = DateTime.fromJSDate(booking.dateTime.toDate(), { zone: ZONE })
    return {
        ...getNewBookingValues(),
        parentFirstName: booking.parentFirstName,
        parentLastName: booking.parentLastName,
        parentEmail: booking.parentEmail,
        parentMobile: booking.parentMobile,
        zohoDealId: booking.zohoDealId ?? '',
        children: [],
        childName: booking.childName,
        childAge: booking.childAge,
        date: start.toISODate() ?? '',
        time: start.toFormat('HH:mm'),
        type: booking.type,
        location: booking.location,
        partyLength: booking.partyLength,
        address: booking.address ?? '',
        foodPackage: booking.includesFood ? 'include' : 'self-cater',
        numberOfChildren: booking.numberOfChildren ?? '',
        notes: booking.notes ?? '',
        creations: [booking.creation1 ?? '', booking.creation2 ?? '', booking.creation3 ?? ''],
        additions: ObjectKeys(ADDITIONS).filter((addition) => booking[addition]),
        questions: booking.questions ?? '',
        funFacts: booking.funFacts ?? '',
        sendConfirmationEmail: booking.sendConfirmationEmail,
    }
}

/** The new booking the server creates. Food and creations are added later by the parent's party form. */
export function toNewBooking(values: PartyBookingFormValues): Booking {
    const children = values.children.map((child) => ({
        name: child.name.trim(),
        age: child.age.trim(),
        birthday: child.birthday,
    }))
    const isStudio = values.type === 'studio'

    return {
        ...getAdditionFlags([]),
        parentFirstName: values.parentFirstName.trim(),
        parentLastName: values.parentLastName.trim(),
        parentEmail: values.parentEmail.trim(),
        parentMobile: values.parentMobile.trim(),
        zohoDealId: values.zohoDealId.trim(),
        children,
        // the booking's child name and age are derived from its children
        childName: combineStrings(children.map((child) => child.name)),
        childAge: combineStrings(children.map((child) => child.age)),
        dateTime: toDateTime(values.date, values.time),
        location: values.location as Studio,
        type: values.type as Booking['type'],
        partyLength: values.partyLength as Booking['partyLength'],
        address: isStudio ? '' : values.address.trim(),
        includesFood: isStudio && values.foodPackage === 'include',
        numberOfChildren: '',
        notes: values.notes.trim(),
        creation1: undefined,
        creation2: undefined,
        creation3: undefined,
        menu: undefined,
        cakeFlavour: undefined,
        questions: '',
        funFacts: '',
        partyFormFilledIn: false,
        sendConfirmationEmail: values.sendConfirmationEmail,
        oldPrices: false,
        useRsvpSystem: true,
        invitationId: undefined,
        invitationOwnerUid: undefined,
    }
}

/**
 * The whole booking the server saves, with the edited answers over the existing booking so fields the form doesn't
 * show (event id, cake, invitation...) are kept. Type and location can't change once booked.
 */
export function toUpdatedBooking(values: PartyBookingFormValues, existing: WithId<FirestoreBooking>): Booking {
    const booking: Booking & { id?: string } = {
        ...existing,
        ...getAdditionFlags(values.additions),
        parentFirstName: values.parentFirstName.trim(),
        parentLastName: values.parentLastName.trim(),
        parentEmail: values.parentEmail.trim(),
        parentMobile: values.parentMobile.trim(),
        childName: values.childName.trim(),
        childAge: values.childAge.trim(),
        dateTime: toDateTime(values.date, values.time),
        partyLength: values.partyLength as Booking['partyLength'],
        address: existing.type === 'mobile' ? values.address.trim() : '',
        includesFood: existing.type === 'studio' && values.foodPackage === 'include',
        numberOfChildren: values.numberOfChildren.trim(),
        notes: values.notes.trim(),
        // '' clears a creation; the booking is updated field by field so undefined would keep the old one
        creation1: values.creations[0],
        creation2: values.creations[1],
        creation3: values.creations[2],
        questions: values.questions.trim(),
        funFacts: values.funFacts.trim(),
    }
    // the id is the document's key, not a field on it
    delete booking.id
    return booking
}

function getAdditionFlags(selected: Addition[]) {
    return Object.fromEntries(
        ObjectKeys(ADDITIONS).map((addition) => [addition, selected.includes(addition)])
    ) as Record<Addition, boolean>
}

/** The party start, read as Melbourne time wherever the booking is made. */
export function toDateTime(date: string, time: string) {
    return DateTime.fromISO(`${date}T${time}`, { zone: ZONE }).toJSDate()
}

/** The age a child turns at their next birthday, or `''` for a birthday in the future. */
export function getAgeTurning(birthday: string, today = DateTime.now().setZone(ZONE)) {
    const born = DateTime.fromISO(birthday, { zone: ZONE }).startOf('day')
    const now = today.startOf('day')
    if (!born.isValid || born > now) return ''
    const age = Math.floor(now.diff(born, 'years').years)
    return `${age + 1}`
}

/** Prefilled answers from a CRM link, e.g. `?parentName=Jane%20Smith&type=at-home&location=balwyn`. */
export function getPartyBookingPrefill(params: URLSearchParams): PartyBookingPrefill | null {
    const [parentFirstName, ...lastNames] = params.get('parentName')?.trim().split(/\s+/) ?? []
    const location = params.get('location')?.trim().toLowerCase()
    const prefill: PartyBookingPrefill = {
        parentFirstName,
        parentLastName: lastNames.join(' '),
        parentEmail: params.get('parentEmail')?.trim(),
        parentMobile: params.get('parentMobile')?.trim(),
        type: toBookingType(params.get('type')),
        location: STUDIOS.find((studio) => studio === location),
        zohoDealId: params.get('zohoDealId')?.trim(),
    }
    const entries = Object.entries(prefill).filter(([, value]) => value)
    return entries.length > 0 ? (Object.fromEntries(entries) as PartyBookingPrefill) : null
}

function toBookingType(type: string | null): Booking['type'] | undefined {
    switch (type?.trim().toLowerCase()) {
        case 'studio':
        case 'fizz kidz studio':
            return 'studio'
        case 'mobile':
        case 'at home':
        case 'at-home':
            return 'mobile'
        default:
            return undefined
    }
}
