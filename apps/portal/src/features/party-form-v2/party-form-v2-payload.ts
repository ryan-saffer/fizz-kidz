import { BRING_OWN_CAKE, partyFormV2Schema } from '@fizz-kidz/core'

import type { FormValues } from './party-form-v2-form'
import type { PartyFormV2Config } from './party-form-v2-page'

export function buildPartyFormPayload(config: PartyFormV2Config, value: FormValues) {
    const creations = new Map<string, string[]>()
    for (const selection of value.creations)
        creations.set(selection.packageKey, [...(creations.get(selection.packageKey) ?? []), selection.creationKey])
    return partyFormV2Schema.parse({
        bookingId: config.bookingId,
        parentFirstName: value.parentFirstName.trim(),
        parentLastName: value.parentLastName.trim(),
        childName: value.childName.trim(),
        childAge: value.childAge.trim(),
        numberOfChildren: value.numberOfChildren,
        creations: [...creations].map(([packageKey, creationKeys]) => ({ packageKey, creationKeys })),
        ...(config.type === 'studio' && { foodPackage: value.foodPackage }),
        additions: config.type === 'studio' ? value.additions : [],
        ...(config.canOrderCake &&
            value.cakeSelection &&
            value.cakeSelection !== BRING_OWN_CAKE && {
                cake: {
                    selection: value.cakeSelection,
                    size: value.cakeSize,
                    flavours: value.cakeFlavours,
                    served: value.cakeServed,
                    candles: value.cakeCandles,
                    ...(value.cakeMessage.trim() && { message: value.cakeMessage.trim() }),
                },
            }),
        takeHomeBags: Object.fromEntries(Object.entries(value.takeHomeBags).filter(([, quantity]) => quantity > 0)),
        products: Object.fromEntries(Object.entries(value.products).filter(([, quantity]) => quantity > 0)),
        ...(value.funFacts.trim() && { funFacts: value.funFacts.trim() }),
        ...(value.questions.trim() && { questions: value.questions.trim() }),
    })
}
