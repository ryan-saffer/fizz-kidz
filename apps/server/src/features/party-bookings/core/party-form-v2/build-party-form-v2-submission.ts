import type { Booking, PartyForm, PartyFormV2, PartyFormV2PartyAnswers } from '@fizz-kidz/core'
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
    booking: Pick<
        Booking,
        'type' | 'location' | 'parentFirstName' | 'parentLastName' | 'childName' | 'childAge' | 'includesFood'
    >,
    submissionId: string
): PaperformSubmission<PartyForm> {
    const data: Record<string, unknown> = {}
    const set: SetField = (key, value) => {
        data[PARTY_FORM_FIELD_MAPPING[key]] = value
    }

    set('id', payload.bookingId)
    set('location', booking.type === 'studio' ? booking.location : 'mobile')
    // 'cake' is the Paperform's cake form: the pipeline won't mark the party form filled in, and sends the cake
    // form confirmation instead of the party form one
    set('party_or_cake_form', payload.mode)
    if (payload.mode === 'party') setPartyAnswers(set, payload, booking)
    else setBookingDetails(set, booking)

    // Cake answers are Square option names that the Paperform fields can't represent, so the mapper sees no cake
    // and processing passes the cake to the booking directly (see `partyFormV2BookingCake`).
    set('cake', BRING_OWN_CAKE)
    set(
        'take_home_bags',
        orderedQuantities(payload.takeHomeBags).map(([SKU, quantity]) => ({ SKU, quantity }))
    )
    set(
        'products',
        orderedQuantities(payload.products).map(([SKU, quantity]) => ({ SKU, quantity }))
    )

    return new PaperformSubmission<PartyForm>(
        { results: { submission: { id: submissionId, form_id: 'party-form-v2', data } } },
        PARTY_FORM_FIELD_MAPPING
    )
}

type SetField = <K extends keyof PartyForm>(key: K, value: PartyForm[K]) => void

function setPartyAnswers(set: SetField, payload: PartyFormV2PartyAnswers, booking: Pick<Booking, 'type'>) {
    set('parent_first_name', payload.parentFirstName)
    set('parent_last_name', payload.parentLastName)
    set('child_name', payload.childName)
    set('child_age', payload.childAge)
    set(
        booking.type === 'mobile' ? 'number_of_children_mobile' : 'number_of_children_in_store',
        payload.numberOfChildren
    )

    // the custom form submits stable creation keys, which resolveBirthdayPartyBookingCreation
    // matches just like it matches the Paperform labels
    for (const { mobile, packageKey, studio } of PAPERFORM_CREATION_FIELDS) {
        const selection = payload.creations.find((creation) => creation.packageKey === packageKey)
        set(booking.type === 'mobile' ? mobile : studio, selection?.creationKeys ?? [])
    }

    if (booking.type === 'studio')
        set(
            'food_package',
            payload.foodPackage === 'include' ? 'Include the food package' : 'I will self-cater the party'
        )
    set(
        'additions',
        payload.additions.map((addition) => ADDITIONS[addition].displayValueWithPrice)
    )
    set('fun_facts', payload.funFacts ?? '')
    set('questions', payload.questions ?? '')
}

/**
 * The cake form doesn't ask the party questions, so it repeats what the booking already holds, as the Paperform's
 * prefill did. Unanswered questions (creations, fun facts) are left out and the booking keeps its values.
 */
function setBookingDetails(
    set: SetField,
    booking: Pick<Booking, 'type' | 'parentFirstName' | 'parentLastName' | 'childName' | 'childAge' | 'includesFood'>
) {
    set('parent_first_name', booking.parentFirstName)
    set('parent_last_name', booking.parentLastName)
    set('child_name', booking.childName)
    set('child_age', String(booking.childAge))
    if (booking.type === 'studio')
        set('food_package', booking.includesFood ? 'Include the food package' : 'I will self-cater the party')
}

/** The booking's cake for a custom form submission. Its answers are already the names customers chose. */
export function partyFormV2BookingCake(payload: PartyFormV2): Booking['cake'] {
    if (!payload.cake) return undefined
    const { selection, flavours, size, served, candles, message } = payload.cake
    return { selection, flavours: [...flavours], size, served, candles, ...(message && { message }) }
}
