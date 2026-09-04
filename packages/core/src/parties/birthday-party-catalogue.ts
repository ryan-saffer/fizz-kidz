export const BIRTHDAY_PARTY_CATALOGUE_STATUSES = ['active', 'retired'] as const
export const BIRTHDAY_PARTY_BOOKING_CHANNELS = ['studio', 'mobile'] as const
export const BIRTHDAY_PARTY_CARD_COLOURS = ['pink', 'yellow', 'green', 'purple', 'blue', 'white', 'red'] as const

export type BirthdayPartyCatalogueStatus = (typeof BIRTHDAY_PARTY_CATALOGUE_STATUSES)[number]
export type BirthdayPartyBookingChannel = (typeof BIRTHDAY_PARTY_BOOKING_CHANNELS)[number]
export type BirthdayPartyCardColour = (typeof BIRTHDAY_PARTY_CARD_COLOURS)[number]

export type BirthdayPartyCatalogueImage = {
    assetId: string
    height: number
    src: string
    width: number
}

export type BirthdayPartyCreationCard = {
    _key: string
    alt: string
    bookingChannels: BirthdayPartyBookingChannel[]
    bookingOrder?: number
    colour: BirthdayPartyCardColour
    creation: BirthdayPartyCatalogueCreation
    image: BirthdayPartyCatalogueImage
    label: string[]
}

export type BirthdayPartyCatalogueCreation = {
    _id: string
    image: BirthdayPartyCatalogueImage
    key: string
    legacyLabels: string[]
    name: string
    recipe?: {
        _id: string
        name: string
    }
    status: BirthdayPartyCatalogueStatus
}

export type BirthdayPartyCataloguePackage = {
    _id: string
    accentColour: string
    blackBackground?: boolean
    caption?: string
    cards: BirthdayPartyCreationCard[]
    hidePartyImage?: boolean
    key: string
    name: string
    order: number
    status: BirthdayPartyCatalogueStatus
    summaryTitle: string
}

export type BirthdayPartyCatalogue = {
    packages: BirthdayPartyCataloguePackage[]
}

function hasCompleteImage(image: BirthdayPartyCatalogueImage | undefined) {
    return Boolean(
        image?.assetId &&
        image.src &&
        Number.isFinite(image.width) &&
        image.width > 0 &&
        Number.isFinite(image.height) &&
        image.height > 0
    )
}

