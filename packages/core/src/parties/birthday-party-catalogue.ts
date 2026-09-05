export const BIRTHDAY_PARTY_CATALOGUE_STATUSES = ['active', 'retired'] as const
export const BIRTHDAY_PARTY_BOOKING_CHANNELS = ['studio', 'mobile'] as const
export const BIRTHDAY_PARTY_CARD_COLOURS = ['pink', 'yellow', 'green', 'purple', 'blue', 'white', 'red'] as const
export const BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS = [
    { hex: '#9044E2', title: 'Purple', value: 'purple' },
    { hex: '#4DC5DA', title: 'Blue', value: 'blue' },
    { hex: '#F24DA2', title: 'Pink', value: 'pink' },
    { hex: '#4ED85F', title: 'Green', value: 'green' },
    { hex: '#F6BA33', title: 'Gold', value: 'gold' },
    { hex: '#000000', title: 'Black', value: 'black' },
] as const
export const BIRTHDAY_PARTY_RESERVED_SLUGS = ['at-home-parties', 'book-a-party', 'creations'] as const

export type BirthdayPartyCatalogueStatus = (typeof BIRTHDAY_PARTY_CATALOGUE_STATUSES)[number]
export type BirthdayPartyBookingChannel = (typeof BIRTHDAY_PARTY_BOOKING_CHANNELS)[number]
export type BirthdayPartyCardColour = (typeof BIRTHDAY_PARTY_CARD_COLOURS)[number]
export type BirthdayPartyPackageColour = (typeof BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS)[number]['value']
export type BirthdayPartyPackageColourHex = (typeof BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS)[number]['hex']
export type BirthdayPartyCreationKey = string

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

export type BirthdayPartyFeatureCard = {
    _key: string
    alt: string
    colour: BirthdayPartyCardColour
    image: BirthdayPartyCatalogueImage
    label: string[]
}

export type BirthdayPartyFeatureSection = {
    _key: string
    cards: BirthdayPartyFeatureCard[]
    description: string
    headingImage?: BirthdayPartyCatalogueImage
    headingImageAlt?: string
    title?: string
}

export type BirthdayPartyWebsitePage = {
    creationsImage?: BirthdayPartyCatalogueImage
    features: BirthdayPartyFeatureSection[]
    hero: {
        description: string
        image: BirthdayPartyCatalogueImage
        imageAlt: string
        subtitle: string
        title: string
    }
    navigation: {
        isNew: boolean
    }
    seo: {
        description: string
        serviceName: string
        title: string
    }
    slug: string
    themeCard: {
        image: BirthdayPartyCatalogueImage
        imageAlt: string
    }
}

export type BirthdayPartyCataloguePackage = {
    _id: string
    accentColour: BirthdayPartyPackageColourHex
    blackBackground?: boolean
    caption?: string
    cards: BirthdayPartyCreationCard[]
    hidePartyImage?: boolean
    key: string
    name: string
    position: number
    primaryColour: BirthdayPartyPackageColour
    status: BirthdayPartyCatalogueStatus
    websitePage: BirthdayPartyWebsitePage
}

export type BirthdayPartyCatalogue = {
    packages: BirthdayPartyCataloguePackage[]
}

export type BirthdayPartyBookingCatalogueCreation = {
    key: string
    legacyLabels: string[]
    name: string
    status: BirthdayPartyCatalogueStatus
}

export type BirthdayPartyBookingCataloguePackageCreation = BirthdayPartyBookingCatalogueCreation & {
    bookingChannels: BirthdayPartyBookingChannel[]
    bookingOrder: number
}

export type BirthdayPartyBookingCataloguePackage = {
    creations: BirthdayPartyBookingCataloguePackageCreation[]
    key: string
    name: string
    position?: number
    status: BirthdayPartyCatalogueStatus
}

export type BirthdayPartyBookingCatalogue = {
    creations: BirthdayPartyBookingCatalogueCreation[]
    packages: BirthdayPartyBookingCataloguePackage[]
}

