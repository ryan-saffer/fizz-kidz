import { getPartyCreationCount, ObjectKeys, PRODUCTS, TAKE_HOME_BAGS } from '@fizz-kidz/core'

import { DatabaseClient } from '@/integrations/firebase/database.client'

export const PARTY_FORM_ID = '4c6karmx'

export type PartyOrCakeForm = 'party' | 'cake'

/**
 * Builds the data needed for the paperform embed to work on the client, ie formId and prefill data.
 */
export async function getPartyFormEmbedConfig(bookingId: string, partyOrCakeForm: PartyOrCakeForm) {
    const booking = await DatabaseClient.getPartyBooking(bookingId)

    const cake = booking.cake
        ? [
              booking.cake.selection,
              `Size: ${booking.cake.size}`,
              `Flavours: ${booking.cake.flavours.join(', ')}`,
              `How to serve: ${booking.cake.served}`,
              `Candles: ${booking.cake.candles}`,
              `Message: ${booking.cake.message || 'No message'}`,
          ].join('\n')
        : ''

    const takeHomeBags = ObjectKeys(booking.takeHomeBags || {})
        .map((key) => {
            const amount = booking.takeHomeBags?.[key]
            if (amount) return `${amount} ${TAKE_HOME_BAGS[key].displayValue}`
        })
        .filter((value): value is string => Boolean(value))
        .join('\n')

    const products = ObjectKeys(booking.products || {})
        .map((key) => {
            const amount = booking.products?.[key]
            if (amount) return `${amount} ${PRODUCTS[key].displayValue}s`
        })
        .filter((value): value is string => Boolean(value))
        .join('\n')

    const prefill = new URLSearchParams({
        location: booking.type === 'studio' ? booking.location : 'mobile',
        id: bookingId,
        party_or_cake_form: partyOrCakeForm,
        parent_first_name: booking.parentFirstName,
        parent_last_name: booking.parentLastName,
        child_name: booking.childName,
        child_age: String(booking.childAge),
        food_package: booking.includesFood ? 'Include the food package' : 'I will self-cater the party',
        creations_required: `${getPartyCreationCount(booking)}`,
        cake_purchased: cake,
        take_home_bags_purchased: [takeHomeBags, products].filter(Boolean).join('\n'),
    }).toString()

    return {
        paperformId: PARTY_FORM_ID,
        prefill,
    }
}
