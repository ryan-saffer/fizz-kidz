export type MenuLink = {
    type: 'link'
    title: string
    path: string
    isNew: boolean
    /** Shown as a nested submenu, e.g. the party themes under Birthday parties. */
    items?: Readonly<MenuLink[]>
}

export type MenuItem =
    | MenuLink
    | ({
          type: 'dropdown'
          title: string
          items: Readonly<MenuLink[]>
      } & ({ clickable: true; path: string; subTitle: string } | { clickable: false }))

const atHomePartyLink = {
    title: 'At Home Parties (we come to you)',
    path: '/birthday-parties/at-home-parties/',
    type: 'link',
    isNew: false,
} as const satisfies MenuLink

export const locationMenuLinks = [
    { type: 'link', path: '/locations/balwyn', title: 'Balwyn', isNew: false },
    { type: 'link', path: '/locations/cheltenham', title: 'Cheltenham', isNew: false },
    { type: 'link', path: '/locations/essendon', title: 'Essendon', isNew: false },
    { type: 'link', path: '/locations/geelong', title: 'Geelong', isNew: true },
    { type: 'link', path: '/locations/kingsville', title: 'Kingsville', isNew: false },
    { type: 'link', path: '/locations/malvern', title: 'Malvern', isNew: false },
    { type: 'link', path: '/locations/werribee', title: 'Werribee', isNew: true },
] as const satisfies Readonly<MenuLink[]>

export function createBirthdayPartyMenuLinks(packageLinks: Readonly<MenuLink[]>) {
    return [atHomePartyLink, ...packageLinks] satisfies MenuLink[]
}

export function createNavigationMenu(packageLinks: Readonly<MenuLink[]>): MenuItem[] {
    return [
        {
            title: 'In studio',
            type: 'dropdown',
            clickable: false,
            items: [
                {
                    type: 'link',
                    title: 'Birthday parties',
                    path: '/birthday-parties/',
                    isNew: false,
                    items: packageLinks,
                },
                { type: 'link', title: 'Holiday programs', path: '/holiday-programs/', isNew: false },
                { type: 'link', title: 'Messy Play', path: '/messy-play/', isNew: false },
                { type: 'link', title: 'Gift cards', path: '/gift-cards/', isNew: false },
            ],
        },
        {
            type: 'link',
            title: 'We come to you',
            path: '/birthday-parties/at-home-parties/',
            isNew: false,
        },
        {
            title: 'In schools/ELC',
            type: 'dropdown',
            clickable: false,
            items: [
                {
                    type: 'link',
                    title: 'After school programs',
                    path: '/in-schools/after-school-programs/',
                    isNew: false,
                },
                {
                    type: 'link',
                    title: 'School science incursions',
                    path: '/in-schools/incursions/',
                    isNew: false,
                },
            ],
        },
        {
            title: 'For businesses',
            type: 'dropdown',
            clickable: false,
            items: [
                {
                    type: 'link',
                    title: 'Shopping centre activations',
                    path: '/activations-and-events/',
                    isNew: false,
                },
            ],
        },
        {
            title: 'Locations',
            type: 'dropdown',
            clickable: true,
            path: '/locations',
            subTitle: 'See All Locations',
            items: locationMenuLinks,
        },
        {
            title: 'Fizz facts',
            type: 'dropdown',
            clickable: false,
            items: [
                { type: 'link', title: 'Contact Us', path: '/contact-us/', isNew: false },
                { type: 'link', title: 'Gift Cards', path: '/gift-cards/', isNew: true },
                { type: 'link', title: 'Careers', path: '/careers/', isNew: false },
                { type: 'link', title: 'Franchising', path: '/franchising/', isNew: false },
                { type: 'link', title: 'Policies', path: '/policies/', isNew: false },
            ],
        },
    ]
}
