export const PROD_ADDITIONS = {
    chickenNuggets: {
        displayValue: 'Chicken Nuggets',
        displayValueWithPrice: 'Chicken Nuggets - $35',
    },
    fairyBread: { displayValue: 'Fairy Bread', displayValueWithPrice: 'Fairy Bread - $30' },
    fruitPlatter: { displayValue: 'Fruit Platter', displayValueWithPrice: 'Fruit Platter - $45' },
    frankfurts: { displayValue: 'Frankfurts', displayValueWithPrice: 'Frankfurts - $25' },
    sandwichPlatter: {
        displayValue: 'Sandwich Platter',
        displayValueWithPrice: 'Sandwich Platter - butter & cheese, vegemite & butter,  cheese & tomato - $35',
    },
    vegetarianQuiche: { displayValue: 'Vegetarian Quiches', displayValueWithPrice: 'Vegetarian Quiches - $35' },
    watermelonPlatter: { displayValue: 'Watermelon Platter', displayValueWithPrice: 'Watermelon Platter - $25' },
    wedges: { displayValue: 'Wedges', displayValueWithPrice: 'Wedges - $30' },
    dinosaurFizzPartyPack: {
        displayValue: 'Dinosaur Fizz Party Pack',
        displayValueWithPrice: 'Dinosaur Fizz Party Pack - $12.80 each',
    },
    unicornFizzPartyPack: {
        displayValue: 'Unicorn Fizz Party Pack',
        displayValueWithPrice: 'Unicorn Fizz Party Pack - $12.80 each',
    },
} as const

const DEPRECATED_ADDITIONS = {
    glutenFreeFairyBread: {
        displayValue: 'Gluten Free Fairy Bread',
        displayValueWithPrice: 'Gluten Free Fairy Bread - $40',
    },
    vegetarianSpringRolls: {
        displayValue: 'Vegetarian Spring Rolls',
        displayValueWithPrice: 'Vegetarian Spring Rolls - $30',
    },
    veggiePlatter: { displayValue: 'Veggie Platter', displayValueWithPrice: 'Veggie Platter - $30' },
    potatoGems: { displayValue: 'Potato Gems', displayValueWithPrice: 'Potato Gems - $30' },
    lollyBags: { displayValue: 'Lolly bags', displayValueWithPrice: 'Lolly bags - $2.50 per child' },
    grazingPlatterMedium: {
        displayValue: 'Medium Grazing Platter',
        displayValueWithPrice: 'Grazing Platter for Parents (Medium: 10-15 ppl) - $98',
    },
    grazingPlatterLarge: {
        displayValue: 'Large Grazing Platter',
        displayValueWithPrice: 'Grazing Platter for Parents (Large: 15-25 ppl) - $148',
    },
    volcanoPartyPack: {
        displayValue: 'Volcano Party Pack',
        displayValueWithPrice: 'Bubbling Volcano Activity Party Pack - $15 each',
    },
    dinosaurBathBombPartyPack: {
        displayValue: 'Dinosaur Bath Bomb Party Pack',
        displayValueWithPrice: 'Dinosaur Bath Bomb Activity Party Pack - $15 each',
    },
    lipBalmPartyPack: {
        displayValue: 'Lip Balm Party Pack',
        displayValueWithPrice: 'Sparkling Lip Balm Activity Party Pack - $15 each',
    },
    slimePartyPack: {
        displayValue: 'Slime Party Pack',
        displayValueWithPrice: 'Fluffy Slime Activity Party Pack - $15 each',
    },
} as const

export const ADDITIONS = { ...PROD_ADDITIONS, ...DEPRECATED_ADDITIONS } as const
export type Addition = keyof typeof ADDITIONS
