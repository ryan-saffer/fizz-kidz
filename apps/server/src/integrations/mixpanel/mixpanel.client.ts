import { logger } from 'firebase-functions/v2'

import type {
    ContactFormLocationOption,
    ContactFormServiceOption,
    Invitations,
    ReferenceOption,
    WebsiteFormId,
} from '@fizz-kidz/core'
import { type ScienceModule, type Studio, type StudioOrTest } from '@fizz-kidz/core'

import type { TimeOfWeekProperties } from './time-of-week-properties'
import type { ClientStatus } from '@/shared/lazy-client/client-status'
import type { Mixpanel } from 'mixpanel'

export class MixpanelClient {
    private static instance: MixpanelClient
    #status: ClientStatus = 'not-initialised'

    #mixpanelClient: Mixpanel | null = null

    private constructor() {}

    static async getInstance(): Promise<MixpanelClient> {
        if (!MixpanelClient.instance) {
            MixpanelClient.instance = new MixpanelClient()
            await MixpanelClient.instance.#initialise()
        }
        while (MixpanelClient.instance.#status === 'initialising') {
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        return MixpanelClient.instance
    }

    get #mixpanel() {
        if (this.#mixpanelClient) return this.#mixpanelClient
        throw new Error('Mixpanel client not initialised')
    }

    async #initialise() {
        this.#status = 'initialising'
        const Mixpanel = await import('mixpanel')
        this.#mixpanelClient = Mixpanel.init(process.env.MIXPANEL_API_KEY)
        this.#status = 'initialised'
    }

    track<T extends keyof MixpanelEvent>(event: T, properties: MixpanelEvent[T]) {
        return new Promise<void>((resolve) => {
            this.#mixpanel.track(EventNameMap[event], properties, (err) => {
                if (err) {
                    logger.warn(`An error occurred tracking the mixpanel event: '${event}'`, { err })
                }
                resolve()
            })
        })
    }
}