export type BirthdayPartyCreationResolutionInput = {
    channel: BirthdayPartyBookingChannel
    packageKey: string
    submittedValue: string
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
    const packagePositions = new Set<number>()
    const slugs = new Set<string>()
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
            throw new Error(`Package "${partyPackage.key}" must have a package name`)
        }
        if (!Number.isInteger(partyPackage.position) || partyPackage.position < 1) {
            throw new Error(`Package "${partyPackage.key}" must have a positive integer Website position`)
        }
        if (packagePositions.has(partyPackage.position)) {
            throw new Error(`Duplicate Website position "${partyPackage.position}"`)
        }
        packagePositions.add(partyPackage.position)
        if (!isBirthdayPartyPackageColourHex(partyPackage.accentColour)) {
            throw new Error(`Package "${partyPackage.key}" must have a valid accent colour`)
        }
        if (!isBirthdayPartyPackageColour(partyPackage.primaryColour)) {
            throw new Error(`Package "${partyPackage.key}" must have a valid primary colour`)
        }
        const websitePage = partyPackage.websitePage
        if (!websitePage) {
            throw new Error(`Package "${partyPackage.key}" must have Website page content`)
        }
        if (!websitePage.seo) throw new Error(`Package "${partyPackage.key}" must have Website SEO content`)
        if (!websitePage.hero) throw new Error(`Package "${partyPackage.key}" must have Website hero content`)
        if (!websitePage.navigation)
            throw new Error(`Package "${partyPackage.key}" must have Website navigation content`)
        if (!websitePage.themeCard) throw new Error(`Package "${partyPackage.key}" must have a Party Themes card`)
        if (!Array.isArray(websitePage.features)) {
            throw new Error(`Package "${partyPackage.key}" must have a Website feature list`)
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(websitePage.slug)) {
            throw new Error(`Package "${partyPackage.key}" must have a valid Website slug`)
        }
        if (
            BIRTHDAY_PARTY_RESERVED_SLUGS.includes(websitePage.slug as (typeof BIRTHDAY_PARTY_RESERVED_SLUGS)[number])
        ) {
            throw new Error(`Package "${partyPackage.key}" uses reserved Website slug "${websitePage.slug}"`)
        }
        if (slugs.has(websitePage.slug)) {
            throw new Error(`Duplicate Website slug "${websitePage.slug}"`)
        }
        slugs.add(websitePage.slug)

        for (const [field, value] of [
            ['SEO title', websitePage.seo?.title],
            ['SEO description', websitePage.seo?.description],
            ['schema service name', websitePage.seo?.serviceName],
            ['hero title', websitePage.hero?.title],
            ['hero subtitle', websitePage.hero?.subtitle],
            ['hero description', websitePage.hero?.description],
            ['hero image description', websitePage.hero?.imageAlt],
            ['theme card image description', websitePage.themeCard?.imageAlt],
        ] as const) {
            if (!value?.trim()) throw new Error(`Package "${partyPackage.key}" must have a ${field}`)
        }
        if (!hasCompleteImage(websitePage.hero.image)) {
            throw new Error(`Package "${partyPackage.key}" must have a hero image`)
        }
        if (!partyPackage.hidePartyImage) {
            if (!hasCompleteImage(websitePage.creationsImage)) {
                throw new Error(`Package "${partyPackage.key}" must have a creations-section image`)
            }
        }
        if (typeof websitePage.navigation.isNew !== 'boolean') {
            throw new Error(`Package "${partyPackage.key}" must declare whether it is new`)
        }
        if (!hasCompleteImage(websitePage.themeCard.image)) {
            throw new Error(`Package "${partyPackage.key}" must have a theme-card image`)
        }

        const featureKeys = new Set<string>()
        for (const feature of websitePage.features) {
            if (!feature._key?.trim() || featureKeys.has(feature._key)) {
                throw new Error(`Package "${partyPackage.key}" has a missing or duplicate feature key`)
            }
            featureKeys.add(feature._key)
            if (!feature.title?.trim() && !hasCompleteImage(feature.headingImage)) {
                throw new Error(`Package "${partyPackage.key}" feature "${feature._key}" must have a heading`)
            }
            if (feature.headingImage && !feature.headingImageAlt?.trim()) {
                throw new Error(
                    `Package "${partyPackage.key}" feature "${feature._key}" must describe its heading image`
                )
            }
            if (!feature.description?.trim()) {
                throw new Error(`Package "${partyPackage.key}" feature "${feature._key}" must have a description`)
            }
            if (!Array.isArray(feature.cards) || feature.cards.length === 0) {
                throw new Error(`Package "${partyPackage.key}" feature "${feature._key}" must have at least one card`)
            }

            const featureCardKeys = new Set<string>()
            for (const card of feature.cards) {
                if (!card._key?.trim() || featureCardKeys.has(card._key)) {
                    throw new Error(
                        `Package "${partyPackage.key}" feature "${feature._key}" has a missing or duplicate card key`
                    )
                }
                featureCardKeys.add(card._key)
                if (!card.alt?.trim()) {
                    throw new Error(
                        `Package "${partyPackage.key}" feature "${feature._key}" card "${card._key}" must have useful alt text`
                    )
                }
                if (!BIRTHDAY_PARTY_CARD_COLOURS.includes(card.colour)) {
                    throw new Error(
                        `Package "${partyPackage.key}" feature "${feature._key}" card "${card._key}" has an invalid colour`
                    )
                }
                if (!hasCompleteImage(card.image)) {
                    throw new Error(
                        `Package "${partyPackage.key}" feature "${feature._key}" card "${card._key}" must have an image`
                    )
                }
                if (!Array.isArray(card.label) || card.label.length === 0 || card.label.some((line) => !line.trim())) {
                    throw new Error(
                        `Package "${partyPackage.key}" feature "${feature._key}" card "${card._key}" must have a label`
                    )
                }
            }
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

export function validateBirthdayPartyBookingCatalogue(
    catalogue: BirthdayPartyBookingCatalogue
): BirthdayPartyBookingCatalogue {
    const creationsByKey = new Map<string, BirthdayPartyBookingCatalogueCreation>()
    for (const creation of catalogue.creations) {
        if (!creation.key?.trim()) throw new Error('Birthday party creation must have a stable key')
        if (creationsByKey.has(creation.key)) throw new Error(`Duplicate creation key "${creation.key}"`)
        if (!creation.name?.trim()) throw new Error(`Creation "${creation.key}" must have a customer-facing name`)
        if (!BIRTHDAY_PARTY_CATALOGUE_STATUSES.includes(creation.status)) {
            throw new Error(`Creation "${creation.key}" must have a valid status`)
        }
        if (!Array.isArray(creation.legacyLabels) || creation.legacyLabels.some((label) => !label.trim())) {
            throw new Error(`Creation "${creation.key}" has invalid legacy labels`)
        }
        creationsByKey.set(creation.key, creation)
    }

    const packageKeys = new Set<string>()
    const activePositions = new Set<number>()
    for (const partyPackage of catalogue.packages) {
        if (!partyPackage.key?.trim() || packageKeys.has(partyPackage.key)) {
            throw new Error(`Missing or duplicate package key "${partyPackage.key}"`)
        }
        packageKeys.add(partyPackage.key)
        if (!partyPackage.name?.trim()) throw new Error(`Package "${partyPackage.key}" must have a name`)
        if (!BIRTHDAY_PARTY_CATALOGUE_STATUSES.includes(partyPackage.status)) {
            throw new Error(`Package "${partyPackage.key}" must have a valid status`)
        }
        if (partyPackage.status === 'active' && partyPackage.creations.length === 0) {
            throw new Error(`Package "${partyPackage.key}" must contain at least one booking creation`)
        }
        if (
            partyPackage.position !== undefined &&
            (!Number.isInteger(partyPackage.position) || partyPackage.position < 1)
        ) {
            throw new Error(`Package "${partyPackage.key}" must have a positive Website position`)
        }
        if (partyPackage.status === 'active') {
            if (partyPackage.position === undefined) {
                throw new Error(`Active package "${partyPackage.key}" must have a Website position`)
            }
            if (activePositions.has(partyPackage.position)) {
                throw new Error(`Duplicate active package position "${partyPackage.position}"`)
            }
            activePositions.add(partyPackage.position)
        }

        const packageCreationKeys = new Set<string>()
        const packageCreationKeysBySubmittedValue = new Map<string, string>()
        const bookingOrders = new Set<number>()
        for (const creation of partyPackage.creations) {
            if (!creationsByKey.has(creation.key)) {
                throw new Error(`Package "${partyPackage.key}" references unknown creation "${creation.key}"`)
            }
            if (packageCreationKeys.has(creation.key)) {
                throw new Error(`Package "${partyPackage.key}" contains duplicate creation "${creation.key}"`)
            }
            packageCreationKeys.add(creation.key)
            for (const submittedValue of [creation.key, creation.name, ...creation.legacyLabels]) {
                const normalizedValue = normalizeBirthdayPartyCreationValue(submittedValue)
                const existingCreationKey = packageCreationKeysBySubmittedValue.get(normalizedValue)
                if (existingCreationKey && existingCreationKey !== creation.key) {
                    throw new Error(
                        `Package "${partyPackage.key}" value "${submittedValue}" is ambiguous between creations "${existingCreationKey}" and "${creation.key}"`
                    )
                }
                packageCreationKeysBySubmittedValue.set(normalizedValue, creation.key)
            }
            if (
                !Array.isArray(creation.bookingChannels) ||
                creation.bookingChannels.length === 0 ||
                new Set(creation.bookingChannels).size !== creation.bookingChannels.length ||
                creation.bookingChannels.some((channel) => !BIRTHDAY_PARTY_BOOKING_CHANNELS.includes(channel))
            ) {
                throw new Error(`Package "${partyPackage.key}" creation "${creation.key}" has invalid booking channels`)
            }
            if (!Number.isInteger(creation.bookingOrder) || creation.bookingOrder < 1) {
                throw new Error(`Package "${partyPackage.key}" creation "${creation.key}" has an invalid booking order`)
            }
            if (bookingOrders.has(creation.bookingOrder)) {
                throw new Error(`Package "${partyPackage.key}" has duplicate booking order "${creation.bookingOrder}"`)
            }
            bookingOrders.add(creation.bookingOrder)
            if (partyPackage.status === 'active' && creation.status !== 'active') {
                throw new Error(`Active package "${partyPackage.key}" contains retired creation "${creation.key}"`)
            }
        }

        if (
            partyPackage.creations.length > 0 &&
            (bookingOrders.size !== partyPackage.creations.length ||
                !Array.from(bookingOrders).every((order) => order <= partyPackage.creations.length))
        ) {
            throw new Error(`Package "${partyPackage.key}" booking orders must be consecutive from 1`)
        }
    }

    return catalogue
}

export function resolveBirthdayPartyBookingCreation(
    catalogue: BirthdayPartyBookingCatalogue,
    { channel, packageKey, submittedValue }: BirthdayPartyCreationResolutionInput
) {
    const normalizedValue = normalizeBirthdayPartyCreationValue(submittedValue)
    const partyPackage = catalogue.packages.find((candidate) => candidate.key === packageKey)
    const packageMatches =
        partyPackage?.creations.filter(
            (creation) =>
                creation.bookingChannels.includes(channel) &&
                birthdayPartyCreationMatchesSubmittedValue(creation, normalizedValue)
        ) ?? []

    if (packageMatches.length === 1) return packageMatches[0]
    if (packageMatches.length > 1) return undefined

    return undefined
}

export function getActiveBirthdayPartyBookingPackages(
    catalogue: BirthdayPartyBookingCatalogue,
    channel: BirthdayPartyBookingChannel
) {
    return catalogue.packages
        .filter((partyPackage) => partyPackage.status === 'active')
        .sort((left, right) => left.position! - right.position!)
        .map((partyPackage) => ({
            ...partyPackage,
            creations: partyPackage.creations
                .filter((creation) => creation.status === 'active' && creation.bookingChannels.includes(channel))
                .sort((left, right) => left.bookingOrder - right.bookingOrder),
        }))
        .filter((partyPackage) => partyPackage.creations.length > 0)
}

export function getActiveBirthdayPartyBookingCreationKeys(
    catalogue: BirthdayPartyBookingCatalogue,
    channel: BirthdayPartyBookingChannel
) {
    return new Set(
        getActiveBirthdayPartyBookingPackages(catalogue, channel).flatMap((partyPackage) =>
            partyPackage.creations.map((creation) => creation.key)
        )
    )
}

export function getBirthdayPartyBookingCreationName(catalogue: BirthdayPartyBookingCatalogue, key: string) {
    return catalogue.creations.find((creation) => creation.key === key)?.name
}

function birthdayPartyCreationMatchesSubmittedValue(
    creation: BirthdayPartyBookingCatalogueCreation,
    normalizedValue: string
) {
    return [creation.key, creation.name, ...creation.legacyLabels].some(
        (value) => normalizeBirthdayPartyCreationValue(value) === normalizedValue
    )
}

function normalizeBirthdayPartyCreationValue(value: string) {
    return value.trim().toLocaleLowerCase('en-AU')
}

export function isBirthdayPartyPackageColour(value: unknown): value is BirthdayPartyPackageColour {
    return BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.some((option) => option.value === value)
}

export function isBirthdayPartyPackageColourHex(value: unknown): value is BirthdayPartyPackageColourHex {
    return BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.some((option) => option.hex === value)
}

export function getBirthdayPartyPackageColourHex(colour: BirthdayPartyPackageColour): BirthdayPartyPackageColourHex {
    const option = BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.find((item) => item.value === colour)
    if (!option) throw new Error(`Unsupported birthday party package colour: ${colour}`)
    return option.hex
}

export function getBirthdayPartyPackagePartyName(packageName: string) {
    return `${getBirthdayPartyPackageBaseName(packageName)} Parties`
}

export function getBirthdayPartyPackageCreationsTitle(packageName: string) {
    return `${getBirthdayPartyPackageBaseName(packageName)} Creations`
}

export function getBirthdayPartyPackageImageDescription(packageName: string) {
    return `${getBirthdayPartyPackageBaseName(packageName)} Party Package`
}

function getBirthdayPartyPackageBaseName(packageName: string) {
    return packageName.trim().replace(/\s+Parties$/i, '')
}
