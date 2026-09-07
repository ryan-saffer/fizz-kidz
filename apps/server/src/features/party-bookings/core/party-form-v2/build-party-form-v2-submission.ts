import type { Booking, PartyForm, PartyFormV2 } from '@fizz-kidz/core'
import { ADDITIONS, BRING_OWN_CAKE, orderedQuantities } from '@fizz-kidz/core'

import { PAPERFORM_CREATION_FIELDS } from '@/features/party-bookings/core/party-form-mapper'
import { PARTY_FORM_FIELD_MAPPING, PaperformSubmission } from '@/integrations/paperforms/paperform.client'

/**
 * Converts a custom party form payload into a synthetic Paperform submission.
 *
 * This lets the entire existing pipeline (PartyFormMapper, handlePartyFormSubmission) run unchanged,
 * so the custom form and the Paperform behave identically while both are alive.
 */
export function buildPartyFormV2Submission(
    payload: PartyFormV2,
    booking: Pick<Booking, 'type' | 'location'>,
    submissionId: string
): PaperformSubmission<PartyForm> {
    const data: Record<string, unknown> = {}
    const set = <K extends keyof PartyForm>(key: K, value: PartyForm[K]) => {
        data[PARTY_FORM_FIELD_MAPPING[key]] = value
    }

    set('id', payload.bookingId)
    set('location', booking.type === 'studio' ? booking.location : 'mobile')
    set('party_or_cake_form', 'party')
    set('parent_first_name', payload.parentFirstName)
    set('parent_last_name', payload.parentLastName)
    set('child_name', payload.childName)
    set('child_age', payload.childAge)

    if (booking.type === 'mobile') {
        set('number_of_children_mobile', payload.numberOfChildren)
    } else {
        set('number_of_children_in_store', payload.numberOfChildren)
    }

    // the custom form submits stable creation keys, which resolveBirthdayPartyBookingCreation
    // matches just like it matches the Paperform labels
    for (const { mobile, packageKey, studio } of PAPERFORM_CREATION_FIELDS) {
        const selection = payload.creations.find((creation) => creation.packageKey === packageKey)
        set(booking.type === 'mobile' ? mobile : studio, selection?.creationKeys ?? [])
    }

    if (booking.type === 'studio') {
        set(
            'food_package',
            payload.foodPackage === 'include' ? 'Include the food package' : 'I will self-cater the party'
        )
    }
    set(
        'additions',
        payload.additions.map((addition) => ADDITIONS[addition].displayValueWithPrice)
    )

    if (payload.cake) {
        set('cake', payload.cake.selection)
        set('cake_size', payload.cake.size)
        set('cake_flavours', [...payload.cake.flavours])
        set('cake_served', payload.cake.served)
        set('cake_candles', payload.cake.candles)
        set('cake_message', payload.cake.message ?? '')
    } else {
        set('cake', BRING_OWN_CAKE)
    }

    set(
        'take_home_bags',
        orderedQuantities(payload.takeHomeBags).map(([SKU, quantity]) => ({ SKU, quantity }))
    )
    set(
        'products',
        orderedQuantities(payload.products).map(([SKU, quantity]) => ({ SKU, quantity }))
    )

    set('fun_facts', payload.funFacts ?? '')
    set('questions', payload.questions ?? '')

    return new PaperformSubmission<PartyForm>(
        { results: { submission: { id: submissionId, form_id: 'party-form-v2', data } } },
        PARTY_FORM_FIELD_MAPPING
    )
}
