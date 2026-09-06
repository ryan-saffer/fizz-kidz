import { BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS, type BirthdayPartyPackageColour } from './birthday-party-catalogue'

import type { PortableTextBlock, TypedObject } from '@portabletext/types'

export type CreationInstructionImage = TypedObject & {
    _type: 'image'
    _key: string
    alt?: string
    asset?: { _ref?: string }
    url?: string
}

export type CreationInstructionExternalImage = TypedObject & {
    _type: 'externalImage'
    _key: string
    alt?: string
    url?: string
}

export type CreationInstructionDivider = TypedObject & {
    _type: 'divider'
    _key: string
}

export type CreationInstructionsContent = Array<
    PortableTextBlock | CreationInstructionImage | CreationInstructionExternalImage | CreationInstructionDivider
>

export type HolidayProgramCreationInstructions = {
    _id: string
    date: string
    name: string
    instructions: CreationInstructionsContent
}

export const PARTY_PACKAGE_COLOURS = [
    ...BIRTHDAY_PARTY_PACKAGE_COLOUR_OPTIONS.map((option) => option.value),
    'yellow',
] as const

export type PartyPackageColour = BirthdayPartyPackageColour | 'yellow'

export type BirthdayPartyCreationInstructions = {
    _id: string
    name: string
    instructions: CreationInstructionsContent
}

export type BirthdayPartyCreationInstructionGroup = {
    _id: string
    name: string
    colour?: PartyPackageColour
    creations: BirthdayPartyCreationInstructions[]
}
