import { addOrdinalSuffix, combineStrings } from '../utilities/stringUtilities'

import type { Studio } from '../core/studio'
import type { Addition } from './additions'
import type { CakeFlavours } from './CakeFlavours'
import type { Creation } from './creations'
import type { ProductType } from './products'
import type { TakeHomeBagType } from './take-home-bags'
/// <reference lib="dom" />
import type { firestore } from 'firebase-admin' // https://stackoverflow.com/a/51275905/7870403

type AdditionKeyValues = Record<Addition, boolean>

export type BaseBooking = AdditionKeyValues & {
    eventId?: string
    parentFirstName: string
    parentLastName: string
    parentEmail: string
    parentMobile: string
    zohoDealId?: string
    childName: string
    childAge: string
    // only captured when booking for CRM purposes. The bookings childName and childAge will derive from these children.
    children?: {
        name: string
        age: string
        birthday: string // ISO date string in Australia/Melbourne
    }[]
    location: Studio
    type: 'studio' | 'mobile'
    partyLength: '1' | '1.5' | '2'
    address: string
    numberOfChildren: string
    notes: string
    creation1: Creation | undefined
    creation2: Creation | undefined
    creation3: Creation | undefined
    menu: 'standard' | 'glutenFree' | 'vegan' | undefined
    cakeFlavour: CakeFlavours | undefined
    questions: string
    funFacts: string
    partyFormFilledIn: boolean
    sendConfirmationEmail: boolean
    oldPrices: boolean
    includesFood: boolean
    cake?: {
        selection: string
        flavours: string[]
        size: string
        served: string // bowls + spoon, waffle cones, bring their own
        candles: string
        message?: string
    }
    takeHomeBags?: Partial<Record<TakeHomeBagType, number>>
    products?: Partial<Record<ProductType, number>>
    useRsvpSystem: boolean | undefined
} & (
        | {
              invitationId: undefined
              invitationOwnerUid: undefined // needed for security rules on the rsvps collection
          }
        | {
              invitationId: string
              invitationOwnerUid: string
          }
    )

// separates date and time into separate values, for better use in forms
export type FormBooking = BaseBooking & {
    date: Date
    time: Date
}

// combines dateTime into single date
export type Booking = BaseBooking & {
    dateTime: Date
}

// used when retrieving from firestore, where dateTime is a firestore Timestamp
export type FirestoreBooking = BaseBooking & {
    dateTime: firestore.Timestamp
}

type FormBookingKeys = { [K in keyof FormBooking]: K }

export const FormBookingFields: FormBookingKeys = {
    parentFirstName: 'parentFirstName',
    parentLastName: 'parentLastName',
    parentEmail: 'parentEmail',
    parentMobile: 'parentMobile',
    zohoDealId: 'zohoDealId',
    childName: 'childName',
    childAge: 'childAge',
    location: 'location',
    type: 'type',
    address: 'address',
    date: 'date',
    time: 'time',
    partyLength: 'partyLength',
    notes: 'notes',
    questions: 'questions',
    funFacts: 'funFacts',
    numberOfChildren: 'numberOfChildren',
    creation1: 'creation1',
    creation2: 'creation2',
    creation3: 'creation3',
    menu: 'menu',
    partyFormFilledIn: 'partyFormFilledIn',
    cake: 'cake',
    cakeFlavour: 'cakeFlavour',
    chickenNuggets: 'chickenNuggets',
    fairyBread: 'fairyBread',
    fruitPlatter: 'fruitPlatter',
    glutenFreeFairyBread: 'glutenFreeFairyBread',
    potatoGems: 'potatoGems',
    frankfurts: 'frankfurts',
    sandwichPlatter: 'sandwichPlatter',
    vegetarianSpringRolls: 'vegetarianSpringRolls',
    veggiePlatter: 'veggiePlatter',
    vegetarianQuiche: 'vegetarianQuiche',
    watermelonPlatter: 'watermelonPlatter',
    wedges: 'wedges',
    lollyBags: 'lollyBags',
    grazingPlatterMedium: 'grazingPlatterMedium',
    grazingPlatterLarge: 'grazingPlatterLarge',
    volcanoPartyPack: 'volcanoPartyPack',
    lipBalmPartyPack: 'lipBalmPartyPack',
    dinosaurBathBombPartyPack: 'dinosaurBathBombPartyPack',
    slimePartyPack: 'slimePartyPack',
    sendConfirmationEmail: 'sendConfirmationEmail',
    oldPrices: 'oldPrices',
    includesFood: 'includesFood',
    dinosaurFizzPartyPack: 'dinosaurFizzPartyPack',
    unicornFizzPartyPack: 'unicornFizzPartyPack',
    takeHomeBags: 'takeHomeBags',
    products: 'products',
    useRsvpSystem: 'useRsvpSystem',
    invitationId: 'invitationId',
    invitationOwnerUid: 'invitationOwnerUid',
}

