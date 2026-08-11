export const STUDIOS = ['balwyn', 'cheltenham', 'essendon', 'geelong', 'kingsville', 'malvern', 'werribee'] as const

export type Studio = (typeof STUDIOS)[number]

export const PUBLIC_STUDIOS = [
    {
        slug: 'balwyn',
        name: 'Balwyn',
        streetAddress: '184 Whitehorse Rd',
        addressLocality: 'Balwyn',
        postalCode: '3103',
        image: '/images/studios/balwyn.jpg',
    },
    {
        slug: 'cheltenham',
        name: 'Cheltenham',
        streetAddress: '273 Bay Rd',
        addressLocality: 'Cheltenham',
        postalCode: '3192',
        image: '/images/studios/cheltenham.jpg',
    },
    {
        slug: 'essendon',
        name: 'Essendon',
        streetAddress: '75 Raleigh St',
        addressLocality: 'Essendon',
        postalCode: '3040',
        image: '/images/studios/essendon.jpg',
    },
    {
        slug: 'geelong',
        name: 'Geelong',
        streetAddress: '352 Pakington St',
        addressLocality: 'Newtown',
        postalCode: '3220',
    },
    {
        slug: 'kingsville',
        name: 'Kingsville',
        streetAddress: '238 Somerville Rd',
        addressLocality: 'Kingsville',
        postalCode: '3012',
        image: '/images/studios/kingsville.jpg',
    },
    {
        slug: 'malvern',
        name: 'Malvern',
        streetAddress: '20 Glenferrie Rd',
        addressLocality: 'Malvern',
        postalCode: '3144',
        image: '/images/studios/malvern.jpg',
    },
    {
        slug: 'werribee',
        name: 'Werribee',
        streetAddress: 'T5, Harpley Town Center, Bradfield St',
        addressLocality: 'Werribee',
        postalCode: '3030',
    },
] as const

export type PublicStudioSlug = (typeof PUBLIC_STUDIOS)[number]['slug']

export function getPublicStudio(slug: PublicStudioSlug) {
    return PUBLIC_STUDIOS.find((studio) => studio.slug === slug)!
}
