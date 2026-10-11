import { orderedQuantities, type Booking, type PartyForm } from '@fizz-kidz/core'

/**
 * The booking fields a submission sets. The cake form (`mode: 'cake'`) only orders a cake and take-home goodies, so the
 * booking keeps everything else. Take-home quantities here are the new order; `applyPartyForm` adds them to earlier ones.
 */
export function getPartyFormBookingUpdate(payload: PartyForm, booking: Pick<Booking, 'type'>): Partial<Booking> {
    const order: Partial<Booking> = {
        ...(payload.cake && { cake: getPartyFormBookingCake(payload) }),
        takeHomeBags: Object.fromEntries(orderedQuantities(payload.takeHomeBags)),
        products: Object.fromEntries(orderedQuantities(payload.products)),
    }
    if (payload.mode === 'cake') return order

    const [creation1, creation2, creation3] = [...new Set(payload.creations.flatMap((group) => group.creationKeys))]
    return {
        ...order,
        parentFirstName: payload.parentFirstName,
        parentLastName: payload.parentLastName,
        childName: payload.childName,
        childAge: payload.childAge,
        numberOfChildren: payload.numberOfChildren,
        creation1,
        creation2,
        creation3,
        funFacts: payload.funFacts ?? '',
        questions: payload.questions ?? '',
        partyFormFilledIn: true,
        ...(booking.type === 'studio' && {
            includesFood: payload.foodPackage === 'include',
            ...Object.fromEntries(payload.additions.map((addition) => [addition, true])),
        }),
    }
}

/** The booking's cake. Its answers are already the Square option names customers chose. */
export function getPartyFormBookingCake(payload: PartyForm): Booking['cake'] {
    if (!payload.cake) return undefined
    const { selection, flavours, size, served, candles, message } = payload.cake
    return { selection, flavours: [...flavours], size, served, candles, ...(message && { message }) }
}
