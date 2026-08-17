import { DateTime } from 'luxon'

import type { Booking, FirestoreBooking, FormBooking } from '@fizz-kidz/core'
import { isObjKey } from '@fizz-kidz/core'

import type { ExistingBookingFormFields } from './ExistingBookingForm/types'

/**
 * Strips out the error and errorText fields, leaving only the field and value
 *
 * @param {object} formValues - the form values as an object
 * @return {object} the booking ready to be written to firestore
 */
export function mapFormToBooking(formValues: ExistingBookingFormFields): Booking {
    const booking = getEmptyDomainBooking()
    Object.keys(booking).forEach((key) => {
        if (isObjKey(key, booking)) {
            booking[key] = formValues[key]?.value as never // safe given we know key is a keyof DomainBooking
        }
    })

    // trim fields
    booking.parentFirstName = booking.parentFirstName.trim()
    booking.parentLastName = booking.parentLastName.trim()
    booking.childName = booking.childName.trim()
    booking.childAge = booking.childAge.trim()

    return convertFormBookingToBooking(booking)
}

function convertFormBookingToBooking(formBooking: FormBooking): Booking {
    // combine date and time into one
    // hardcode to AEST to ensure bookings can be created/updated from anywhere in the world
    const dateTime = DateTime.fromObject(
        {
            day: formBooking.date.getDate(),
            month: formBooking.date.getMonth() + 1,
            year: formBooking.date.getFullYear(),
            hour: formBooking.time.getHours(),
            minute: formBooking.time.getMinutes(),
        },
        { zone: 'Australia/Melbourne' }
    ).toJSDate()

    // downcast to any, since we know deleting date and time is safe.
    // without the cast, the fields can't be deleted. If downcasting to BaseBooking, the fields dont exist.
    const temp = formBooking as any
    delete temp.date
    delete temp.time

    const booking = temp as Booking
    booking.dateTime = dateTime
    return booking
}

export function mapFirestoreBookingToFormValues(firestoreBooking: FirestoreBooking): ExistingBookingFormFields {
    const domainBooking = convertFirestoreBookingToFormBooking({ ...firestoreBooking }) // copy so as not to mutate original value
    const formValues = getEmptyValues()

    for (const field in formValues) {
        if (isObjKey(field, formValues)) {
            const val = domainBooking[field]
            if (val !== undefined) {
                const prop = formValues[field]
                if (prop) prop.value = val
            }
        }
    }

    formValues.date.value = domainBooking.date
    formValues.time.value = domainBooking.time

    return formValues
}

function convertFirestoreBookingToFormBooking(firestoreBooking: FirestoreBooking): FormBooking {
    const dateTime = firestoreBooking.dateTime.toDate()

    // downcast to any, since we know deleting dateTime is safe.
    // without the cast, the fields can't be deleted. If downcasting to BaseBooking, the fields dont exist.
    const booking = firestoreBooking as any
    delete booking.dateTime

    const formBooking = booking as FormBooking
    formBooking.date = dateTime
    formBooking.time = dateTime

    return formBooking
}

