import type {
    BirthdayPartyBookingChannel,
    BirthdayPartyCardColour,
    BirthdayPartyPackageColour,
    BirthdayPartyPackageColourHex,
} from '@fizz-kidz/core'

export type CatalogueSourceCard = {
    alt: string
    colour: BirthdayPartyCardColour
    imageKey: string
    label: string[]
    useForBookingChoice: boolean
}

export type CatalogueSourceOffering = {
    legacyLabels?: string[]
    name: string
    recipeName?: string
}

export type CatalogueSourcePackageOffering = {
    cards: CatalogueSourceCard[]
    offeringKey: keyof typeof birthdayPartyCatalogueOfferings
}

export type CatalogueSourcePackage = {
    accentColour: BirthdayPartyPackageColourHex
    blackBackground?: boolean
    caption?: string
    position: number
    hidePartyImage?: boolean
    key: string
    name: string
    offerings: CatalogueSourcePackageOffering[]
    primaryColour: BirthdayPartyPackageColour
    websiteCardOrder?: string[]
}

function card(
    imageKey: string,
    colour: BirthdayPartyCardColour,
    label: string | string[],
    options: { alt?: string; useForBookingChoice?: boolean } = {}
): CatalogueSourceCard {
    const labelLines = Array.isArray(label) ? label : label ? [label] : []
    return {
        alt: options.alt ?? `${labelLines.join(' ')} creation`,
        colour,
        imageKey,
        label: labelLines,
        useForBookingChoice: options.useForBookingChoice ?? true,
    }
}

