export const PRODUCTS = {
    bathBombKit: {
        displayValue: 'Bath Bomb Kit',
        label: 'Bath Bomb Kit',
        helperText: 'Number of bath bomb kits purchased',
    },
    soapMakingKit: {
        displayValue: 'Soap Making Kit',
        label: 'Soap Making Kit',
        helperText: 'Number of soap making kits purchased',
    },
    stringSlimeKit: {
        displayValue: 'String Slime Kit',
        label: 'String Slime Kit',
        helperText: 'Number of string slime kits purchased',
    },
    superSlimeKit: {
        displayValue: 'Super Slime Kit',
        label: 'Super Slime Kit',
        helperText: 'Number of super slime kits purchased',
    },
} as const

export type ProductType = keyof typeof PRODUCTS
