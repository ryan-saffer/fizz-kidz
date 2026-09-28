import {
    formatCents,
    type FirestoreBooking,
    type PartyFormV2Addition,
    type PreparePartyCheckout,
    type WithId,
} from '@fizz-kidz/core'

import type { EstimateLine } from '@features/terminal-checkout/components/order-summary'
import { createTerminalCheckoutStore } from '@features/terminal-checkout/state/terminal-checkout-store'
import type { AppRouter } from '@server/app/trpc/app.trpc'

import type { inferRouterOutputs } from '@trpc/server'

type PartyCheckoutOutput = inferRouterOutputs<AppRouter>['parties']['getPartyCheckout']

/** What a booking can be charged: Square's party prices and food additions, and the prefilled answers. */
export type CheckoutConfig = Extract<PartyCheckoutOutput, { blocked: null }>

export type CheckoutAnswers = Omit<PreparePartyCheckout, 'bookingId'>

/**
 * Collecting payment for a party: staff confirm the party, children and food, check Square's price, then charge the
 * studio's terminal and wait for the customer to pay. The subject is the booking. How a charge is sent and checked is
 * the shared terminal checkout's (`features/terminal-checkout`); this adds the party's steps and answers.
 */
export const useCheckoutStore = createTerminalCheckoutStore<WithId<FirestoreBooking>, CheckoutConfig, CheckoutAnswers>({
    storageKey: 'party-checkout-charge',
    getSubjectId: (booking) => booking.id,
    steps: [
        { key: 'party', label: 'Party' },
        { key: 'food', label: 'Food' },
    ],
    initialAnswers: {
        partyLength: '1.5',
        includesFood: true,
        childrenCount: 12,
        additions: [],
        discountCents: 0,
        discountReason: '',
        giftCardNumber: '',
    },
})

/** The party price per child and the additions for the answers, before Square prices them on the review step. */
export function estimateCharge(config: CheckoutConfig, answers: CheckoutAnswers) {
    const party = config.partyPrices.find(
        (price) => price.partyLength === answers.partyLength && price.includesFood === answers.includesFood
    )
    const chargedChildren = Math.max(answers.childrenCount, config.minChildren)
    const additions = config.additions.filter((addition) => answers.additions.includes(addition.key))
    const partyCents = (party?.priceCents ?? 0) * chargedChildren
    const additionsCents = additions.reduce((sum, addition) => sum + addition.priceCents, 0)
    return {
        party,
        chargedChildren,
        partyCents,
        additions,
        totalCents: Math.max(partyCents + additionsCents - answers.discountCents, 0),
    }
}

/** The estimate as order summary lines. */
export function getEstimateLines(config: CheckoutConfig, answers: CheckoutAnswers): EstimateLine[] {
    const estimate = estimateCharge(config, answers)
    return [
        ...(estimate.party
            ? [
                  {
                      key: 'party',
                      label: `${estimate.chargedChildren} × ${estimate.party.name}`,
                      detail: `${formatCents(estimate.party.priceCents)} per child`,
                      amountCents: estimate.partyCents,
                  },
              ]
            : []),
        ...estimate.additions.map((addition) => ({
            key: addition.key,
            label: addition.name,
            amountCents: addition.priceCents,
        })),
    ]
}

export const toggleAddition = (additions: PartyFormV2Addition[], key: PartyFormV2Addition) =>
    additions.includes(key) ? additions.filter((it) => it !== key) : [...additions, key]