export function validateBirthdayPartyCatalogue(catalogue: BirthdayPartyCatalogue): BirthdayPartyCatalogue {
    if (catalogue.packages.length === 0) {
        throw new Error('Birthday party catalogue must contain at least one package')
    }

    const packageKeys = new Set<string>()
    const packageOrders = new Set<number>()
    const creationIdsByKey = new Map<string, string>()

    for (const partyPackage of catalogue.packages) {
        if (!partyPackage.key?.trim()) {
            throw new Error(`Active package "${partyPackage._id}" must have a stable key`)
        }
        if (packageKeys.has(partyPackage.key)) {
            throw new Error(`Duplicate package key "${partyPackage.key}"`)
        }
        packageKeys.add(partyPackage.key)

        if (partyPackage.status !== 'active') {
            throw new Error(`Published catalogue package "${partyPackage.key}" must be active`)
        }
        if (!partyPackage.name?.trim()) {
            throw new Error(`Package "${partyPackage.key}" must have a customer-facing name`)
        }
        if (!Number.isInteger(partyPackage.order) || partyPackage.order < 0) {
            throw new Error(`Package "${partyPackage.key}" must have a non-negative integer order`)
        }
        if (packageOrders.has(partyPackage.order)) {
            throw new Error(`Duplicate package order "${partyPackage.order}"`)
        }
        packageOrders.add(partyPackage.order)
        if (!partyPackage.summaryTitle?.trim()) {
            throw new Error(`Package "${partyPackage.key}" must have a catalogue section title`)
        }
        if (!/^#[0-9A-F]{6}$/i.test(partyPackage.accentColour)) {
            throw new Error(`Package "${partyPackage.key}" must have a six-digit hexadecimal accent colour`)
        }
        if (partyPackage.cards.length === 0) {
            throw new Error(`Package "${partyPackage.key}" must contain at least one Website card`)
        }

        const cardKeys = new Set<string>()
        const creationKeys = new Set<string>()
        const creationKeysByLabel = new Map<string, string>()
        const bookingCardCounts = new Map<string, number>()
        const bookingOrders = new Set<number>()
        for (const card of partyPackage.cards) {
            if (!card._key?.trim() || cardKeys.has(card._key)) {
                throw new Error(`Package "${partyPackage.key}" has a missing or duplicate card key`)
            }
            cardKeys.add(card._key)

            if (!card.creation) {
                throw new Error(`Package "${partyPackage.key}" card "${card._key}" has a missing creation reference`)
            }

            const creation = card.creation
            if (!creation.key?.trim()) {
                throw new Error(`Package "${partyPackage.key}" creation "${creation._id}" must have a stable key`)
            }

            const existingCreationId = creationIdsByKey.get(creation.key)
            if (existingCreationId && existingCreationId !== creation._id) {
                throw new Error(`Duplicate creation key "${creation.key}"`)
            }
            creationIdsByKey.set(creation.key, creation._id)

            if (!creationKeys.has(creation.key)) {
                creationKeys.add(creation.key)

                if (creation.status !== 'active') {
                    throw new Error(`Package "${partyPackage.key}" creation "${creation.key}" must be active`)
                }
                if (!creation.name?.trim()) {
                    throw new Error(
                        `Package "${partyPackage.key}" creation "${creation.key}" must have a customer-facing name`
                    )
                }
                if (!hasCompleteImage(creation.image)) {
                    throw new Error(`Package "${partyPackage.key}" creation "${creation.key}" must have an image`)
                }

                for (const label of [creation.name, ...creation.legacyLabels]) {
                    const normalizedLabel = label.trim().toLocaleLowerCase('en-AU')
                    if (!normalizedLabel) {
                        throw new Error(
                            `Package "${partyPackage.key}" creation "${creation.key}" has an empty legacy label`
                        )
                    }
                    const existingCreationKey = creationKeysByLabel.get(normalizedLabel)
                    if (existingCreationKey && existingCreationKey !== creation.key) {
                        throw new Error(
                            `Package "${partyPackage.key}" label "${normalizedLabel}" is ambiguous between creations "${existingCreationKey}" and "${creation.key}"`
                        )
                    }
                    creationKeysByLabel.set(normalizedLabel, creation.key)
                }
            }

            const bookingChannels = Array.isArray(card.bookingChannels) ? card.bookingChannels : []
            if (
                !Array.isArray(card.bookingChannels) ||
                new Set(bookingChannels).size !== bookingChannels.length ||
                bookingChannels.some((channel) => !BIRTHDAY_PARTY_BOOKING_CHANNELS.includes(channel))
            ) {
                throw new Error(`Package "${partyPackage.key}" creation "${creation.key}" has invalid booking channels`)
            }
            if (bookingChannels.length > 0) {
                bookingCardCounts.set(creation.key, (bookingCardCounts.get(creation.key) ?? 0) + 1)
                if (!Number.isInteger(card.bookingOrder) || (card.bookingOrder ?? 0) < 1) {
                    throw new Error(
                        `Package "${partyPackage.key}" creation "${creation.key}" booking card must have a positive integer order`
                    )
                }
                if (bookingOrders.has(card.bookingOrder!)) {
                    throw new Error(`Package "${partyPackage.key}" has duplicate booking order "${card.bookingOrder}"`)
                }
                bookingOrders.add(card.bookingOrder!)
            } else if (card.bookingOrder != null) {
                throw new Error(
                    `Package "${partyPackage.key}" creation "${creation.key}" display card cannot have a booking order`
                )
            }

            if (!card.alt?.trim()) {
                throw new Error(
                    `Package "${partyPackage.key}" creation "${creation.key}" card "${card._key}" must have useful alt text`
                )
            }
            if (!BIRTHDAY_PARTY_CARD_COLOURS.includes(card.colour)) {
                throw new Error(
                    `Package "${partyPackage.key}" creation "${creation.key}" card "${card._key}" has an invalid colour`
                )
            }
            if (!hasCompleteImage(card.image)) {
                throw new Error(
                    `Package "${partyPackage.key}" creation "${creation.key}" card "${card._key}" must have an image`
                )
            }
        }

        for (const creationKey of creationKeys) {
            if (bookingCardCounts.get(creationKey) !== 1) {
                throw new Error(
                    `Package "${partyPackage.key}" creation "${creationKey}" must have exactly one booking card`
                )
            }
        }
        if (
            bookingOrders.size !== creationKeys.size ||
            !Array.from(bookingOrders).every((order) => order <= creationKeys.size)
        ) {
            throw new Error(`Package "${partyPackage.key}" booking orders must be consecutive from 1`)
        }
    }

    return catalogue
}
