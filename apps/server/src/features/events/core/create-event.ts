import { DateTime } from 'luxon'

import type { DistributiveOmit, Event, WithoutId } from '@fizz-kidz/core'
import { ModuleIncursionMap, ModuleNameMap } from '@fizz-kidz/core'

import { splitContactName, trimEventTextFields } from './event-input'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export type CreateEvent = {
    event: WithoutId<DistributiveOmit<Event, 'eventId' | 'startTime' | 'endTime' | 'calendarEventId'>>
    slots: {
        startTime: Date
        endTime: Date
    }[]
    sendConfirmationEmail: boolean
    emailMessage: string
}

export async function createEvent(input: CreateEvent) {
    const event = trimEventTextFields(input.event)
    const { slots, sendConfirmationEmail } = input
    const emailMessage = input.emailMessage.trim()

    if (!event.contactName) {
        throwTrpcError('BAD_REQUEST', 'Contact name is required')
    }

    if (event.$type === 'incursion') {
        console.log(event)
    }

    const calendarClient = await CalendarClient.getInstance()

    // parse date strings back to date objects
    slots.forEach((slot) => {
        slot.startTime = new Date(slot.startTime)
        slot.endTime = new Date(slot.endTime)
    })

    try {
        // create events in firestore
        const { eventId, slotIds } = await DatabaseClient.createEventBooking(event, slots)

        console.log('eventId:', eventId)
        console.log('slotIds:', slotIds)

        // create events in calendar
        const calendarEventIds = await Promise.all(
            slots.map((slot) =>
                calendarClient.createEvent(
                    { eventType: 'events' },
                    {
                        title: event.eventName,
                        location: event.address,
                        start: slot.startTime,
                        end: slot.endTime,
                        description: event.notes,
                    },
                    { useExponentialBackoff: true }
                )
            )
        )

        // update calendar ids back into firestore
        await Promise.all(
            slotIds.map((slotId, idx) => {
                const calendarEventId = calendarEventIds[idx]
                if (!calendarEventId) {
                    throwTrpcError('INTERNAL_SERVER_ERROR', `error creating calendar event for event with id ${slotId}`)
                }
                return DatabaseClient.updateEventBooking(eventId, slotId, { calendarEventId })
            })
        )

        try {
            const { firstName, lastName } = splitContactName(event.contactName)
            const zohoDealId = await new ZohoClient().confirmB2BDeal({
                dealId: event.zohoDealId,
                firstName,
                lastName,
                email: event.contactEmail,
                mobile: event.contactNumber,
                eventName: event.eventName,
                organisationName: event.organisation,
                studio: event.studio,
                bookingId: eventId,
                address: event.address,
                price: event.price,
                slots,
                type: event.$type,
                notes: event.notes,
                ...(event.$type === 'standard'
                    ? { numberOfAttendees: event.numberOfAttendees }
                    : {
                          module: event.module,
                          numberOfStudentsPerSession: event.numberOfStudentsPerSession,
                      }),
            })

            if (!event.zohoDealId) {
                await DatabaseClient.updateEventBooking(eventId, slotIds[0], { zohoDealId })
            }
        } catch (err) {
            logError(`Zoho sync failed while confirming B2B event booking '${eventId}'`, err, {
                eventId,
                zohoDealId: event.zohoDealId,
            })
        }
    } catch (err) {
        throwTrpcError('INTERNAL_SERVER_ERROR', 'error creating event booking', err)
    }

    // send confirmation email
    if (sendConfirmationEmail) {
        try {
            const mailClient = await MailClient.getInstance()

            const { $type: type } = event

            switch (type) {
                case 'standard': {
                    await mailClient.sendEmail(
                        'standardEventBookingConfirmation',
                        event.contactEmail,
                        {
                            contactName: event.contactName,
                            address: event.address,
                            emailMessage: emailMessage,
                            price: event.price,
                            slots: slots.map((slot) => ({
                                startTime: formatDate(slot.startTime),
                                endTime: formatTime(slot.endTime),
                            })),
                        },
                        { bcc: ['kym@fizzkidz.com.au'] }
                    )
                    break
                }
                case 'incursion': {
                    await mailClient.sendEmail(
                        'incursionBookingConfirmation',
                        event.contactEmail,
                        {
                            contactName: event.contactName,
                            organisation: event.organisation,
                            address: event.address,
                            slots: slots.map((slot) => ({
                                startTime: formatDate(slot.startTime),
                                endTime: formatTime(slot.endTime),
                            })),
                            emailMessage: emailMessage,
                            incursion: ModuleIncursionMap[event.module],
                            module: ModuleNameMap[event.module],
                            price: event.price,
                        },
                        { bcc: ['kym@fizzkidz.com.au'] }
                    )
                    break
                }
                default: {
                    const exhaustiveCheck: never = type
                    throw new Error(`Unhandled event type: '${exhaustiveCheck}'`)
                }
            }
        } catch (err) {
            throwTrpcError(
                'INTERNAL_SERVER_ERROR',
                'Event booked successfully, but an error occurred sending the confirmation email',
                err,
                { event }
            )
        }
    }
}

const formatDate = (date: Date) =>
    DateTime.fromJSDate(date, {
        zone: 'Australia/Melbourne',
    }).toLocaleString({
        weekday: 'short',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })

const formatTime = (date: Date) =>
    DateTime.fromJSDate(date, {
        zone: 'Australia/Melbourne',
    }).toLocaleString({
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