export const birthdayPartyCatalogueOfferings = {
    birthdayCakeSlime: { name: 'Birthday Cake Slime', recipeName: 'Birthday Cake Slime' },
    bugsInBathBombs: { name: 'Bugs in Bath Bombs', recipeName: 'Bugs In Bath Bombs' },
    candySlime: { name: 'Candy Slime', recipeName: 'Candy Slime' },
    charmKeyrings: { name: 'Charm Keyrings', recipeName: 'Charm Keyrings' },
    dinosaurBathBombs: { name: 'Dinosaur Bath Bombs', recipeName: 'Dinosaur Bath Bombs' },
    fairyBathBombs: { name: 'Fairy Bath Bombs', recipeName: 'Fairy Bath Bombs' },
    fairyBracelets: { name: 'Fairy Bracelets', recipeName: 'Fairy Bracelets' },
    fairyHairShimmer: {
        name: 'Fairy Hair Shimmer',
        recipeName: 'Glitter Shimmer / Glitter Hair Shimmer / Pixie Glitter',
    },
    fairyLipBalm: { name: 'Fairy Lip Balm', recipeName: 'Lip Balm' },
    fairySlime: {
        legacyLabels: ['Fairy Glitter Slime'],
        name: 'Fairy Slime',
        recipeName: 'Fairy Slime',
    },
    fairyWands: { name: 'Fairy Wands', recipeName: 'Fairy Wands' },
    firePotions: { name: 'Dragon Fire Potions', recipeName: 'Dragon Fire Potions' },
    fluidBears: { name: 'Fluid Bears', recipeName: 'Fluid Bears' },
    fluffySlime: { name: 'Fluffy Slime', recipeName: 'Fluffy Slime' },
    friendshipBracelets: { name: 'Friendship Bracelets', recipeName: 'Friendship Bracelets' },
    frozenSparkleSlime: { name: 'Frozen Sparkle Slime', recipeName: 'Instant Snow Slime' },
    glitterFaceShimmer: {
        name: 'Glitter Face Shimmer',
        recipeName: 'Glitter Shimmer / Glitter Hair Shimmer / Pixie Glitter',
    },
    glitterHairShimmer: {
        name: 'Glitter Hair Shimmer',
        recipeName: 'Glitter Shimmer / Glitter Hair Shimmer / Pixie Glitter',
    },
    goldenSlime: { name: 'Golden Slime', recipeName: 'Golden Slime' },
    heroPowerChargers: { name: 'Hero Power Chargers', recipeName: 'Hero Power Chargers' },
    huntrixGlitterShimmer: {
        name: 'Huntrix Glitter Shimmer',
        recipeName: 'Huntrix Glitter Shine',
    },
    jellySoap: { name: 'Jelly Soap', recipeName: 'Jelly Soap' },
    loverGlitterFacePaint: {
        name: "'Lover' Glitter Face Paint",
        recipeName: 'Glitter Shimmer / Glitter Hair Shimmer / Pixie Glitter',
    },
    loverRainbowBathBombs: { name: "'Lover' Rainbow Bath Bombs", recipeName: 'Rainbow Bath Bombs' },
    marshmallowSlime: { name: 'Marshmallow Slime', recipeName: 'Marshmallow Slime' },
    midnightsSlime: { name: 'Midnights Slime', recipeName: 'Midnights Slime' },
    monsterExplosions: { name: 'Monster Explosions', recipeName: 'Monster Explosions' },
    monsterSlime: { name: 'Monster Slime', recipeName: 'Monster Slime' },
    moonBeamBracelets: {
        name: 'Moon Beam Bracelets',
        recipeName: 'Moon Beam Bracelets (Glow In the dark)',
    },
    pixieGlitterShimmer: {
        name: 'Pixie Glitter Shimmer',
        recipeName: 'Glitter Shimmer / Glitter Hair Shimmer / Pixie Glitter',
    },
    rainbowBathBombs: { name: 'Rainbow Bath Bombs', recipeName: 'Rainbow Bath Bombs' },
    rainbowCrystals: { name: 'Rainbow Crystals', recipeName: 'Rainbow Crystals' },
    rainbowSlime: { name: 'Rainbow Slime', recipeName: 'Rainbow Slime' },
    red1989LipBalm: { name: 'Red 1989 Lip Balm', recipeName: 'Lip Balm' },
    snakePotions: { name: 'Slithering Snake Potions', recipeName: 'Slithering Snake Potions' },
    sparklingLipBalm: { name: 'Sparkling Lip Balm', recipeName: 'Lip Balm' },
    sparkleCrowns: { name: 'Sparkle Crowns', recipeName: 'Sparkle Crowns' },
    speakNowPurpleBathbombs: { name: "'Speak Now' Purple Bath Bombs", recipeName: 'Fizzy Bath Bombs' },
    spidermanSlime: { name: 'Spiderman Slime', recipeName: 'Spiderman Slime' },
    squishyPockets: {
        name: 'Squishy Kitty Pockets (Slime Inside!)',
        recipeName: 'Squishy Kitty Pockets',
    },
    starhexWands: { name: 'Starhex Wands', recipeName: 'Starhex Wands' },
    swiftieSlime: { name: 'Swiftie Slime', recipeName: "Taylor Swift 'Swiftie' Parties" },
    tieDyePillow: { name: 'Tie Dye Pillow', recipeName: 'Tie Dye' },
    tieDyeToteBags: { name: 'Tie Dye Tote Bags', recipeName: 'Tie Dye' },
    unicornBathBombsWithHorns: {
        name: 'Unicorn Bath Bombs (With horns!)',
        recipeName: 'Unicorn Bath Bombs',
    },
    unicornBathCrumble: { name: 'Unicorn Fizz Crumble', recipeName: 'Unicorn Fizz Crumble' },
    unicornCloudSlime: { name: 'Unicorn Cloud Slime', recipeName: 'Unicorn Cloud Slime' },
    unicornLipBalm: { name: 'Unicorn Lip Balm', recipeName: 'Lip Balm' },
    unicornSoap: { name: 'Unicorn Soap', recipeName: 'Unicorn Soap' },
    volcanoes: { name: 'Bubbling Volcanoes', recipeName: 'Bubbling Volcanoes' },
} satisfies Record<string, CatalogueSourceOffering>

export const birthdayPartyCatalogueStudioOnlyCreationKeys = [
    'jellySoap',
    'unicornSoap',
] as const satisfies readonly (keyof typeof birthdayPartyCatalogueOfferings)[]

const studioOnlyCreationKeys = new Set<keyof typeof birthdayPartyCatalogueOfferings>(
    birthdayPartyCatalogueStudioOnlyCreationKeys
)

export function getBirthdayPartyCatalogueBookingChannels(
    creationKey: keyof typeof birthdayPartyCatalogueOfferings
): BirthdayPartyBookingChannel[] {
    return studioOnlyCreationKeys.has(creationKey) ? ['studio'] : ['studio', 'mobile']
}

