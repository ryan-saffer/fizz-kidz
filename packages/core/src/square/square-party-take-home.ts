import type { ProductType } from '../parties/products'
import type { TakeHomeBagType } from '../parties/take-home-bags'

type TakeHomeCatalog = {
    /** Its variations are the take-home bags. */
    takeHomeBagItemId: string
    /** Its items are the Fizz Kidz kits. */
    productCategoryId: string
    /**
     * We don't sell through Square Online, so an item's 'Fizz Kidz Store' sales channel instead decides whether the
     * party form offers it. `null` skips the check (the sandbox has no online store).
     */
    onlineStoreChannelId: string | null
    takeHomeBags: Record<TakeHomeBagType, string>
    products: Record<ProductType, string>
}

/**
 * Square variations for take-home bags and kits. Bookings store quantities by these keys, so each Square variation
 * must map to one; the custom form reads names, photos and prices from Square.
 */
export const PARTY_TAKE_HOME_SQUARE_CATALOG = {
    prod: {
        takeHomeBagItemId: 'MMT462KADSL47T5TR4DTFZWQ',
        productCategoryId: 'HXGF2G4DR4ZOCBXCRAR7I6WN',
        onlineStoreChannelId: 'CH_OpH8Xdpu0EXaoM0LTIXlvdhkmTqOdHb4h540EQlQuYC',
        takeHomeBags: { lollyBags: 'RFPAE4HT6XGDC2TA33BHELLI', lollyToyMixBags: '6VUJRREWNRG3S7B3ZCIZJ6KL' },
        products: {
            bathBombKit: 'VKV2DKJKYHBSD4NHJKGKGGIQ',
            soapMakingKit: 'KEEJ75BGAUW75WFYUND7RN2E',
            stringSlimeKit: 'GJLAMKQXRXPHWLU2PSFAVSCU',
            superSlimeKit: 'H5CGI4PV6TF3YPKT547BZGX3',
        },
    },
    dev: {
        takeHomeBagItemId: 'IJ2IX4QDJZCHP7FJU7EDFTF6',
        productCategoryId: 'WEXJYFZIQH5C6YUKJ5I243P3',
        onlineStoreChannelId: null,
        takeHomeBags: { lollyBags: 'HT4WSYFMNZEDDCTPU735633C', lollyToyMixBags: 'GW4GX2H5HF3VOOYNGOK65GBA' },
        products: {
            bathBombKit: 'ZEFTLTUDWL3YU6M6HBM3KT6Y',
            soapMakingKit: 'XQKZ2657ARJLBMBOQQCIMMGJ',
            stringSlimeKit: 'SDCWKUFWDGV37ERL5E5TP2Q7',
            superSlimeKit: 'L2ICMKCPNS4YXM3TJPVQYCOR',
        },
    },
} as const satisfies Record<'prod' | 'dev', TakeHomeCatalog>

export function mapTakeHomeBagToSquareVariation(env: 'prod' | 'dev', bag: TakeHomeBagType) {
    return PARTY_TAKE_HOME_SQUARE_CATALOG[env].takeHomeBags[bag]
}

export function mapProductToSquareVariation(env: 'prod' | 'dev', product: ProductType) {
    return PARTY_TAKE_HOME_SQUARE_CATALOG[env].products[product]
}

export function mapSquareVariationToTakeHomeBag(env: 'prod' | 'dev', variationId: string) {
    return findKey(PARTY_TAKE_HOME_SQUARE_CATALOG[env].takeHomeBags, variationId)
}

export function mapSquareVariationToProduct(env: 'prod' | 'dev', variationId: string) {
    return findKey(PARTY_TAKE_HOME_SQUARE_CATALOG[env].products, variationId)
}

function findKey<K extends string>(record: Record<K, string>, variationId: string) {
    return (Object.keys(record) as K[]).find((key) => record[key] === variationId)
}
