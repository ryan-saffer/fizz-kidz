import type { WebsiteImage } from '@/types/images'
import type { Studio } from '@/utils/studios'

import {
    halloweenSpookfestSession1,
    halloweenSpookfestSession2,
    halloweenSpookfestSession3,
} from '@/data/website-images'

export type HalloweenSpookfestStudio = Exclude<Studio, 'kingsville'>

type Session = {
    emoji: string
    title: string
    time: string
    activities: string[]
    bonus?: string
    image: WebsiteImage
    imageAlt: string
    colour: string
    studios: readonly HalloweenSpookfestStudio[]
}

const ALL_STUDIOS: readonly HalloweenSpookfestStudio[] = [
    'balwyn',
    'cheltenham',
    'essendon',
    'geelong',
    'malvern',
    'werribee',
]

const SESSIONS: Session[] = [
    {
        emoji: '🕷️',
        title: 'Session 1',
        time: '4:00pm - 5:00pm',
        activities: ['Cauldron Spider Explosions', 'Spooky Jelly Soap'],
        bonus: 'FREE Halloween tote bag for trick-or-treating!',
        image: halloweenSpookfestSession1,
        imageAlt:
            'A cauldron erupting with green foam and plastic spiders, Halloween jelly soaps and a trick-or-treat tote bag',
        colour: '#9044E2',
        studios: ALL_STUDIOS,
    },
    {
        emoji: '👻',
        title: 'Session 2',
        time: '5:30pm - 6:30pm',
        activities: ['Ghost Glow Slime', 'Bat Attack Bath Bombs'],
        image: halloweenSpookfestSession2,
        imageAlt: 'A bath bomb cracked open to reveal a toy bat, and glow-in-the-dark slime',
        colour: '#EC65A6',
        studios: ALL_STUDIOS,
    },
    {
        emoji: '🎃',
        title: 'Session 3',
        time: '7:00pm - 8:00pm',
        activities: ['Pumpkin Spice Squishies', 'Boo Bling Keychains'],
        image: halloweenSpookfestSession3,
        imageAlt: 'A ghost and pumpkin beaded keychain, and an orange glitter squishy',
        colour: '#2B9D5B',
        studios: ['werribee', 'balwyn'],
    },
]

export const HALLOWEEN_SPOOKFEST = {
    path: '/halloween-spookfest/',
    bookingUrl: 'https://bookings.fizzkidz.com.au/programs?id=75381458',
    date: 'Friday 30th October',
    price: '$20 per child',
    ages: 'Ages 4 to 12',
    studios: ALL_STUDIOS,
    sessions: SESSIONS,
}

export function getHalloweenSpookfestSessions(studio?: HalloweenSpookfestStudio) {
    return HALLOWEEN_SPOOKFEST.sessions.filter((session) => !studio || session.studios.includes(studio))
}
