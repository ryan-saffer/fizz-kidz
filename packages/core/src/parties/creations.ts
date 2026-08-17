const GLAM_CREATIONS = {
    sparklingLipBalm: 'Sparkling Lip Balm',
    glitterFaceShimmer: 'Glitter Face Shimmer',
    rainbowCrystals: 'Rainbow Crystals',
    friendshipBracelets: 'Friendship Bracelets',
    charmKeyrings: 'Charm Keyrings',
    fairySlime: 'Fairy Slime',
    unicornSoap: 'Unicorn Soap',
    rainbowBathBombs: 'Rainbow Bath Bombs',
    unicornBathCrumble: 'Unicorn Fizz Crumble',
    glitterHairShimmer: 'Glitter Hair Shimmer',
} as const

const SCIENCE_CREATIONS = {
    jellySoap: 'Jelly Soap',
    monsterExplosions: 'Monster Explosions',
    fluffySlime: 'Fluffy Slime',
    bugsInBathBombs: 'Bugs in Bath Bombs',
    volcanoes: 'Bubbling Volcanoes',
    dinosaurBathBombs: 'Dinosaur Bath Bombs',
    firePotions: 'Dragon Fire Potions',
    monsterSlime: 'Monster Slime',
    snakePotions: 'Slithering Snake Potions',
} as const

const SLIME_CREATIONS = {
    fairySlime: 'Fairy Slime',
    birthdayCakeSlime: 'Birthday Cake Slime',
    monsterSlime: 'Monster Slime',
    candySlime: 'Candy Slime',
    unicornCloudSlime: 'Unicorn Cloud Slime',
    fluffySlime: 'Fluffy Slime',
    spidermanSlime: 'Spiderman Slime',
    marshmallowSlime: 'Marshmallow Slime',
    swiftieSlime: 'Swiftie Slime',
    rainbowSlime: 'Rainbow Slime',
    frozenSparkleSlime: 'Frozen Sparkle Slime',
} as const

const FAIRY_CREATIONS = {
    fairyWands: 'Fairy Wands',
    pixieGlitterShimmer: 'Pixie Glitter Shimmer',
    fairyBracelets: 'Fairy Bracelets',
    fairyLipBalm: 'Fairy Lip Balm',
    fairySlime: 'Fairy Slime',
    unicornSoap: 'Unicorn Soap',
    fairyBathBombs: 'Fairy Bath Bombs',
    marshmallowSlime: 'Marshmallow Slime',
    fairyHairShimmer: 'Fairy Hair Shimmer',
    sparkleCrowns: 'Sparkle Crowns',
} as const

const FLUID_BEAR_CREATIONS = {
    fluidBears: 'Fluid Bears',
} as const

const SAFARI_CREATIONS = {
    monsterSlime: 'Monster Slime',
    monsterExplosions: 'Monster Explosions',
    bugsInBathBombs: 'Bugs in Bath Bombs',
    dinosaurBathBombs: 'Dinosaur Bath Bombs',
    volcanoes: 'Bubbling Volcanoes',
    firePotions: 'Dragon Fire Potions',
    snakePotions: 'Slithering Snake Potions',
} as const

const UNICORN_CREATIONS = {
    fairyWands: 'Fairy Wands',
    unicornLipBalm: 'Unicorn Lip Balm',
    unicornBathCrumble: 'Unicorn Fizz Crumble',
    unicornSoap: 'Unicorn Soap',
    unicornBathBombsWithHorns: 'Unicorn Bath Bombs (With horns!)',
    unicornCloudSlime: 'Unicorn Cloud Slime',
    sparkleCrowns: 'Sparkle Crowns',
} as const

const TIE_DYE_CREATIONS = {
    tieDyeToteBags: 'Tie Dye Tote Bags',
    tieDyePillow: 'Tie Dye Pillow',
    rainbowCrystals: 'Rainbow Crystals',
    rainbowSlime: 'Rainbow Slime',
} as const

const TAYLOR_SWIFT_CREATIONS = {
    speakNowPurpleBathbombs: "'Speak Now' Purple Bath Bombs",
    friendshipBracelets: 'Friendship Bracelets',
    loverRainbowBathBombs: "'Lover' Rainbow Bath Bombs",
    midnightsSlime: 'Midnights Slime',
    red1989LipBalm: 'Red 1989 Lip Balm',
    loverGlitterFacePaint: "'Lover' Glitter Face Paint",
    glitterFaceShimmer: 'Glitter Face Shimmer',
    sparklingLipBalm: 'Sparkling Lip Balm',
    sparkleCrowns: 'Sparkle Crowns',
    charmKeyrings: 'Charm Keyrings',
} as const

const K_POP_POWER_CREATIONS = {
    starhexWands: 'Starhex Wands',
    squishyPockets: 'Squishy Kitty Pockets (Slime Inside!)',
    huntrixGlitterShimmer: 'Huntrix Glitter Shimmer',
    goldenSlime: 'Golden Slime',
    heroPowerChargers: 'Hero Power Chargers',
    moonBeamBracelets: 'Moon Beam Bracelets',
    charmKeyrings: 'Charm Keyrings',
    sparkleCrowns: 'Sparkle Crowns',
} as const

export const CREATION_PACKAGES = {
    glam: GLAM_CREATIONS,
    science: SCIENCE_CREATIONS,
    slime: SLIME_CREATIONS,
    fairy: FAIRY_CREATIONS,
    fluidBears: FLUID_BEAR_CREATIONS,
    safari: SAFARI_CREATIONS,
    unicorn: UNICORN_CREATIONS,
    tieDye: TIE_DYE_CREATIONS,
    taylorSwift: TAYLOR_SWIFT_CREATIONS,
    kPopPower: K_POP_POWER_CREATIONS,
} as const

