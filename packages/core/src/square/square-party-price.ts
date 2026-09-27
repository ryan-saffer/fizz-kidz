import type { Booking } from '../parties/booking'

/** Studio parties are charged per child, for at least this many children. */
export const MIN_CHARGED_CHILDREN = 12

export type ChargedPartyLength = Extract<Booking['partyLength'], '1.5' | '2'>

type PartyPriceList = {
    itemId: string
    /** The price per child for each length, with or without the food package. */
    variations: Record<ChargedPartyLength, { food: string; noFood: string }>
}

/**
 * The Square variations studio parties are charged with. Bookings made before a price rise are flagged `oldPrices` and
 * keep the old price list; everything else uses the current one. Prices, names and photos come from Square.
 */
export const PARTY_PRICE_SQUARE_CATALOG = {
    prod: {
        current: {
            itemId: 'ZCFY6WMK7YOMVDQHIOBU3PPB', // Studio Party
            variations: {
                '1.5': { food: 'Q72SCAVRLXJ7SBJPEJZZDRIQ', noFood: 'DUIR2I67WDZWJUMCWU5BRITY' },
                '2': { food: 'IAKQ4HM44I4H237JIQMZ7KIZ', noFood: 'HUYSIYCW7MYSQ5LGZLIB75BT' },
            },
        },
        old: {
            itemId: 'LJWZ34HSWSOWW5J4SDEP4BGZ', // Studio Party - TEST, '[OLD PRICE]' variations
            variations: {
                '1.5': { food: 'BPGPGUN5PINGKG7SRFZG5CPA', noFood: 'XZCGAVNLGQRNUYNJRTYXDASH' },
                '2': { food: 'CQVZQEBCVXQMMQ4DU7OBKMMH', noFood: 'XKEIIFBLDG3OFACK6SGBUVXP' },
            },
        },
    },
    dev: {
        current: {
            itemId: 'JZSDZ4DU7KLIN2HNU7NW3F7B',
            variations: {
                '1.5': { food: 'OOVHBF4EIVVHPNKNVVPWLXNU', noFood: 'FG3PXJ4VXNN3M7J6AKCUS2QR' },
                '2': { food: '3ZOFJWHGFJWQPKGWUHS7K37W', noFood: 'XWN3C2IW6GQ2WXZE3GTVONOD' },
            },
        },
        old: {
            itemId: 'CNTK6PIGFWWL6VGGGQJFOWIU',
            variations: {
                '1.5': { food: 'IPCGVU2MFUAHBY4CHACUDTP7', noFood: 'MRKRHZBW4LK4CHZJKWWBLRWQ' },
                '2': { food: '3FB4UK57IFVJ3SOSNFZ2Y7YQ', noFood: '5Y2KMOZ74B2P5LPEWLAMCX36' },
            },
        },
    },
} as const satisfies Record<'prod' | 'dev', Record<'current' | 'old', PartyPriceList>>

export function getPartyPriceList(env: 'prod' | 'dev', oldPrices: boolean): PartyPriceList {
    return PARTY_PRICE_SQUARE_CATALOG[env][oldPrices ? 'old' : 'current']
}
