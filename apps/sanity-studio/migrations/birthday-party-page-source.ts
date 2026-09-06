type FeatureCardSource = {
    colour: 'white'
    imageAlt: string
    imageKey: string
    label: readonly string[]
}

type FeatureSource = {
    description: string
    headingImageAlt: string
    headingImageKey: string
    key: string
    cards: readonly FeatureCardSource[]
}

export type BirthdayPartyPageSource = {
    creationsImageKey?: string
    features?: readonly FeatureSource[]
    hero: {
        description: string
        imageAlt: string
        imageKey: string
        subtitle: string
        title: string
    }
    key: string
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
        imageAlt: string
        imageKey: string
    }
}

export const birthdayPartyPageSource = [
    {
        key: 'glam',
        slug: 'glam-parties',
        seo: {
            title: 'Kids Glam Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A glittery kids glam birthday party with guided craft and take-home creations at Fizz Kidz studios in Melbourne and Geelong for children aged 4 to 12.',
            serviceName: 'Kids Glam Birthday Party',
        },
        hero: {
            title: 'Glam Kids Birthday Party',
            subtitle: "Bring the glitter, sparkles and fun to your child's next party!",
            description:
                'Make your very own sparkling and dazzling pamper products to take home with you after the party!',
            imageKey: 'websitePagesPartiesGlamPartiesJpg',
            imageAlt: 'hands holding colourful body glitter containers',
        },
        creationsImageKey: 'websitePagesPartiesPackagesGlitzAndGlamPng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesGlitzAndGlamPng',
            imageAlt: 'hands with lip balm',
        },
    },
    {
        key: 'science',
        slug: 'science-parties',
        seo: {
            title: 'Kids Science Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A hands-on kids science birthday party with experiments and take-home creations, hosted by Fizz Kidz at studios across Melbourne and Geelong.',
            serviceName: 'Kids Science Birthday Party',
        },
        hero: {
            title: 'Kids Science Birthday Parties',
            subtitle: 'Fizz, Bubble, Explode! For all the little scientists out there, this is for you!',
            description: 'Fizz Kidz science birthday parties are scientifically proven to be fizzing fantastic!',
            imageKey: 'websitePagesPartiesSciencePartyJpg',
            imageAlt: 'a kid in awe as her science experiment bubbles',
        },
        creationsImageKey: 'websitePagesPartiesPackagesSciencePng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesSciencePng',
            imageAlt: 'bubbling volcano',
        },
    },
    {
        key: 'slime',
        slug: 'slime-parties',
        seo: {
            title: 'Kids Slime Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A hosted slime birthday party where kids mix, customise and take home their own slime creations at Fizz Kidz studios across Melbourne and Geelong.',
            serviceName: 'Kids Slime Birthday Party',
        },
        hero: {
            title: 'Kids Slime Birthday Parties',
            subtitle: 'Slime, slime and more slime!',
            description:
                'For all the slime lovers out there, we love slime just as much! Together lets get messy and make the most perfect slimes!',
            imageKey: 'websitePagesPartiesSlimePartyJpg',
            imageAlt: 'a kid holding a long stretch of slime and smiling',
        },
        creationsImageKey: 'websitePagesPartiesSlimeCreationsHeroPng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesSlimePng',
            imageAlt: 'girl holding slime and smiling',
        },
        features: [
            {
                key: 'slimeLab',
                headingImageKey: 'websitePagesPartiesSlimeLabPng',
                headingImageAlt: 'Slime Lab',
                description:
                    "Are you slime obsessed and would like to design your slime friom scratch? Sounds great! Choose 'Slime Lab' and custom design your personalised slime!",
                cards: [
                    {
                        imageKey: 'websiteCreationsSlimeBasePng',
                        imageAlt: 'Slime base options',
                        label: ['Choose your base'],
                        colour: 'white',
                    },
                    {
                        imageKey: 'websiteCreationsSlimeColourPng',
                        imageAlt: 'Slime colour options',
                        label: ['Choose your colour'],
                        colour: 'white',
                    },
                    {
                        imageKey: 'websiteCreationsSlimeAddInsPng',
                        imageAlt: 'Slime add-in options',
                        label: ['Choose your add ins'],
                        colour: 'white',
                    },
                ],
            },
        ],
    },
    {
        key: 'kPopPower',
        slug: 'k-pop-power-parties',
        seo: {
            title: 'K-Pop Power Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A high-energy K-Pop Power birthday party with music-inspired craft and take-home creations at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'K-Pop Power Birthday Party',
        },
        hero: {
            title: 'Kids K-Pop Power Parties',
            subtitle: 'The ultimate K-Pop party experience!',
            description: 'Step into a world of magic and music where K-Pop energy meets fantasy adventure!',
            imageKey: 'websitePagesPartiesKPopDemonHuntersPartyPng',
            imageAlt: 'Colourful K-Pop Power party creations',
        },
        creationsImageKey: 'websitePagesPartiesPackagesKPopDemonHuntersPng',
        navigation: { isNew: true },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesKPopDemonHuntersPng',
            imageAlt: 'k-pop power wand',
        },
    },
    {
        key: 'fairy',
        slug: 'fairy-parties',
        seo: {
            title: 'Fairy Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A hands-on fairy birthday party with magical craft, slime and take-home creations for kids aged 4 to 12 at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Fairy Birthday Party',
        },
        hero: {
            title: 'Fairy Kids Birthday Parties',
            subtitle: 'Welcome to the magical world of fairies!',
            description: 'Here we love everything sparkles, glitter and magic!',
            imageKey: 'websitePagesPartiesFairyPartyWebp',
            imageAlt: 'Colourful fairy-themed soaps and craft creations',
        },
        creationsImageKey: 'websitePagesPartiesPackagesFairiesPng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesFairiesPng',
            imageAlt: 'colourful fairy creations',
        },
    },
    {
        key: 'fluidBears',
        slug: 'fluid-bears-parties',
        seo: {
            title: 'Fluid Bears Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A colourful Fluid Bears birthday party where kids create drip-art bear keyrings and take-home projects at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Fluid Bears Birthday Party',
        },
        hero: {
            title: 'Fluid Bears Kids Birthday Parties',
            subtitle: 'Mesmerizing Drip Art Fun!',
            description:
                "Design your very own awesome bear keyring by dripping vibrant paint for a one-of-a-kind masterpiece that's yours to take home!",
            imageKey: 'websitePagesPartiesFluidBearsPartyPng',
            imageAlt: 'A child creating colourful fluid bear drip art',
        },
        creationsImageKey: 'websitePagesPartiesPackagesFluidBearsWhitePng',
        navigation: { isNew: true },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesFluidBearsBlackPng',
            imageAlt: 'A Fizz kids staff holding a box',
        },
    },
    {
        key: 'safari',
        slug: 'jungle-safari-parties',
        seo: {
            title: 'Jungle Safari Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A jungle-themed kids birthday party with guided science, slime, bath bomb and potion creations at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Jungle Safari Birthday Party',
        },
        hero: {
            title: 'Jungle Safari Kids Birthday Parties',
            subtitle: 'Roar! Welcome to the jungle!',
            description: 'Join the safari adventure and make your own jungle creations!',
            imageKey: 'websitePagesPartiesSafariPartyJpg',
            imageAlt: 'Children enjoying a jungle-themed Fizz Kidz party',
        },
        creationsImageKey: 'websiteCreationsBubblingVolcanoesPng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesSafariPng',
            imageAlt: 'a frog in a bath bomb',
        },
    },
    {
        key: 'unicorn',
        slug: 'unicorn-parties',
        seo: {
            title: 'Unicorn Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A magical unicorn birthday party with glittery craft, slime and take-home creations for children aged 4 to 12 at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Unicorn Birthday Party',
        },
        hero: {
            title: 'Unicorn Kids Birthday Parties',
            subtitle: 'Welcome to the magical world of Unicorns!',
            description: 'Here we love everything sparkles, glitter and magic!',
            imageKey: 'websitePagesPartiesUnicornPartyJpg',
            imageAlt: 'Colourful unicorn-themed soaps and craft creations',
        },
        creationsImageKey: 'websitePagesPartiesPackagesUnicornPng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesUnicornPng',
            imageAlt: 'colourful unicorn creations',
        },
    },
    {
        key: 'tieDye',
        slug: 'tie-dye-parties',
        seo: {
            title: 'Kids Tie Dye Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A colourful tie dye birthday party with guided, hands-on projects children can take home, hosted at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Kids Tie Dye Birthday Party',
        },
        hero: {
            title: 'Tie Dye Kids Birthday Party',
            subtitle: 'Tie Dye birthday parties are the best kids parties!',
            description: 'Enjoy the process of Tie Dying your favourite items and take the item home to enjoy!',
            imageKey: 'websitePagesPartiesTieDyePartyJpg',
            imageAlt: 'tie dyed shoelaces',
        },
        creationsImageKey: 'websitePagesPartiesPackagesTieDyePng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesTieDyePng',
            imageAlt: 'tie dye shoelaces',
        },
    },
    {
        key: 'taylorSwift',
        slug: 'taylor-swift-parties',
        seo: {
            title: 'Swiftie-Inspired Birthday Parties in Melbourne & Geelong | Fizz Kidz',
            description:
                'A Swiftie-inspired kids birthday party with sparkling, music-themed craft and take-home creations at Fizz Kidz studios in Melbourne and Geelong.',
            serviceName: 'Swiftie-Inspired Kids Birthday Party',
        },
        hero: {
            title: 'Taylor Swift Kids Birthday Party',
            subtitle: 'Join us for the best Swiftie Party!',
            description:
                'Make your very own sparkling and dazzling Swiftie creations to take home with you after the party!',
            imageKey: 'websitePagesPartiesTaylorSwiftPartyJpg',
            imageAlt: 'Sparkling Swiftie-inspired party creations',
        },
        creationsImageKey: 'websitePagesPartiesPackagesSwiftiePng',
        navigation: { isNew: false },
        themeCard: {
            imageKey: 'websitePagesPartiesPackagesSwiftiePng',
            imageAlt: 'Taylor Swift',
        },
    },
] as const satisfies readonly BirthdayPartyPageSource[]
