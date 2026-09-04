import type { BirthdayPartyBookingChannel, BirthdayPartyCardColour } from '@fizz-kidz/core'

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
    availability: BirthdayPartyBookingChannel[]
    cards: CatalogueSourceCard[]
    offeringKey: keyof typeof birthdayPartyCatalogueOfferings
}

export type CatalogueSourcePackage = {
    accentColour: string
    blackBackground?: boolean
    caption?: string
    catalogueOrder: number
    customerName: string
    hidePartyImage?: boolean
    key: string
    offerings: CatalogueSourcePackageOffering[]
    staffPackageName: string
    summaryTitle: string
    websiteCardOrder?: string[]
}

const both: BirthdayPartyBookingChannel[] = ['studio', 'mobile']
const studioOnly: BirthdayPartyBookingChannel[] = ['studio']

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
    frozenSparkleSlime: { name: 'Frozen Sparkle Slime' },
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

export const birthdayPartyCataloguePackages: CatalogueSourcePackage[] = [
    {
        accentColour: '#F24DA2',
        catalogueOrder: 0,
        customerName: 'K-Pop Power',
        key: 'kPopPower',
        staffPackageName: 'K-Pop Power Parties',
        summaryTitle: 'Kpop Power Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsStarhexWandsPng', 'pink', 'Starhex Wands')],
                offeringKey: 'starhexWands',
            },
            {
                availability: both,
                cards: [
                    card('websiteCreationsSquishyPocketsPng', 'purple', ['Squishy Kitty Pockets', '(Slime Inside!)']),
                ],
                offeringKey: 'squishyPockets',
            },
            {
                availability: both,
                cards: [card('websiteCreationsHendrixGlitterShinePng', 'blue', 'Huntrix Glitter Shimmer')],
                offeringKey: 'huntrixGlitterShimmer',
            },
            {
                availability: both,
                cards: [card('websiteCreationsGoldenSlimePng', 'yellow', 'Golden Slime')],
                offeringKey: 'goldenSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsHeroPowerChargersPng', 'blue', 'Hero Power Chargers')],
                offeringKey: 'heroPowerChargers',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMoonBeamBraceletsPng', 'pink', 'Moon Beam Bracelets')],
                offeringKey: 'moonBeamBracelets',
            },
            {
                availability: both,
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#F24DA2',
        catalogueOrder: 1,
        customerName: 'Glam',
        key: 'glam',
        staffPackageName: 'Glam Parties',
        summaryTitle: 'Glam Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Sparkling Lip Balm')],
                offeringKey: 'sparklingLipBalm',
            },
            {
                availability: both,
                cards: [card('websiteCreationsGlitterFaceShimmerPng', 'yellow', 'Glitter Face Shimmer')],
                offeringKey: 'glitterFaceShimmer',
            },
            {
                availability: both,
                cards: [card('websiteCreationsRainbowCrystalsPng', 'purple', 'Rainbow Crystals')],
                offeringKey: 'rainbowCrystals',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsBraceletsPng', 'pink', 'Friendship Bracelets')],
                offeringKey: 'friendshipBracelets',
            },
            {
                availability: both,
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                availability: studioOnly,
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                availability: both,
                cards: [card('websiteCreationsRainbowBathBombsPng', 'yellow', 'Rainbow Bath Bombs')],
                offeringKey: 'rainbowBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsUnicornBathCrumblePng', 'blue', 'Unicorn Fizz Crumble')],
                offeringKey: 'unicornBathCrumble',
            },
            {
                availability: both,
                cards: [card('websiteCreationsGlitterHairShimmerPng', 'blue', 'Glitter Hair Shimmer')],
                offeringKey: 'glitterHairShimmer',
            },
        ],
    },
    {
        accentColour: '#43D4F3',
        catalogueOrder: 2,
        customerName: 'Science',
        key: 'science',
        staffPackageName: 'Science Parties',
        summaryTitle: 'Science Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsJellySoapPng', 'yellow', 'Jelly Soap')],
                offeringKey: 'jellySoap',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMonsterExplosionsPng', 'green', 'Monster Explosions')],
                offeringKey: 'monsterExplosions',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFluffySlimeBluePng', 'blue', 'Fluffy Slime')],
                offeringKey: 'fluffySlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsBugsInBathBombsPng', 'green', 'Bugs in Bath Bombs')],
                offeringKey: 'bugsInBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsBubblingVolcanoesPng', 'red', 'Bubbling Volcanoes')],
                offeringKey: 'volcanoes',
            },
            {
                availability: both,
                cards: [card('websiteCreationsDinosaurBathBombsPng', 'green', 'Dinosaur Bath Bombs')],
                offeringKey: 'dinosaurBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFirePotionsPng', 'red', 'Dragon Fire Potions')],
                offeringKey: 'firePotions',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime')],
                offeringKey: 'monsterSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSnakePotionsPng', 'green', 'Slithering Snake Potions')],
                offeringKey: 'snakePotions',
            },
        ],
    },
    {
        accentColour: '#9044E2',
        catalogueOrder: 3,
        customerName: 'Slime',
        hidePartyImage: true,
        key: 'slime',
        staffPackageName: 'Slime Parties',
        summaryTitle: 'Slime Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsBirthdayCakeSlimePng', 'purple', 'Birthday Cake Slime')],
                offeringKey: 'birthdayCakeSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime')],
                offeringKey: 'monsterSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsCandySlimePng', 'blue', 'Candy Slime')],
                offeringKey: 'candySlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsUnicornCloudSlimePng', 'pink', 'Unicorn Cloud Slime')],
                offeringKey: 'unicornCloudSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFluffySlimeBluePng', 'blue', 'Fluffy Slime')],
                offeringKey: 'fluffySlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSpidermanSlimePng', 'red', 'Spiderman Slime')],
                offeringKey: 'spidermanSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMarshmallowSlimePng', 'yellow', 'Marshmallow Slime')],
                offeringKey: 'marshmallowSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSwiftieSlimePng', 'pink', 'Swiftie Slime')],
                offeringKey: 'swiftieSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsRainbowSlimePng', 'purple', 'Rainbow Slime')],
                offeringKey: 'rainbowSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFrozenSparkleSlimeGreenPng', 'green', 'Frozen Sparkle Slime')],
                offeringKey: 'frozenSparkleSlime',
            },
        ],
    },
    {
        accentColour: '#4ED85F',
        catalogueOrder: 4,
        customerName: 'Fairy',
        key: 'fairy',
        staffPackageName: 'Fairy Parties',
        summaryTitle: 'Fairy Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsFairyWandsPng', 'pink', 'Fairy Wands')],
                offeringKey: 'fairyWands',
            },
            {
                availability: both,
                cards: [card('websiteCreationsPixieGlitterPng', 'purple', 'Pixie Glitter Shimmer')],
                offeringKey: 'pixieGlitterShimmer',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFairyBraceletsPng', 'blue', 'Fairy Bracelets')],
                offeringKey: 'fairyBracelets',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Fairy Lip Balm')],
                offeringKey: 'fairyLipBalm',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFairySlimePng', 'pink', 'Fairy Slime')],
                offeringKey: 'fairySlime',
            },
            {
                availability: studioOnly,
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFairyBathBombsPng', 'purple', 'Fairy Bath Bombs')],
                offeringKey: 'fairyBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMarshmallowSlimePng', 'yellow', 'Marshmallow Slime')],
                offeringKey: 'marshmallowSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsGlitterHairShimmerPng', 'blue', 'Fairy Hair Shimmer')],
                offeringKey: 'fairyHairShimmer',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#4ED85F',
        blackBackground: true,
        caption: 'Drizzle, Drop ad Paint your Bear your way!',
        catalogueOrder: 5,
        customerName: 'Fluid Bears',
        key: 'fluidBears',
        staffPackageName: 'Fluid Bear Parties',
        summaryTitle: 'Fluid Bear Creations',
        offerings: [
            {
                availability: both,
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
        catalogueOrder: 6,
        customerName: 'Jungle Safari',
        key: 'safari',
        staffPackageName: 'Jungle Safari Parties',
        summaryTitle: 'Jungle Safari Creations',
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
                availability: both,
                cards: [
                    card('websiteCreationsMonsterSlimePurplePng', 'purple', 'Monster Slime'),
                    card('websiteCreationsMonsterSlimeGreenPng', 'green', 'Monster Slime', {
                        useForBookingChoice: false,
                    }),
                ],
                offeringKey: 'monsterSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsMonsterExplosionsPng', 'green', 'Monster Explosions')],
                offeringKey: 'monsterExplosions',
            },
            {
                availability: both,
                cards: [card('websiteCreationsBugsInBathBombsPng', 'green', 'Bugs in Bath Bombs')],
                offeringKey: 'bugsInBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsDinosaurBathBombsPng', 'green', 'Dinosaur Bath Bombs')],
                offeringKey: 'dinosaurBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsBubblingVolcanoesPng', 'red', 'Bubbling Volcanoes')],
                offeringKey: 'volcanoes',
            },
            {
                availability: both,
                cards: [card('websiteCreationsFirePotionsPng', 'red', 'Dragon Fire Potions')],
                offeringKey: 'firePotions',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSnakePotionsPng', 'green', 'Slithering Snake Potions')],
                offeringKey: 'snakePotions',
            },
        ],
    },
    {
        accentColour: '#F24DA2',
        catalogueOrder: 7,
        customerName: 'Unicorn',
        key: 'unicorn',
        staffPackageName: 'Unicorn Parties',
        summaryTitle: 'Unicorn Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsFairyWandsPng', 'pink', 'Fairy Wands')],
                offeringKey: 'fairyWands',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Unicorn Lip Balm')],
                offeringKey: 'unicornLipBalm',
            },
            {
                availability: both,
                cards: [card('websiteCreationsUnicornBathCrumblePng', 'blue', 'Unicorn Fizz Crumble')],
                offeringKey: 'unicornBathCrumble',
            },
            {
                availability: studioOnly,
                cards: [card('websiteCreationsUnicornSoapPng', 'pink', 'Unicorn Soap')],
                offeringKey: 'unicornSoap',
            },
            {
                availability: both,
                cards: [card('websiteCreationsUnicornBathBombsPng', 'blue', 'Unicorn Bath Bombs (With horns!)')],
                offeringKey: 'unicornBathBombsWithHorns',
            },
            {
                availability: both,
                cards: [card('websiteCreationsUnicornCloudSlimePng', 'pink', 'Unicorn Cloud Slime')],
                offeringKey: 'unicornCloudSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
        ],
    },
    {
        accentColour: '#F7BB35',
        catalogueOrder: 8,
        customerName: 'Tie Dye',
        key: 'tieDye',
        staffPackageName: 'Tie Dye Parties',
        summaryTitle: 'Tie Dye Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsTieDyeToteBagsPng', 'blue', 'Tie Dye Tote Bags')],
                offeringKey: 'tieDyeToteBags',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTieDyePillowPng', 'green', 'Tie Dye Pillow')],
                offeringKey: 'tieDyePillow',
            },
            {
                availability: both,
                cards: [card('websiteCreationsRainbowCrystalsPng', 'purple', 'Rainbow Crystals')],
                offeringKey: 'rainbowCrystals',
            },
            {
                availability: both,
                cards: [card('websiteCreationsRainbowSlimePng', 'purple', 'Rainbow Slime')],
                offeringKey: 'rainbowSlime',
            },
        ],
    },
    {
        accentColour: '#9044E2',
        catalogueOrder: 9,
        customerName: 'Taylor Swift',
        key: 'taylorSwift',
        staffPackageName: 'Taylor Swift Parties',
        summaryTitle: 'Taylor Swift Creations',
        offerings: [
            {
                availability: both,
                cards: [card('websiteCreationsTsBathBombsPng', 'yellow', "'Speak Now' Purple Bath Bombs")],
                offeringKey: 'speakNowPurpleBathbombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsBraceletsPng', 'pink', 'Friendship Bracelets')],
                offeringKey: 'friendshipBracelets',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsRainbowBathBombsPng', 'blue', "'Lover' Rainbow Bath Bombs")],
                offeringKey: 'loverRainbowBathBombs',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsMidnightsSlimePng', 'purple', 'Midnights Slime')],
                offeringKey: 'midnightsSlime',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsLipBalmPng', 'pink', 'Red 1989 Lip Balm')],
                offeringKey: 'red1989LipBalm',
            },
            {
                availability: both,
                cards: [card('websiteCreationsTsFacePaintPng', 'blue', "'Lover' Glitter Face Paint")],
                offeringKey: 'loverGlitterFacePaint',
            },
            {
                availability: both,
                cards: [card('websiteCreationsGlitterFaceShimmerPng', 'yellow', 'Glitter Face Shimmer')],
                offeringKey: 'glitterFaceShimmer',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparklingLipBalmPng', 'purple', 'Sparkling Lip Balm')],
                offeringKey: 'sparklingLipBalm',
            },
            {
                availability: both,
                cards: [card('websiteCreationsSparkleCrownsPng', 'purple', 'Sparkle Crowns')],
                offeringKey: 'sparkleCrowns',
            },
            {
                availability: both,
                cards: [card('websiteCreationsCharmKeyringsPng', 'purple', 'Charm Keyrings')],
                offeringKey: 'charmKeyrings',
            },
        ],
    },
]
