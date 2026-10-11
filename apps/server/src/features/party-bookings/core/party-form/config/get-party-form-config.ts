import { canOrderCake, getActiveBirthdayPartyBookingPackages, getPartyCreationCount } from '@fizz-kidz/core'

import { getPartyFormAdditions } from '../options/get-party-form-additions'
import { getPartyFormCakeOptions } from '../options/get-party-form-cake-options'
import { getPartyFormTakeHomeOptions } from '../options/get-party-form-take-home-options'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { DocumentNotFoundError } from '@/integrations/firebase/document-not-found-error'
import { logError } from '@/integrations/observability/log-error'
import { SanityClient } from '@/integrations/sanity/sanity.client'

/**
 * Everything the party form needs to render: booking prefill, what was
 * already ordered, the creation packages for the booking's channel and the Square options. `cakeOptions` is null
 * where cakes can't be ordered (see `canOrderCake`) or Square is unavailable.
 */
export async function getPartyFormConfig(bookingId: string) {
    const booking = await DatabaseClient.getPartyBooking(bookingId).catch((error: unknown) => {
        // form links can outlive their booking, eg. when a party is cancelled
        if (error instanceof DocumentNotFoundError) throwTrpcError('NOT_FOUND', 'The booking could not be found')
        throw error
    })
    const sanity = await SanityClient.getInstance()
    const [catalogue, images, additions, cakeOptions, takeHomeOptions] = await Promise.all([
        sanity.getBirthdayPartyBookingCatalogue(),
        sanity.getBirthdayPartyFormImages(),
        booking.type === 'studio'
            ? getPartyFormAdditions(booking.location).catch((error: unknown) => {
                  // the form still works without additions, so don't block it on Square
                  logError('Unable to load party form additions from Square', error, { bookingId })
                  return []
              })
            : [],
        canOrderCake(booking.type, booking.location)
            ? getPartyFormCakeOptions(booking.location).catch((error: unknown) => {
                  // without designs and flavours a cake can't be ordered, but the rest of the form still works
                  logError('Unable to load party form cake options from Square', error, { bookingId })
                  return null
              })
            : null,
        getPartyFormTakeHomeOptions(booking.location).catch((error: unknown) => {
            logError('Unable to load party form take-home options from Square', error, { bookingId })
            return null
        }),
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
        cakeOptions,
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
        additions,
        takeHomeOptions,
    }
}

export type PartyFormConfig = Awaited<ReturnType<typeof getPartyFormConfig>>