export const CREATION_PACKAGE_DISPLAY_NAMES: Record<keyof typeof CREATION_PACKAGES, string> = {
    glam: 'Glam',
    science: 'Science',
    slime: 'Slime',
    fairy: 'Fairy',
    fluidBears: 'Fluid Bears',
    safari: 'Jungle Safari',
    unicorn: 'Unicorn',
    tieDye: 'Tie Dye',
    taylorSwift: 'Taylor Swift',
    kPopPower: 'K-Pop Power',
}

export const ACTIVE_CREATIONS = {
    ...GLAM_CREATIONS,
    ...SCIENCE_CREATIONS,
    ...SLIME_CREATIONS,
    ...FAIRY_CREATIONS,
    ...FLUID_BEAR_CREATIONS,
    ...SAFARI_CREATIONS,
    ...UNICORN_CREATIONS,
    ...TIE_DYE_CREATIONS,
    ...TAYLOR_SWIFT_CREATIONS,
    ...K_POP_POWER_CREATIONS,
} as const

const DEPRECATED_CREATIONS = {
    animalSoap: 'Animal Soap',
    animalsInBathBombs: 'Animals in Bath Bombs',
    animalsInSoap: 'Animals in Soap',
    bathBombs: 'Fizzy Bath Bombs',
    bugsInSoap: 'Bugs in Soap',
    butterflySoap: 'Butterfly Soap',
    crunchySlime: 'Crunchy Slime',
    dinosaurFossils: 'Dinosaur Fossils',
    dinosaurSoap: 'Dinosaur Soap',
    evermoreSlime: 'Evermore Slime',
    expertCrunchySlime: 'Expert Crunchy Slime',
    expertGalaxyBathBombs: 'Expert Galaxy Bath-Bombs',
    expertGalaxySlime: 'Expert Galaxy Slime',
    expertRainbowBathBombs: 'Expert Rainbow Bath-Bombs',
    expertRainbowSlime: 'Expert Rainbow Slime',
    expertRainbowSoap: 'Expert Rainbow Soap',
    expertWatermelonBathBombs: 'Expert Watermelon Bath-Bombs',
    fairyGlitterSlime: 'Fairy Glitter Slime',
    fairyHairGel: 'Fairy Hair Gel',
    fearlessGoldSlime: 'Fearless Gold Slime',
    folkloreButterflySoap: 'Folklore Butterfly Soap',
    galaxySlime: 'Galaxy Slime',
    galaxySoap: 'Galaxy Soap',
    glitterFacePaint: 'Glitter Face Paint',
    glitterHairGel: 'Glitter Hair Gel',
    glitterSlime: 'Glitter Slime',
    glitterSoap: 'Glitter Soap',
    glowCrowns: 'Glow Crowns',
    goldSlime: 'Gold Slime',
    hendrixGlitterShine: 'Huntrix Glitter Shine',
    instantSnowSlime: 'Instant Snow Slime',
    lavaBathCrystals: 'Lava Bath Crystals',
    lavaLamps: 'Lava Lamps',
    lipBalm: 'Sparkling Lip-Balm',
    loverTieDyeScrunchies: "'Lover' Tie Dye Scrunchies",
    magicQuickSand: 'Magic Quick Sand',
    magicSand: 'Magic Sand',
    marbleCrystals: 'Marble Crystals',
    mermaidSugarScrub: 'Mermaid Sugar Scrub',
    monsterBrains: 'Monster Brains',
    nutellaSlime: 'Nutella Slime',
    perfume: 'Shining Perfume',
    pixieGlitter: 'Pixie Glitter',
    rainbowBathCrystals: 'Rainbow Bath Crystals',
    rainbowSoap: 'Rainbow Soap',
    sandSlime: 'Sand Slime',
    slimeLab: 'Slime Lab',
    soap: 'Sparkling Soap',
    squishiePockets: 'Squishy Kitty Pockets',
    starSlayClips: 'Star Slay Clips',
    stringSlime: 'String Slime',
    sugarScrubLipBalm: 'Sugar Lip Scrub',
    tieDyeScrunchie: 'Tie Dye Scrunchie',
    tieDyeSoap: 'Tie Dye Soap',
    tieDyeSocks: 'Tie Dye Socks',
    unicornBathBombs: 'Unicorn Bath Bombs',
    unicornBathCrystals: 'Unicorn Bath Crystals',
    unicornBathShimmer: 'Unicorn Bath Shimmer',
    unicornBubbleBath: 'Unicorn Bubble Bath',
    unicornGalaxySlime: 'Unicorn Galaxy Slime',
    unicornGlitterShimmer: 'Unicorn Glitter Shimmer',
    unicornSlime: 'Unicorn Slime',
    wobblyGalaxySoap: 'Wobbly Galaxy Soap',
    wobblySoap: 'Wobbly Soap',
    wobblyStarSoap: 'Wobbly Star Soap',
    wondersticks: 'Wondersticks',
} as const

export const CREATIONS = {
    ...ACTIVE_CREATIONS,
    ...DEPRECATED_CREATIONS,
} as const

export type ActiveCreation = keyof typeof ACTIVE_CREATIONS
export type Creation = keyof typeof CREATIONS

export type CreationInstructions = {
    name: string
    markdown: string
}

export const PARTY_PACKAGE_COLOURS = ['pink', 'blue', 'yellow', 'green', 'purple'] as const

export type PartyPackageColour = (typeof PARTY_PACKAGE_COLOURS)[number]

export type CreationInstructionGroup = {
    name: string
    colour?: PartyPackageColour
    creations: CreationInstructions[]
}
