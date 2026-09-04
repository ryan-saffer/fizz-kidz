export type MenuLink = {
    type: 'link'
    title: string
    path: string
    isNew: boolean
}

export type MenuItem =
    | MenuLink
    | ({
          type: 'dropdown'
          title: string
          items: Readonly<MenuLink[]>
      } & ({ clickable: true; path: string; subTitle: string } | { clickable: false }))

const atHomePartyLink = {
    title: 'At Home Parties',
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
    return [...packageLinks, atHomePartyLink] satisfies MenuLink[]
}

export function createNavigationMenu(packageLinks: Readonly<MenuLink[]>): MenuItem[] {
    return [
        {
            title: 'Birthday parties',
            clickable: true,
            path: '/birthday-parties/',
            subTitle: 'See All Packages',
            type: 'dropdown',
            items: createBirthdayPartyMenuLinks(packageLinks),
        },
        {
            type: 'link',
            title: 'Holiday programs',
            path: '/holiday-programs/',
            isNew: false,
        },
        {
            type: 'link',
            title: 'Preschool program',
            path: '/preschool-program',
            isNew: false,
        },
        {
            title: 'In schools',
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
                    title: 'Incursions',
                    path: '/in-schools/incursions/',
                    isNew: false,
                },
            ],
        },
        {
            title: 'Activations and events',
            type: 'link',
            path: '/activations-and-events/',
            isNew: false,
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
                { type: 'link', title: 'Our Team', path: '/our-team/', isNew: false },
                { type: 'link', title: 'Policies', path: '/policies/', isNew: false },
            ],
        },
    ]
}