type BookingKeys = { [K in keyof FirestoreBooking]: K }

export const BookingFields: BookingKeys = {
    parentFirstName: 'parentFirstName',
    parentLastName: 'parentLastName',
    parentEmail: 'parentEmail',
    parentMobile: 'parentMobile',
    zohoDealId: 'zohoDealId',
    childName: 'childName',
    childAge: 'childAge',
    location: 'location',
    type: 'type',
    address: 'address',
    dateTime: 'dateTime',
    partyLength: 'partyLength',
    notes: 'notes',
    questions: 'questions',
    funFacts: 'funFacts',
    numberOfChildren: 'numberOfChildren',
    creation1: 'creation1',
    creation2: 'creation2',
    creation3: 'creation3',
    partyFormFilledIn: 'partyFormFilledIn',
    cake: 'cake',
    menu: 'menu',
    cakeFlavour: 'cakeFlavour',
    chickenNuggets: 'chickenNuggets',
    fairyBread: 'fairyBread',
    glutenFreeFairyBread: 'glutenFreeFairyBread',
    potatoGems: 'potatoGems',
    fruitPlatter: 'fruitPlatter',
    frankfurts: 'frankfurts',
    sandwichPlatter: 'sandwichPlatter',
    vegetarianSpringRolls: 'vegetarianSpringRolls',
    veggiePlatter: 'veggiePlatter',
    vegetarianQuiche: 'vegetarianQuiche',
    watermelonPlatter: 'watermelonPlatter',
    wedges: 'wedges',
    lollyBags: 'lollyBags',
    grazingPlatterMedium: 'grazingPlatterMedium',
    grazingPlatterLarge: 'grazingPlatterLarge',
    volcanoPartyPack: 'volcanoPartyPack',
    lipBalmPartyPack: 'lipBalmPartyPack',
    dinosaurBathBombPartyPack: 'dinosaurBathBombPartyPack',
    slimePartyPack: 'slimePartyPack',
    sendConfirmationEmail: 'sendConfirmationEmail',
    oldPrices: 'oldPrices',
    includesFood: 'includesFood',
    dinosaurFizzPartyPack: 'dinosaurFizzPartyPack',
    unicornFizzPartyPack: 'unicornFizzPartyPack',
    takeHomeBags: 'takeHomeBags',
    products: 'products',
    useRsvpSystem: 'useRsvpSystem',
    invitationId: 'invitationId',
    invitationOwnerUid: 'invitationOwnerUid',
}

type PartyChildrenDisplayInput = Pick<BaseBooking, 'childName' | 'childAge' | 'children'>

function possessiveName(name: string) {
    const trimmedName = name.trim()
    if (trimmedName.endsWith('s')) {
        return `${trimmedName}'`
    }

    return `${trimmedName}'s`
}

export function getPartyBirthdayChildDisplay(booking: PartyChildrenDisplayInput) {
    const children = booking.children?.filter((child) => child.name.trim() && child.age.trim())

    if (children && children.length > 0) {
        return combineStrings(children.map((child) => `${possessiveName(child.name)} ${addOrdinalSuffix(child.age)}`))
    }

    return `${possessiveName(booking.childName)} ${addOrdinalSuffix(booking.childAge)}`
}

export const PARTY_LOST_REASONS = [
    'Lack of Response',
    'Competition',
    'Price',
    'Date/Location Unavailable',
    'Exceeds Capacity',
    'Change of Plans',
    'Schedule Conflict',
    'Below Minimum Age Requirement',
    'Outside Zone Coverage',
    'Other',
] as const

export type PartyLostReason = (typeof PARTY_LOST_REASONS)[number]