export const birthdayPartyCataloguePackages: CatalogueSourcePackage[] = [
    {
        accentColour: '#F24DA2',
        position: 4,
        key: 'kPopPower',
        name: 'K-Pop Power',
        primaryColour: 'purple',
        offerings: [
            {
                cards: [card('websiteCreationsStarhexWandsPng', 'pink', 'Starhex Wands')],
                offeringKey: 'starhexWands',
            },
            {
                cards: [
                    card('websiteCreationsSquishyPocketsPng', 'purple', ['Squishy Kitty Pockets', '(Slime Inside!)']),
                ],
                offeringKey: 'squishyPockets',
            },
            {
                cards: [card('websiteCreationsHendrixGlitterShinePng', 'blue', 'Huntrix Glitter Shimmer')],
                offeringKey: 'huntrixGlitterShimmer',
            },
            {
                cards: [card('websiteCreationsGoldenSlimePng', 'yellow', 'Golden Slime')],
                offeringKey: 'goldenSlime',
            },
            {
                cards: [card('websiteCreationsHeroPowerChargersPng', 'blue', 'Hero Power Chargers')],
                offeringKey: 'heroPowerChargers',
            },
            {
                cards: [card('websiteCreationsMoonBeamBraceletsPng', 'pink', 'Moon Beam Bracelets')],
                offeringKey: 'moonBeamBracelets',
            },
            {
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
            {
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#F24DA2',
        position: 1,
        key: 'glam',
        name: 'Glam',
        primaryColour: 'pink',
        offerings: [
            {
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Sparkling Lip Balm')],
                offeringKey: 'sparklingLipBalm',
            },
            {
                cards: [card('websiteCreationsGlitterFaceShimmerPng', 'yellow', 'Glitter Face Shimmer')],
                offeringKey: 'glitterFaceShimmer',
            },
            {
                cards: [card('websiteCreationsRainbowCrystalsPng', 'purple', 'Rainbow Crystals')],
                offeringKey: 'rainbowCrystals',
            },
            {
                cards: [card('websiteCreationsTsBraceletsPng', 'pink', 'Friendship Bracelets')],
                offeringKey: 'friendshipBracelets',
            },
            {
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
            {
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                cards: [card('websiteCreationsRainbowBathBombsPng', 'yellow', 'Rainbow Bath Bombs')],
                offeringKey: 'rainbowBathBombs',
            },
            {
                cards: [card('websiteCreationsUnicornBathCrumblePng', 'blue', 'Unicorn Fizz Crumble')],
                offeringKey: 'unicornBathCrumble',
            },
            {
                cards: [card('websiteCreationsGlitterHairShimmerPng', 'blue', 'Glitter Hair Shimmer')],
                offeringKey: 'glitterHairShimmer',
            },
        ],
    },
    {
        accentColour: '#4DC5DA',
        position: 2,
        key: 'science',
        name: 'Science',
        primaryColour: 'blue',
        offerings: [
            {
                cards: [card('websiteCreationsJellySoapPng', 'yellow', 'Jelly Soap')],
                offeringKey: 'jellySoap',
            },
            {
                cards: [card('websiteCreationsMonsterExplosionsPng', 'green', 'Monster Explosions')],
                offeringKey: 'monsterExplosions',
            },
            {
                cards: [card('websiteCreationsFluffySlimeBluePng', 'blue', 'Fluffy Slime')],
                offeringKey: 'fluffySlime',
            },
            {
                cards: [card('websiteCreationsBugsInBathBombsPng', 'green', 'Bugs in Bath Bombs')],
                offeringKey: 'bugsInBathBombs',
            },
            {
                cards: [card('websiteCreationsBubblingVolcanoesPng', 'red', 'Bubbling Volcanoes')],
                offeringKey: 'volcanoes',
            },
            {
                cards: [card('websiteCreationsDinosaurBathBombsPng', 'green', 'Dinosaur Bath Bombs')],
                offeringKey: 'dinosaurBathBombs',
            },
            {
                cards: [card('websiteCreationsFirePotionsPng', 'red', 'Dragon Fire Potions')],
                offeringKey: 'firePotions',
            },
            {
                cards: [card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime')],
                offeringKey: 'monsterSlime',
            },
            {
                cards: [card('websiteCreationsSnakePotionsPng', 'green', 'Slithering Snake Potions')],
                offeringKey: 'snakePotions',
            },
        ],
    },
    {
        accentColour: '#9044E2',
        position: 3,
        hidePartyImage: true,
        key: 'slime',
        name: 'Slime',
        primaryColour: 'purple',
        offerings: [
            {
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                cards: [card('websiteCreationsBirthdayCakeSlimePng', 'purple', 'Birthday Cake Slime')],
                offeringKey: 'birthdayCakeSlime',
            },
            {
                cards: [card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime')],
                offeringKey: 'monsterSlime',
            },
            {
                cards: [card('websiteCreationsCandySlimePng', 'blue', 'Candy Slime')],
                offeringKey: 'candySlime',
            },
            {
                cards: [card('websiteCreationsUnicornCloudSlimePng', 'pink', 'Unicorn Cloud Slime')],
                offeringKey: 'unicornCloudSlime',
            },
            {
                cards: [card('websiteCreationsFluffySlimeBluePng', 'blue', 'Fluffy Slime')],
                offeringKey: 'fluffySlime',
            },
            {
                cards: [card('websiteCreationsSpidermanSlimePng', 'red', 'Spiderman Slime')],
                offeringKey: 'spidermanSlime',
            },
            {
                cards: [card('websiteCreationsMarshmallowSlimePng', 'yellow', 'Marshmallow Slime')],
                offeringKey: 'marshmallowSlime',
            },
            {
                cards: [card('websiteCreationsSwiftieSlimePng', 'pink', 'Swiftie Slime')],
                offeringKey: 'swiftieSlime',
            },
            {
                cards: [card('websiteCreationsRainbowSlimePng', 'purple', 'Rainbow Slime')],
                offeringKey: 'rainbowSlime',
            },
            {
                cards: [card('websiteCreationsFrozenSparkleSlimeGreenPng', 'green', 'Frozen Sparkle Slime')],
                offeringKey: 'frozenSparkleSlime',
            },
        ],
    },
    {
        accentColour: '#4ED85F',
        position: 5,
        key: 'fairy',
        name: 'Fairy',
        primaryColour: 'pink',
        offerings: [
            {
                cards: [card('websiteCreationsFairyWandsPng', 'pink', 'Fairy Wands')],
                offeringKey: 'fairyWands',
            },
            {
                cards: [card('websiteCreationsPixieGlitterPng', 'purple', 'Pixie Glitter Shimmer')],
                offeringKey: 'pixieGlitterShimmer',
            },
            {
                cards: [card('websiteCreationsFairyBraceletsPng', 'blue', 'Fairy Bracelets')],
                offeringKey: 'fairyBracelets',
            },
            {
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Fairy Lip Balm')],
                offeringKey: 'fairyLipBalm',
            },
            {
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                cards: [card('websiteCreationsFairyBathBombsPng', 'purple', 'Fairy Bath Bombs')],
                offeringKey: 'fairyBathBombs',
            },
            {
                cards: [card('websiteCreationsMarshmallowSlimePng', 'yellow', 'Marshmallow Slime')],
                offeringKey: 'marshmallowSlime',
            },
            {
                cards: [card('websiteCreationsGlitterHairShimmerPng', 'blue', 'Fairy Hair Shimmer')],
                offeringKey: 'fairyHairShimmer',
            },
            {
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#4ED85F',
        blackBackground: true,
        caption: 'Drizzle, Drop ad Paint your Bear your way!',
        position: 6,
        key: 'fluidBears',
        name: 'Fluid Bears',
        primaryColour: 'black',
        offerings: [
            {
                cards: [
                    card('websiteCreationsFluidBears1Png', 'green', '', {
                        alt: 'Green fluid bear example',
                    }),
                    card('websiteCreationsFluidBears2Png', 'purple', '', {
                        alt: 'Purple fluid bear example',
                        useForBookingChoice: false,
                    }),
                    card('websiteCreationsFluidBears3Png', 'pink', '', {
                        alt: 'Pink fluid bear example',
                        useForBookingChoice: false,
                    }),
                    card('websiteCreationsFluidBears4Png', 'blue', '', {
                        alt: 'Blue fluid bear example',
                        useForBookingChoice: false,
                    }),
                    card('websiteCreationsFluidBears5Png', 'green', '', {
                        alt: 'Green and yellow fluid bear example',
                        useForBookingChoice: false,
                    }),
                    card('websiteCreationsFluidBears6Png', 'yellow', '', {
                        alt: 'Yellow fluid bear example',
                        useForBookingChoice: false,
                    }),
                ],
                offeringKey: 'fluidBears',
            },
        ],
    },
    {
        accentColour: '#4ED85F',
        position: 7,
        key: 'safari',
        name: 'Jungle Safari',
        primaryColour: 'green',
        websiteCardOrder: [
            'websiteCreationsMonsterSlimePurplePng',
            'websiteCreationsMonsterExplosionsPng',
            'websiteCreationsBugsInBathBombsPng',
            'websiteCreationsMonsterSlimeGreenPng',
            'websiteCreationsDinosaurBathBombsPng',
            'websiteCreationsBubblingVolcanoesPng',
            'websiteCreationsFirePotionsPng',
            'websiteCreationsSnakePotionsPng',
        ],
        offerings: [
            {
                cards: [
                    card('websiteCreationsMonsterSlimePurplePng', 'purple', 'Monster Slime'),
                    card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime', {
                        useForBookingChoice: false,
                    }),
                ],
                offeringKey: 'monsterSlime',
            },
            {
                cards: [card('websiteCreationsMonsterExplosionsPng', 'green', 'Monster Explosions')],
                offeringKey: 'monsterExplosions',
            },
            {
                cards: [card('websiteCreationsBugsInBathBombsPng', 'green', 'Bugs in Bath Bombs')],
                offeringKey: 'bugsInBathBombs',
            },
            {
                cards: [card('websiteCreationsDinosaurBathBombsPng', 'green', 'Dinosaur Bath Bombs')],
                offeringKey: 'dinosaurBathBombs',
            },
            {
                cards: [card('websiteCreationsBubblingVolcanoesPng', 'red', 'Bubbling Volcanoes')],
                offeringKey: 'volcanoes',
            },
            {
                cards: [card('websiteCreationsFirePotionsPng', 'red', 'Dragon Fire Potions')],
                offeringKey: 'firePotions',
            },
            {
                cards: [card('websiteCreationsSnakePotionsPng', 'green', 'Slithering Snake Potions')],
                offeringKey: 'snakePotions',
            },
        ],
    },
    {
        accentColour: '#F24DA2',
        position: 8,
        key: 'unicorn',
        name: 'Unicorn',
        primaryColour: 'pink',
        offerings: [
            {
                cards: [card('websiteCreationsFairyWandsPng', 'pink', 'Fairy Wands')],
                offeringKey: 'fairyWands',
            },
            {
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Unicorn Lip Balm')],
                offeringKey: 'unicornLipBalm',
            },
            {
                cards: [card('websiteCreationsUnicornBathCrumblePng', 'blue', 'Unicorn Fizz Crumble')],
                offeringKey: 'unicornBathCrumble',
            },
            {
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                cards: [card('websiteCreationsUnicornBathBombsPng', 'blue', 'Unicorn Bath Bombs (With horns!)')],
                offeringKey: 'unicornBathBombsWithHorns',
            },
            {
                cards: [card('websiteCreationsUnicornCloudSlimePng', 'pink', 'Unicorn Cloud Slime')],
                offeringKey: 'unicornCloudSlime',
            },
            {
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#F6BA33',
        position: 9,
        key: 'tieDye',
        name: 'Tie Dye',
        primaryColour: 'pink',
        offerings: [
            {
                cards: [card('websiteCreationsTieDyeToteBagsPng', 'blue', 'Tie Dye Tote Bags')],
                offeringKey: 'tieDyeToteBags',
            },
            {
                cards: [card('websiteCreationsTieDyePillowPng', 'green', 'Tie Dye Pillow')],
                offeringKey: 'tieDyePillow',
            },
            {
                cards: [card('websiteCreationsRainbowCrystalsPng', 'purple', 'Rainbow Crystals')],
                offeringKey: 'rainbowCrystals',
            },
            {
                cards: [card('websiteCreationsRainbowSlimePng', 'purple', 'Rainbow Slime')],
                offeringKey: 'rainbowSlime',
            },
        ],
    },
    {
        accentColour: '#9044E2',
        position: 10,
        key: 'taylorSwift',
        name: 'Taylor Swift',
        primaryColour: 'purple',
        offerings: [
            {
                cards: [card('websiteCreationsTsBathBombsPng', 'yellow', "'Speak Now' Purple Bath Bombs")],
                offeringKey: 'speakNowPurpleBathbombs',
            },
            {
                cards: [card('websiteCreationsTsBraceletsPng', 'pink', 'Friendship Bracelets')],
                offeringKey: 'friendshipBracelets',
            },
            {
                cards: [card('websiteCreationsTsRainbowBathBombsPng', 'blue', "'Lover' Rainbow Bath Bombs")],
                offeringKey: 'loverRainbowBathBombs',
            },
            {
                cards: [card('websiteCreationsTsMidnightsSlimePng', 'purple', 'Midnights Slime')],
                offeringKey: 'midnightsSlime',
            },
            {
                cards: [card('websiteCreationsTsLipBalmPng', 'pink', 'Red 1989 Lip Balm')],
                offeringKey: 'red1989LipBalm',
            },
            {
                cards: [card('websiteCreationsTsFacePaintPng', 'blue', "'Lover' Glitter Face Paint")],
                offeringKey: 'loverGlitterFacePaint',
            },
            {
                cards: [card('websiteCreationsGlitterFaceShimmerPng', 'yellow', 'Glitter Face Shimmer')],
                offeringKey: 'glitterFaceShimmer',
            },
            {
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Sparkling Lip Balm')],
                offeringKey: 'sparklingLipBalm',
            },
            {
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
            {
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
        ],
    },
]
