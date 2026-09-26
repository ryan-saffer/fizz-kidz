import { SquareClient } from '../square.client'

import type { Square } from 'square'

export type CatalogCategoryItem = {
    id: string
    /** The item's first variation, which is what gets ordered. */
    variationId: string | null
    name: string
    /** The customer-facing description, or null when the item has none. */
    description: string | null
    imageUrl: string | null
    /** Price of the item's first variation; null when the variation is variably priced. */
    priceCents: number | null
    /** Square locations the item is sold at. `null` means every location. */
    locationIds: string[] | null
    absentAtLocationIds: string[]
    /** The sales channels the item is sold through. */
    channels: string[]
}

/**
 * Lists the non-archived items in a Square catalog category, in the category's Dashboard order,
 * with each item's primary image URL.
 */
export async function listCatalogCategoryItems(categoryId: string): Promise<CatalogCategoryItem[]> {
    const square = await SquareClient.getInstance()

    const items: Square.CatalogObject.Item[] = []
    let cursor: string | undefined
    do {
        const response = await square.catalog.searchItems({ categoryIds: [categoryId], cursor })
        if (response.errors?.length) throw response.errors[0]
        items.push(
            ...(response.items ?? []).filter(
                (item): item is Square.CatalogObject.Item => item.type === 'ITEM' && !item.itemData?.isArchived
            )
        )
        cursor = response.cursor
    } while (cursor)

    const imageIds = items.flatMap((item) => item.itemData?.imageIds?.slice(0, 1) ?? [])
    const imageUrls = new Map<string, string>()
    if (imageIds.length > 0) {
        const response = await square.catalog.batchGet({ objectIds: imageIds })
        if (response.errors?.length) throw response.errors[0]
        for (const object of response.objects ?? []) {
            if (object.type === 'IMAGE' && object.imageData?.url) imageUrls.set(object.id, object.imageData.url)
        }
    }

    const ordinal = (item: Square.CatalogObject.Item) =>
        item.itemData?.categories?.find((category) => category.id === categoryId)?.ordinal ?? BigInt(0)

    return items
        .sort((a, b) => (ordinal(a) < ordinal(b) ? -1 : ordinal(a) > ordinal(b) ? 1 : 0))
        .map((item) => {
            const variation = item.itemData?.variations?.find(
                (it): it is Square.CatalogObject.ItemVariation => it.type === 'ITEM_VARIATION'
            )
            const price = variation?.itemVariationData?.priceMoney?.amount
            const imageId = item.itemData?.imageIds?.[0]
            return {
                id: item.id,
                variationId: variation?.id ?? null,
                name: item.itemData?.name ?? '',
                description: item.itemData?.descriptionPlaintext?.trim() || null,
                imageUrl: (imageId && imageUrls.get(imageId)) || null,
                priceCents: price === undefined || price === null ? null : Number(price),
                locationIds: item.presentAtAllLocations === false ? (item.presentAtLocationIds ?? []) : null,
                absentAtLocationIds: item.absentAtLocationIds ?? [],
                channels: item.itemData?.channels ?? [],
            }
        })
}
