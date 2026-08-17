import type { Studio } from '..'

type BaseInvitation = {
    id: string // same id used to upload to storage
    uid: string // owner
    bookingId: string
    rsvpNotificationsEnabled: boolean
    childName: string
    childAge: string
    date: Date
    time: string
    parentName: string
    rsvpDate: Date
    parentMobile: string
    invitation: InvitationOption
    studio: Studio
}
type StudioInvitation = BaseInvitation & { $type: 'studio' }
type MobileInvitation = BaseInvitation & { $type: 'mobile'; address: string }

export type Invitation = StudioInvitation | MobileInvitation

export type InvitationOption =
    | 'Kpop Demon Hunters'
    | 'Freckles'
    | 'Stripes'
    | 'Dots'
    | 'Glitz & Glam'
    | 'Bubbling Fun'
    | 'Bubbling Blue Fun'
    | 'Slime Time'
    | 'Tie Dye'
    | 'Swiftie'
    | 'Unicorn'
