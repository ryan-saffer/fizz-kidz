import { DateTime } from 'luxon'

import { capitalise, getInvitationShareUrl, getStudioAddress, type Rsvp, type WithoutId } from '@fizz-kidz/core'

import { env } from '@/app/init/firebase'
import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'
import { isUsingEmulator } from '@/shared/runtime/is-using-emulator'

type SubmittedRsvp = WithoutId<Omit<Rsvp, 'source'>>

export type RsvpProps = SubmittedRsvp & {
    bookingId: string
    invitationId: string
    joinMailingList: boolean
}

export type HostRsvpProps = SubmittedRsvp & {
    bookingId: string
    invitationId: string
}

export async function guestRsvpToParty(input: RsvpProps) {
    const { bookingId, invitationId, joinMailingList, ...rsvp } = input

    if (!rsvp.parentEmail) {
        throwTrpcError('BAD_REQUEST', 'Parent email is required for guest RSVPs', undefined, {
            bookingId,
            invitationId,
        })
    }

    if (!rsvp.parentMobile) {
        throwTrpcError('BAD_REQUEST', 'Parent mobile is required for guest RSVPs', undefined, {
            bookingId,
            invitationId,
        })
    }

    const parentEmail = rsvp.parentEmail
    const parentMobile = rsvp.parentMobile

    for (const child of rsvp.children) {
        if (!child.dob) {
            throwTrpcError('BAD_REQUEST', 'Date of birth is required for guest RSVPs', undefined, {
                bookingId,
                invitationId,
                childName: child.name,
            })
        }
    }

    await DatabaseClient.addRsvpToParty(bookingId, { ...rsvp, source: 'guest' })

    const invitation = await DatabaseClient.getInvitation(invitationId)

    try {
        const zoho = new ZohoClient()
        const [firstName, ...lastNameParts] = input.parentName.trim().split(/\s+/)
        const lastName = lastNameParts.join(' ')

        for (const child of input.children) {
            await zoho.addBirthdayPartyGuestContactWithChild({
                firstName,
                lastName,
                email: parentEmail,
                mobile: parentMobile,
                studio: invitation.studio,
                childName: child.name,
                childBirthdayISO: getChildDobISO(child.dob),
                optOutOfMarketing: !joinMailingList,
            })
        }
    } catch (err) {
        logError(`error adding RSVP contact to zoho: ${parentEmail}`, err, { input })
    }

    const mailClient = await MailClient.getInstance()
    try {
        mailClient.sendEmail(
            'rsvpToParty',
            parentEmail,
            {
                parentName: input.parentName,
                children: input.children.map((child) => ({
                    childName: child.name,
                    isAttending: child.rsvp === 'attending',
                    allergies: child.allergies,
                })),
                attending: input.children.some((child) => child.rsvp === 'attending'),
                hostName: invitation.parentName,
                hostPhone: invitation.parentMobile,
                date: DateTime.fromJSDate(invitation.date, { zone: 'Australia/Melbourne' }).toFormat('ccc LLL dd yyyy'),
                time: invitation.time,
                isMobile: invitation.$type === 'mobile',
                studio: capitalise(invitation.studio),
                address: invitation.$type === 'mobile' ? invitation.address : getStudioAddress(invitation.studio),
            },
            { bccBookings: false }
        )
    } catch (err) {
        logError(`Error sending rsvp confirmation to parent '${parentEmail}'`, err, { input })
    }

    // notify the host
    if (invitation.rsvpNotificationsEnabled) {
        const booking = await DatabaseClient.getPartyBooking(invitation.bookingId)
        try {
            await mailClient.sendEmail(
                'rsvpNotificationToHost',
                booking.parentEmail,
                {
                    parentName: invitation.parentName,
                    childrenNames: mergeChildrenNames(input.children),
                    birthdayChildName: invitation.childName,
                    children: input.children.map((child) => ({
                        childName: child.name,
                        isAttending: child.rsvp === 'attending',
                        allergies: child.allergies,
                    })),
                    invitationUrl: getInvitationShareUrl(env, isUsingEmulator(), invitation.id),
                },
                { bccBookings: false }
            )
        } catch (err) {
            logError(`Error sending RSVP notification to host '${booking.parentEmail}'`, err, { input })
        }
    }

    // tracking
    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('invitation-rsvp', {
        distinct_id: parentEmail,
        bookingId: invitation.bookingId,
        invitationId: invitation.id,
        partyDate: invitation.date,
        parentName: input.parentName,
        parentEmail,
        numberOfChildren: input.children.length,
        joinMailingList: input.joinMailingList,
    })
}

export async function hostRsvpToParty(input: HostRsvpProps, host: { uid: string; email: string }) {
    const { bookingId, invitationId, ...rsvp } = input
    const invitation = await DatabaseClient.getInvitation(invitationId)

    if (invitation.uid !== host.uid || invitation.bookingId !== bookingId) {
        throwTrpcError('FORBIDDEN', 'Host is not authorised to manage RSVPs for this invitation', undefined, {
            bookingId,
            invitationId,
            uid: host.uid,
        })
    }

    await DatabaseClient.addRsvpToParty(bookingId, { ...rsvp, source: 'host' })

    const mixpanel = await MixpanelClient.getInstance()
    await mixpanel.track('Host Invitation RSVP', {
        distinct_id: host.email,
        bookingId: invitation.bookingId,
        invitationId: invitation.id,
        partyDate: invitation.date,
        hostEmail: host.email,
        parentName: input.parentName,
        numberOfChildren: input.children.length,
    })
}

/**
 * Merges children names such that it output "Harry, Jane and Sally" etc.
 */
function mergeChildrenNames(children: RsvpProps['children']) {
    if (children.length === 0) return ''
    if (children.length === 1) return children[0].name
    if (children.length === 2) return `${children[0].name} and ${children[1].name}`
    const names = children.map((child) => child.name)
    const last = names.pop()
    return `${names.join(', ')} and ${last}`
}

function getChildDobISO(dob: Rsvp['children'][number]['dob']) {
    if (!dob) {
        throwTrpcError('BAD_REQUEST', 'Date of birth is required for guest RSVPs')
    }

    return dob instanceof Date ? dob.toISOString() : new Date(dob).toISOString()
}