/** Function, not const obj, to avoid mutation. Each call returns an empty form. */
export function getEmptyValues(): ExistingBookingFormFields {
    return {
        parentFirstName: {
            value: '',
            error: false,
            errorText: 'First name cannot be empty',
        },
        parentLastName: {
            value: '',
            error: false,
            errorText: 'Last name cannot be empty',
        },
        parentEmail: {
            value: '',
            error: false,
            errorText: 'Email address cannot be empty',
        },
        parentMobile: {
            value: '',
            error: false,
            errorText: 'Mobile number cannot be empty',
        },
        childName: {
            value: '',
            error: false,
            errorText: 'Child name cannot be empty',
        },
        childAge: {
            value: '',
            error: false,
            errorText: 'Child age cannot be empty',
        },
        date: {
            value: new Date(),
            error: false,
            errorText: 'Date cannot be empty',
        },
        time: {
            value: new Date(),
            error: false,
            errorText: 'Time cannot be empty',
        },
        location: {
            value: 'balwyn',
            error: false,
            errorText: 'Location cannot be empty',
        },
        type: {
            value: 'studio',
            error: false,
            errorText: 'Party type cannot be empty',
        },
        partyLength: {
            value: '1',
            error: false,
            errorText: 'Party length cannot be empty',
        },
        address: {
            value: '',
            error: false,
            errorText: 'Address cannot be empty',
        },
        numberOfChildren: {
            value: '',
            error: false,
            errorText: '',
        },
        notes: {
            value: '',
            error: false,
            errorText: '',
        },
        creation1: {
            value: undefined,
            error: false,
            errorText: '',
        },
        creation2: {
            value: undefined,
            error: false,
            errorText: '',
        },
        creation3: {
            value: undefined,
            error: false,
            errorText: '',
        },
        menu: {
            value: undefined,
            error: false,
            errorText: '',
        },
        chickenNuggets: {
            value: false,
            error: false,
            errorText: '',
        },
        fairyBread: {
            value: false,
            error: false,
            errorText: '',
        },
        glutenFreeFairyBread: {
            value: false,
            error: false,
            errorText: '',
        },
        fruitPlatter: {
            value: false,
            error: false,
            errorText: '',
        },
        frankfurts: {
            value: false,
            error: false,
            errorText: '',
        },
        lollyBags: {
            value: false,
            error: false,
            errorText: '',
        },
        sandwichPlatter: {
            value: false,
            error: false,
            errorText: '',
        },
        vegetarianSpringRolls: {
            value: false,
            error: false,
            errorText: '',
        },
        veggiePlatter: {
            value: false,
            error: false,
            errorText: '',
        },
        vegetarianQuiche: {
            value: false,
            error: false,
            errorText: '',
        },
        watermelonPlatter: {
            value: false,
            error: false,
            errorText: '',
        },
        wedges: {
            value: false,
            error: false,
            errorText: '',
        },
        potatoGems: {
            value: false,
            error: false,
            errorText: '',
        },
        grazingPlatterMedium: {
            value: false,
            error: false,
            errorText: '',
        },
        grazingPlatterLarge: {
            value: false,
            error: false,
            errorText: '',
        },
        volcanoPartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        lipBalmPartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        dinosaurBathBombPartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        slimePartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        dinosaurFizzPartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        unicornFizzPartyPack: {
            value: false,
            error: false,
            errorText: '',
        },
        cakeFlavour: {
            value: undefined,
            error: false,
            errorText: '',
        },
        questions: {
            value: '',
            error: false,
            errorText: '',
        },
        funFacts: {
            value: '',
            error: false,
            errorText: '',
        },
        partyFormFilledIn: {
            value: false,
            error: false,
            errorText: '',
        },
        sendConfirmationEmail: {
            value: true,
            error: false,
            errorText: '',
        },
        oldPrices: {
            value: false,
            error: false,
            errorText: '',
        },
        includesFood: {
            value: true,
            error: false,
            errorText: 'Food package is required',
        },
        cake: {
            value: undefined,
            error: false,
            errorText: '',
        },
        takeHomeBags: {
            value: undefined,
            error: false,
            errorText: '',
        },
        products: {
            value: undefined,
            error: false,
            errorText: '',
        },
        useRsvpSystem: {
            value: false,
            error: false,
            errorText: '',
        },
        invitationId: {
            value: undefined,
            error: false,
            errorText: '',
        },
        invitationOwnerUid: {
            value: undefined,
            error: false,
            errorText: '',
        },
    }
}

function getEmptyDomainBooking(): FormBooking {
    return {
        parentFirstName: '',
        parentLastName: '',
        parentEmail: '',
        parentMobile: '',
        childName: '',
        childAge: '',
        location: 'balwyn',
        type: 'studio',
        date: new Date(),
        time: new Date(),
        partyLength: '1',
        address: '',
        numberOfChildren: '',
        notes: '',
        menu: undefined,
        creation1: undefined,
        creation2: undefined,
        creation3: undefined,
        cakeFlavour: undefined,
        funFacts: '',
        questions: '',
        chickenNuggets: false,
        fairyBread: false,
        glutenFreeFairyBread: false,
        fruitPlatter: false,
        frankfurts: false,
        potatoGems: false,
        veggiePlatter: false,
        vegetarianSpringRolls: false,
        vegetarianQuiche: false,
        watermelonPlatter: false,
        wedges: false,
        sandwichPlatter: false,
        lollyBags: false,
        grazingPlatterMedium: false,
        grazingPlatterLarge: false,
        volcanoPartyPack: false,
        lipBalmPartyPack: false,
        dinosaurBathBombPartyPack: false,
        slimePartyPack: false,
        dinosaurFizzPartyPack: false,
        unicornFizzPartyPack: false,
        partyFormFilledIn: false,
        sendConfirmationEmail: true,
        oldPrices: false,
        includesFood: false,
        cake: undefined,
        takeHomeBags: undefined,
        products: undefined,
        useRsvpSystem: false,
        invitationId: undefined,
        invitationOwnerUid: undefined,
    }
}
