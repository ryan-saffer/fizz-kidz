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
    colour: BirthdayPartyCardColour
    image: BirthdayPartyCatalogueImage
    label: string[]
    offeringKey: string
    useForBookingChoice: boolean
}

export type BirthdayPartyCreationOffering = {
    _id: string
    key: string
    legacyLabels: string[]
    name: string
    recipe?: {
        _id: string
        name: string
    }
    status: BirthdayPartyCatalogueStatus
}

export type BirthdayPartyPackageOffering = {
    _key: string
    availability: BirthdayPartyBookingChannel[]
    offering: BirthdayPartyCreationOffering
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
    offerings: BirthdayPartyPackageOffering[]
    order: number
    status: BirthdayPartyCatalogueStatus
    summaryTitle: string
}

export type BirthdayPartyCatalogue = {
    packages: BirthdayPartyCataloguePackage[]
}

export function validateBirthdayPartyCatalogue(catalogue: BirthdayPartyCatalogue): BirthdayPartyCatalogue {
    if (catalogue.packages.length === 0) {
        throw new Error('Birthday party catalogue must contain at least one package')
    }

    const packageKeys = new Set<string>()
    const packageOrders = new Set<number>()
    const offeringIdsByKey = new Map<string, string>()

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
        if (partyPackage.offerings.length === 0) {
            throw new Error(`Package "${partyPackage.key}" must contain at least one offering`)
        }

        const offeringKeys = new Set<string>()
        const offeringKeysByLabel = new Map<string, string>()
        const entryKeys = new Set<string>()
        for (const packageOffering of partyPackage.offerings) {
            if (!packageOffering._key?.trim() || entryKeys.has(packageOffering._key)) {
                throw new Error(`Package "${partyPackage.key}" has a missing or duplicate entry key`)
            }
            entryKeys.add(packageOffering._key)

            if (!packageOffering.offering) {
                throw new Error(
                    `Package "${partyPackage.key}" entry "${packageOffering._key}" has a missing offering reference`
                )
            }

            if (!packageOffering.offering.key?.trim()) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${packageOffering.offering._id}" must have a stable key`
                )
            }
            if (offeringKeys.has(packageOffering.offering.key)) {
                throw new Error(
                    `Package "${partyPackage.key}" contains duplicate offering "${packageOffering.offering.key}"`
                )
            }
            offeringKeys.add(packageOffering.offering.key)

            const existingOfferingId = offeringIdsByKey.get(packageOffering.offering.key)
            if (existingOfferingId && existingOfferingId !== packageOffering.offering._id) {
                throw new Error(`Duplicate offering key "${packageOffering.offering.key}"`)
            }
            offeringIdsByKey.set(packageOffering.offering.key, packageOffering.offering._id)

            if (packageOffering.offering.status !== 'active') {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${packageOffering.offering.key}" must be active`
                )
            }
            if (!packageOffering.offering.name?.trim()) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${packageOffering.offering.key}" must have a customer-facing name`
                )
            }

            for (const label of [packageOffering.offering.name, ...packageOffering.offering.legacyLabels]) {
                const normalizedLabel = label.trim().toLocaleLowerCase('en-AU')
                if (!normalizedLabel) {
                    throw new Error(
                        `Package "${partyPackage.key}" offering "${packageOffering.offering.key}" has an empty legacy label`
                    )
                }
                const existingOfferingKey = offeringKeysByLabel.get(normalizedLabel)
                if (existingOfferingKey && existingOfferingKey !== packageOffering.offering.key) {
                    throw new Error(
                        `Package "${partyPackage.key}" label "${normalizedLabel}" is ambiguous between offerings "${existingOfferingKey}" and "${packageOffering.offering.key}"`
                    )
                }
                offeringKeysByLabel.set(normalizedLabel, packageOffering.offering.key)
            }

            if (packageOffering.availability.length === 0) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${packageOffering.offering.key}" must have at least one booking channel`
                )
            }
            if (
                new Set(packageOffering.availability).size !== packageOffering.availability.length ||
                packageOffering.availability.some((channel) => !BIRTHDAY_PARTY_BOOKING_CHANNELS.includes(channel))
            ) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${packageOffering.offering.key}" has invalid booking channels`
                )
            }
        }

        if (partyPackage.cards.length === 0) {
            throw new Error(`Package "${partyPackage.key}" must contain at least one Website card`)
        }

        const cardKeys = new Set<string>()
        for (const card of partyPackage.cards) {
            if (!card._key?.trim() || cardKeys.has(card._key)) {
                throw new Error(`Package "${partyPackage.key}" has a missing or duplicate card key`)
            }
            cardKeys.add(card._key)

            if (!offeringKeys.has(card.offeringKey)) {
                throw new Error(
                    `Package "${partyPackage.key}" card "${card._key}" references unknown offering "${card.offeringKey}"`
                )
            }

            if (!card.alt?.trim()) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${card.offeringKey}" card "${card._key}" must have useful alt text`
                )
            }
            if (!BIRTHDAY_PARTY_CARD_COLOURS.includes(card.colour)) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${card.offeringKey}" card "${card._key}" has an invalid colour`
                )
            }
            if (
                !card.image?.assetId ||
                !card.image.src ||
                !Number.isFinite(card.image.width) ||
                card.image.width <= 0 ||
                !Number.isFinite(card.image.height) ||
                card.image.height <= 0
            ) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${card.offeringKey}" card "${card._key}" must have an image`
                )
            }
        }

        for (const offeringKey of offeringKeys) {
            if (
                partyPackage.cards.filter((card) => card.offeringKey === offeringKey && card.useForBookingChoice)
                    .length !== 1
            ) {
                throw new Error(
                    `Package "${partyPackage.key}" offering "${offeringKey}" must have exactly one booking choice image`
                )
            }
        }
    }

    return catalogue
}
