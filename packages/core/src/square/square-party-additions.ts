import type { PartyFormV2Addition } from '../parties/party-form-v2'

/** The Square category whose items are offered as party food additions. */
export const PARTY_ADDITIONS_SQUARE_CATEGORY = {
    prod: 'AMW6S44ZABXWIHFOPAFEQVIJ',
    dev: '2WW2JDOOPEOCEWKNEFRNGD75',
} as const satisfies Record<'prod' | 'dev', string>

/**
 * Bookings store additions as boolean addition keys, so each Square item must map to one.
 * Items in the category without a mapping are not offered.
 */
const PARTY_ADDITION_SQUARE_ITEMS = {
    prod: {
        EMDK3NQHLYBZP56D7ZZM3CNG: 'chickenNuggets',
        AQJJ4SBKGWOOQSL4HHPA7D7G: 'fairyBread',
        '72UDB2UDOVS4ST3NBGHLO6JJ': 'fruitPlatter',
        YO3DXBPZGHF75EECXNUKKLVP: 'frankfurts',
        Q4CVHSOSXPGCYY2AK5FZUDY2: 'sandwichPlatter',
        KOXPILX7LVCYPMSOOANL2FE7: 'vegetarianQuiche',
        TE7RZOU5IPZO3TA7B43M25WQ: 'watermelonPlatter',
        A6A2KEDNLNFZYXSFTHW7OJW7: 'wedges',
    },
    dev: {
        '2ZFAJC6XY3ANEDBYY4RVGST6': 'chickenNuggets',
        MZQL65ZQY3ALHGBTJ647EM33: 'fairyBread',
        CPDZY2AKWVQ2APB3KL4YWQWR: 'fruitPlatter',
        '5K5VTUS7Y3B5N2KRWV6WOH5G': 'frankfurts',
        S2R2HY7AB2CPQ2VQJIZFJDPS: 'sandwichPlatter',
        KM3OIDDPX3TT5654CPGS2G6U: 'vegetarianQuiche',
        '62QOM22LWLHN5CPEVOII3I3T': 'watermelonPlatter',
        HUUY6FVWNOULTV7IRHICRIY4: 'wedges',
    },
} as const satisfies Record<'prod' | 'dev', Record<string, PartyFormV2Addition>>

export function mapSquareItemToPartyAddition(env: 'prod' | 'dev', itemId: string): PartyFormV2Addition | undefined {
    const items: Record<string, PartyFormV2Addition> = PARTY_ADDITION_SQUARE_ITEMS[env]
    return items[itemId]
}
