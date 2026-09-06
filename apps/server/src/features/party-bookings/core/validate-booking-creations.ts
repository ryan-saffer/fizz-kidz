import type { BirthdayPartyBookingCatalogue, Booking } from '@fizz-kidz/core'
import { getActiveBirthdayPartyBookingCreationKeys } from '@fizz-kidz/core'

import { SanityClient } from '@/integrations/sanity/sanity.client'

type BookingCreations = Pick<Booking, 'creation1' | 'creation2' | 'creation3' | 'type'>

function selectedCreationKeys(booking: BookingCreations) {
    return [booking.creation1, booking.creation2, booking.creation3].filter(
        (creation): creation is string => typeof creation === 'string' && creation.length > 0
    )
}

export class UnavailableBirthdayPartyCreationsError extends Error {
    constructor(
        readonly invalidKeys: string[],
        readonly bookingType: Booking['type']
    ) {
        super('Booking contains unavailable birthday party creations.')
        this.name = 'UnavailableBirthdayPartyCreationsError'
    }
}

export function getInvalidBookingCreationKeys(
    catalogue: BirthdayPartyBookingCatalogue,
    booking: BookingCreations,
    existingBooking?: BookingCreations
) {
    const activeKeys = getActiveBirthdayPartyBookingCreationKeys(catalogue, booking.type)
    const previousKeys = new Set(existingBooking?.type === booking.type ? selectedCreationKeys(existingBooking) : [])

    return selectedCreationKeys(booking).filter(
        (creationKey) => !activeKeys.has(creationKey) && !previousKeys.has(creationKey)
    )
}

export async function validateBookingCreations(booking: BookingCreations, existingBooking?: BookingCreations) {
    if (selectedCreationKeys(booking).length === 0) return

    const sanity = await SanityClient.getInstance()
    const catalogue = await sanity.getBirthdayPartyBookingCatalogue()
    const invalidKeys = getInvalidBookingCreationKeys(catalogue, booking, existingBooking)

    if (invalidKeys.length > 0) {
        throw new UnavailableBirthdayPartyCreationsError(invalidKeys, booking.type)
    }
}
