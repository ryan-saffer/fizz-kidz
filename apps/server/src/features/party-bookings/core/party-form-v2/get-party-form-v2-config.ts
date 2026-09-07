import { canOrderCake, getActiveBirthdayPartyBookingPackages, getPartyCreationCount } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'
import { SanityClient } from '@/integrations/sanity/sanity.client'

/**
 * Everything the custom party form needs to render: booking prefill (mirroring the Paperform
 * prefill params) and the creation packages for the booking's channel.
 */
export async function getPartyFormV2Config(bookingId: string) {
    const booking = await DatabaseClient.getPartyBooking(bookingId)
    const sanity = await SanityClient.getInstance()
    const [catalogue, images] = await Promise.all([
        sanity.getBirthdayPartyBookingCatalogue(),
        sanity.getBirthdayPartyFormImages(),
    ])

    const packages = getActiveBirthdayPartyBookingPackages(catalogue, booking.type)
        .filter((partyPackage) => partyPackage.creations.length > 0)
        .map((partyPackage) => ({
            key: partyPackage.key,
            name: partyPackage.name,
            creations: partyPackage.creations.map((creation) => ({
                key: creation.key,
                name: creation.name,
                image:
                    images
                        .find((item) => item.key === partyPackage.key)
                        ?.creations.find((item) => item.key === creation.key)?.image ?? null,
            })),
        }))

    return {
        bookingId,
        type: booking.type,
        studio: booking.type === 'studio' ? booking.location : null,
        canOrderCake: canOrderCake(booking.type, booking.location),
        creationsRequired: getPartyCreationCount(booking),
        prefill: {
            parentFirstName: booking.parentFirstName,
            parentLastName: booking.parentLastName,
            childName: booking.childName,
            childAge: String(booking.childAge),
            includesFood: booking.includesFood,
        },
        alreadyPurchased: {
            cake: booking.cake ?? null,
            takeHomeBags: booking.takeHomeBags ?? {},
            products: booking.products ?? {},
        },
        packages,
    }
}

export type PartyFormV2Config = Awaited<ReturnType<typeof getPartyFormV2Config>>
