export const STUDIOS = ['balwyn', 'cheltenham', 'essendon', 'geelong', 'kingsville', 'malvern', 'werribee'] as const

export type Studio = (typeof STUDIOS)[number]

export const PUBLIC_STUDIOS = [
    {
        slug: 'balwyn',
        name: 'Balwyn',
        streetAddress: '184 Whitehorse Rd',
        addressLocality: 'Balwyn',
        postalCode: '3103',
        coordinates: [-37.8122609, 145.0754496],
        image: '/images/studios/balwyn.jpg',
    },
    {
        slug: 'cheltenham',
        name: 'Cheltenham',
        streetAddress: '273 Bay Rd',
        addressLocality: 'Cheltenham',
        postalCode: '3192',
        coordinates: [-37.9549967, 145.0329837],
        image: '/images/studios/cheltenham.jpg',
    },
    {
        slug: 'essendon',
        name: 'Essendon',
        streetAddress: '75 Raleigh St',
        addressLocality: 'Essendon',
        postalCode: '3040',
        coordinates: [-37.7531407, 144.9186286],
        image: '/images/studios/essendon.jpg',
    },
    {
        slug: 'geelong',
        name: 'Geelong',
        streetAddress: '352 Pakington St',
        addressLocality: 'Newtown',
        postalCode: '3220',
        coordinates: [-38.1582046, 144.3451842],
    },
    {
        slug: 'kingsville',
        name: 'Kingsville',
        streetAddress: '238 Somerville Rd',
        addressLocality: 'Kingsville',
        postalCode: '3012',
        coordinates: [-37.811989, 144.87783],
        image: '/images/studios/kingsville.jpg',
    },
    {
        slug: 'malvern',
        name: 'Malvern',
        streetAddress: '20 Glenferrie Rd',
        addressLocality: 'Malvern',
        postalCode: '3144',
        coordinates: [-37.8643913, 145.0282103],
        image: '/images/studios/malvern.jpg',
    },
    {
        slug: 'werribee',
        name: 'Werribee',
        streetAddress: 'T5, Harpley Town Center, Bradfield St',
        addressLocality: 'Werribee',
        postalCode: '3030',
        coordinates: [-37.9114232, 144.6149075],
    },
] as const

export type PublicStudioSlug = (typeof PUBLIC_STUDIOS)[number]['slug']

export function getPublicStudio(slug: PublicStudioSlug) {
    return PUBLIC_STUDIOS.find((studio) => studio.slug === slug)!
}