export type MixpanelEvent = {
    'invitation-preview-generated': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        invitation: Invitations.InvitationOption
        parentName: string
        parentEmail: string
    }
    'invitation-download-requested': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        invitation: Invitations.InvitationOption
        parentName: string
        parentEmail: string
    }
    'invitation-edited': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        invitation: Invitations.InvitationOption
        parentName: string
        parentEmail: string
    }
    'invitation-generated': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        invitation: Invitations.InvitationOption
        parentName: string
        parentEmail: string
    }
    'invitation-rsvp': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        parentName: string
        parentEmail: string
        numberOfChildren: number
        joinMailingList: boolean
    }
    'Host Invitation RSVP': {
        distinct_id: string
        bookingId: string
        invitationId: string
        partyDate: Date
        hostEmail: string
        parentName: string
        numberOfChildren: number
    }
    'holiday-program-website-discount': {
        distinct_id: string
        name: string
    }
    'website-enquiry': TimeOfWeekProperties & {
        distinct_id: string
        form: WebsiteFormId
        service?: ContactFormServiceOption
        location?: ContactFormLocationOption
        reference?: ReferenceOption
        referenceOther?: string
        partyTheme?: string
    }
    // The time of week is when the chat started.
    'website-chat-finished': TimeOfWeekProperties & {
        distinct_id: string
        chatId: string
        messageCount: number
        durationMinutes: number
        // auto-enquiry: sent after the customer left without confirming (see sendUnconfirmedEnquiry).
        outcome: 'enquiry' | 'auto-enquiry' | 'none'
        model: string
        entryPage: string | null
        resumed: boolean
    }
    'google-business-profile-review': {
        distinct_id: string
        notificationType: 'NEW_REVIEW' | 'UPDATED_REVIEW'
        locationName: string
        locationTitle?: string
        studio?: Studio
        reviewName: string
        reviewId?: string
        reviewerDisplayName?: string
        reviewerIsAnonymous?: boolean
        starRating?: string
        starRatingValue?: number
        comment?: string
        createTime?: string
        updateTime?: string
        hasReply: boolean
        replyUpdateTime?: string
    }
    'holiday-program-checkout-reached': {
        distinct_id: string
    }
    'holiday-program-booking': {
        distinct_id: string
        location: StudioOrTest
        amount: number
        numberOfSlots: number
        numberOfKids: number
        discountCode?: string
        childAges: string[]
        titles?: string[]
        creations?: string[]
    }
    'preschool-program-booking': {
        distinct_id: string
        location: StudioOrTest
        amount: number
        numberOfSlots: number
        numberOfKids: number
        discountCode?: string
        childAges: string[]
    }
    'preschool-program-cancellation': {
        distinct_id: string
        location: StudioOrTest
        booking: string
        refundAmount: number
        hasRefund: boolean
    }
    'birthday-party-booking': {
        distinct_id: string
        bookingId: string
        location: Studio
        length: '1' | '1.5' | '2'
        includesFood: boolean
        type: 'studio' | 'mobile'
        childAge: string
        date: string // ISO
    }
    'birthday-party-form-completed': {
        distinct_id: string
        type: 'mobile' | 'studio'
        location: Studio
        creations: string[]
        additions: string[]
        orderedPartyPack: boolean
        partyPack?: string
        cakeOrdered: boolean
        cakeSelection?: string
        cakeFlavours?: string[]
        cakeSize?: string
        cakeServed?: string
        cakeCandles?: string
        takeHomeOrdered: boolean
        takeHomeItems: { name: string; quantity: string }[]
        partyOrCakeForm: 'party' | 'cake'
    }
    'incursion-form-completed': {
        distinct_id: string
        eventId: string
        organisation: string
        studio: Studio
        module: ScienceModule
        incursion: string
        numberOfChildren: string
        numberOfSlots: number
        firstSlotStartTime: Date
        teacherInformation: string
        hearAboutUs: string
    }
    'after-school-program-enrolment': {
        distinct_id: string
        type: 'science' | 'art'
        inStudio: boolean
        appointmentTypeId: number
        calendarId: number
        childAge: string
        childGrade: string
        className: string
    }
    'after-school-program-unenrolment': {
        distinct_id: string
        type: 'science' | 'art'
        inStudio: boolean
        appointmentTypeId: number
        calendarId: number
        childAge: string
        childGrade: string
        className: string
    }
    'preschool-program-enrolment': {
        distinct_id: string
        appointmentTypeId: number
        calendarId: number
        location: StudioOrTest
        childAge: string
        className: string
        numberOfWeeks: number
    }
    'preschool-program-unenrolment': {
        distinct_id: string
        appointmentTypeId: number
        calendarId: number
        location: StudioOrTest
        childAge: string
        className: string
        numberOfWeeks: number
    }
    'play-lab-booking': {
        distinct_id: string
        bookingType: 'term-booking' | 'casual'
        appointmntTypeIds: number[]
        programNames: string[]
        location: StudioOrTest
        amount: number
        discountType?: 'percentage' | 'price'
        discountAmount?: number
        discountCode?: string
        numberOfPrograms: number
        numberOfKids: number
        childAges: string[]
        reference: string
        referenceOther?: string
    }
}

const EventNameMap: Record<keyof MixpanelEvent, string> = {
    'invitation-preview-generated': 'Invitation Preview Generated [New]',
    'invitation-download-requested': 'Invitation Download Requested [New]',
    'invitation-edited': 'Invitation Edited [New]',
    'invitation-generated': 'Invitation Generated [New]',
    'invitation-rsvp': 'Invitation RSVP',
    'Host Invitation RSVP': 'Host Invitation RSVP',
    'holiday-program-website-discount': 'Website Holiday Program Discount Generated',
    'website-enquiry': 'Website Enquiry',
    'website-chat-finished': 'Website Chat Finished',
    'google-business-profile-review': 'Google Review',
    'holiday-program-checkout-reached': 'Holiday Program Checkout Reached',
    'holiday-program-booking': 'Holiday Program Booking',
    'preschool-program-booking': 'Preschool Program Booking',
    'preschool-program-cancellation': 'Preschool Program Cancellation',
    'birthday-party-booking': 'Birthday Party Booking',
    'birthday-party-form-completed': 'Birthday Party Form Completed',
    'incursion-form-completed': 'Incursion Form Completed',
    'after-school-program-enrolment': 'After School Program Enrolment',
    'after-school-program-unenrolment': 'After School Program Unenrolment',
    'preschool-program-enrolment': 'Preschool Program Enrolment',
    'preschool-program-unenrolment': 'Preschool Program Unenrolment',
    'play-lab-booking': 'Play Lab Booking',
}
