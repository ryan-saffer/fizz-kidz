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
    const previousKeyCounts = new Map<string, number>()
    if (existingBooking?.type === booking.type) {
        for (const creationKey of selectedCreationKeys(existingBooking)) {
            previousKeyCounts.set(creationKey, (previousKeyCounts.get(creationKey) ?? 0) + 1)
        }
    }

    return selectedCreationKeys(booking).filter((creationKey) => {
        if (activeKeys.has(creationKey)) return false

        const previousCount = previousKeyCounts.get(creationKey) ?? 0
        if (previousCount === 0) return true
        previousKeyCounts.set(creationKey, previousCount - 1)
        return false
    })
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
