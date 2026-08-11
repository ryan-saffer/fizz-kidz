import type { Event } from '@fizz-kidz/core'

import { trimEventTextFields } from './event-input'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { DatabaseClient } from '@/integrations/firebase/database.client'
import { CalendarClient } from '@/integrations/google/calendar.client'
import { ZohoClient } from '@/integrations/zoho/zoho.client'

export async function updateEvent(event: Event) {
    event = trimEventTextFields(event)

    if (!event.contactName) {
        throwTrpcError('BAD_REQUEST', 'Contact name is required')
    }

    // parse strings back into date
    event.startTime = new Date(event.startTime)
    event.endTime = new Date(event.endTime)

    try {
        const calendarClient = await CalendarClient.getInstance()
        await calendarClient.updateEvent(
            event.calendarEventId,
            { eventType: 'events' },
            {
                title: event.eventName,
                location: event.address,
                start: event.startTime,
                end: event.endTime,
                description: event.notes,
            }
        )

        const siblings = await DatabaseClient.updateEventBooking(event.eventId, event.id, event)

        await Promise.all(
            siblings.map((sibling) =>
                calendarClient.updateEvent(
                    sibling.calendarEventId,
                    { eventType: 'events' },
                    {
                        title: event.eventName,
                        location: event.address,
                        start: sibling.startTime,
                        end: sibling.endTime,
                        description: event.notes,
                    },
                    { useExponentialBackoff: true }
                )
            )
        )

        if (event.zohoDealId) {
            await new ZohoClient().updateB2BDealFromEvent({
                dealId: event.zohoDealId,
                event,
                slots: [event, ...siblings],
            })
        }
    } catch (err) {
        console.log(err)
        throwTrpcError('INTERNAL_SERVER_ERROR', `error updating event with id ${event.id}`, err)
    }
}
