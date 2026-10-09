import { SquareClient } from '../square.client'

import type { Square } from 'square'

export type CatalogLocationOverride = { locationId: string; priceCents: number | null; soldOut: boolean }

/** A variation or modifier, with its base price and any per-location price or sold-out overrides. */
export type CatalogOption = {
    id: string
    name: string
    priceCents: number
    imageUrl: string | null
    locationOverrides: CatalogLocationOverride[]
    /** Square locations it is sold at. `null` means every location. */
    locationIds: string[] | null
    absentAtLocationIds: string[]
}

export type CatalogItemModifierList = {
    id: string
    name: string
    /** How many modifiers the item requires from this list. `null` means no limit. */
    minSelected: number | null
    maxSelected: number | null
    modifiers: CatalogOption[]
}

/**
 * Returns a Square catalog item's name and description, its variations and its enabled modifier lists (keyed by modifier list id),
 * each in Dashboard order, with the item's selection limits for each list.
 */
export async function getCatalogItemOptions(itemId: string) {
    const square = await SquareClient.getInstance()

    const response = await square.catalog.batchGet({ objectIds: [itemId], includeRelatedObjects: true })
    if (response.errors?.length) throw response.errors[0]
    const item = response.objects?.find((object): object is Square.CatalogObject.Item => object.type === 'ITEM')
    if (!item) throw new Error(`Square catalog item '${itemId}' not found`)

    const modifierLists = (response.relatedObjects ?? []).filter(
        (object): object is Square.CatalogObject.ModifierList => object.type === 'MODIFIER_LIST'
    )

    const itemVariations = (item.itemData?.variations ?? []).filter(
        (variation): variation is Square.CatalogObject.ItemVariation => variation.type === 'ITEM_VARIATION'
    )
    const itemImageId = item.itemData?.imageIds?.[0]
    const imageIds = [
        ...(itemImageId ? [itemImageId] : []),
        ...itemVariations.flatMap((variation) => variation.itemVariationData?.imageIds?.slice(0, 1) ?? []),
        ...modifierLists.flatMap((list) =>
            (list.modifierListData?.modifiers ?? []).flatMap((modifier) =>
                modifier.type === 'MODIFIER' && modifier.modifierData?.imageId ? [modifier.modifierData.imageId] : []
            )
        ),
    ]
    const imageUrls = new Map<string, string>()
    if (imageIds.length > 0) {
        const images = await square.catalog.batchGet({ objectIds: imageIds })
        if (images.errors?.length) throw images.errors[0]
        for (const object of images.objects ?? []) {
            if (object.type === 'IMAGE' && object.imageData?.url) imageUrls.set(object.id, object.imageData.url)
        }
    }

    const cents = (money: Square.Money | undefined) =>
        money?.amount === undefined || money.amount === null ? null : Number(money.amount)
    const overrides = (
        list: { locationId?: string | null; priceMoney?: Square.Money; soldOut?: boolean }[] | null | undefined
    ) =>
        (list ?? []).flatMap((override) =>
            override.locationId
                ? [
                      {
                          locationId: override.locationId,
                          priceCents: cents(override.priceMoney),
                          soldOut: override.soldOut ?? false,
                      },
                  ]
                : []
        )
    const limit = (value: number | null | undefined) =>
        value === undefined || value === null || value < 0 ? null : value

    const variations: CatalogOption[] = itemVariations
        .sort((a, b) => (a.itemVariationData?.ordinal ?? 0) - (b.itemVariationData?.ordinal ?? 0))
        .map((variation) => {
            // a variation's own photo, falling back to the item's
            const imageId = variation.itemVariationData?.imageIds?.[0] ?? itemImageId
            return {
                id: variation.id,
                name: variation.itemVariationData?.name ?? '',
                priceCents: cents(variation.itemVariationData?.priceMoney) ?? 0,
                imageUrl: (imageId && imageUrls.get(imageId)) || null,
                locationOverrides: overrides(variation.itemVariationData?.locationOverrides),
                locationIds: variation.presentAtAllLocations === false ? (variation.presentAtLocationIds ?? []) : null,
                absentAtLocationIds: variation.absentAtLocationIds ?? [],
            }
        })

    const lists = new Map<string, CatalogItemModifierList>()
    for (const info of item.itemData?.modifierListInfo ?? []) {
        if (info.enabled === false) continue
        const list = modifierLists.find((it) => it.id === info.modifierListId)
        if (!list) continue
        lists.set(list.id, {
            id: list.id,
            name: list.modifierListData?.name ?? '',
            minSelected: limit(info.minSelectedModifiers),
            maxSelected: limit(info.maxSelectedModifiers),
            modifiers: (list.modifierListData?.modifiers ?? [])
                .filter((modifier): modifier is Square.CatalogObject.Modifier => modifier.type === 'MODIFIER')
                .sort((a, b) => (a.modifierData?.ordinal ?? 0) - (b.modifierData?.ordinal ?? 0))
                .map((modifier) => {
                    const imageId = modifier.modifierData?.imageId
                    return {
                        id: modifier.id,
                        name: modifier.modifierData?.name ?? '',
                        priceCents: cents(modifier.modifierData?.priceMoney) ?? 0,
                        imageUrl: (imageId && imageUrls.get(imageId)) || null,
                        locationOverrides: overrides(modifier.modifierData?.locationOverrides),
                        locationIds:
                            modifier.presentAtAllLocations === false ? (modifier.presentAtLocationIds ?? []) : null,
                        absentAtLocationIds: modifier.absentAtLocationIds ?? [],
                    }
                }),
        })
    }

    return {
        name: item.itemData?.name ?? '',
        description: item.itemData?.descriptionPlaintext?.trim() || null,
        /** The sales channels the item is sold through. */
        channels: item.itemData?.channels ?? [],
        variations,
        modifierLists: lists,
    }
}

/** Whether a catalog item or variation is sold at a location ('Not sold at this location' in the Dashboard). */
export function isSoldAtLocation(
    object: { locationIds: string[] | null; absentAtLocationIds: string[] },
    locationId: string
) {
    return (
        (object.locationIds === null || object.locationIds.includes(locationId)) &&
        !object.absentAtLocationIds.includes(locationId)
    )
}
