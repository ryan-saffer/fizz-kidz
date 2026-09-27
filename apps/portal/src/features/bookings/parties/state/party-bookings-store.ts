import { toast } from 'sonner'
import { create } from 'zustand'

import { getInvitationEntryUrl, getInvitationShareUrl } from '@fizz-kidz/core'
import type { Booking, FirestoreBooking, PartyLostReason, WithId } from '@fizz-kidz/core'

import type {
    DeletePartyBooking,
    UpdatePartyBooking,
} from '@server/features/party-bookings/functions/trpc/parties.trpc'

import {
    toNewBooking,
    toUpdatedBooking,
    type PartyBookingFormValues,
    type PartyBookingPrefill,
} from './party-booking-form'

type PartyBooking = WithId<FirestoreBooking>

/** The server calls the store makes. `PartyBookingDialog` registers them from React Query mutations. */
export type PartyBookingServer = {
    create: (booking: Booking) => Promise<unknown>
    update: (input: UpdatePartyBooking) => Promise<unknown>
    delete: (input: DeletePartyBooking) => Promise<unknown>
    getPartyFormUrl: (input: { bookingId: string }) => Promise<string>
    getCakeFormUrl: (input: { bookingId: string }) => Promise<string>
    resendConfirmationEmail: (input: { bookingId: string }) => Promise<unknown>
}

export type PartyBookingDialogState =
    | { mode: 'create'; prefill: PartyBookingPrefill }
    | { mode: 'edit'; booking: PartyBooking }

type State = {
    server: PartyBookingServer | null
    /** Moves the bookings page to a date, so a saved booking is on screen. */
    showDate: ((date: Date) => void) | null
    dialog: PartyBookingDialogState | null
    /** The booking waiting on a lost reason before it's deleted. */
    deleting: PartyBooking | null
    /** The booking with a menu action (copying a link, sending an email...) in progress. */
    busyBookingId: string | null
}

type Actions = {
    register: (input: Pick<State, 'server' | 'showDate'>) => void
    openCreate: (prefill?: PartyBookingPrefill) => void
    openEdit: (booking: PartyBooking) => void
    closeDialog: () => void
    /** Creates or updates the booking in the dialog, which stays open if the server fails. */
    save: (values: PartyBookingFormValues) => Promise<void>
    requestDelete: (booking: PartyBooking) => void
    cancelDelete: () => void
    confirmDelete: (lostReason: PartyLostReason, otherReason?: string) => Promise<void>
    copyPartyFormLink: (booking: PartyBooking) => Promise<void>
    copyCakeFormLink: (booking: PartyBooking) => Promise<void>
    copyInvitationLink: (booking: PartyBooking) => Promise<void>
    resendConfirmationEmail: (booking: PartyBooking) => Promise<void>
}

const initialState: State = {
    server: null,
    showDate: null,
    dialog: null,
    deleting: null,
    busyBookingId: null,
}

/**
 * How party bookings are managed from the bookings page: creating and editing in the dialog, deleting with a lost
 * reason, and the booking menu's links and emails. The answers and their rules live in the TanStack form
 * (`party-booking-form.ts` and `party-booking-schema.ts`); the list itself streams from Firestore.
 */
export const usePartyBookingsStore = create<State & Actions>((set, get) => ({
    ...initialState,

    register: ({ server, showDate }) => set({ server, showDate }),

    openCreate: (prefill = {}) => set({ dialog: { mode: 'create', prefill } }),

    openEdit: (booking) => set({ dialog: { mode: 'edit', booking } }),

    closeDialog: () => set({ dialog: null }),

    save: async (values) => {
        const { server, dialog, showDate } = get()
        if (!server || !dialog) return
        try {
            if (dialog.mode === 'create') {
                await server.create(toNewBooking(values))
                toast.success('Party booked.')
            } else {
                await server.update({ bookingId: dialog.booking.id, booking: toUpdatedBooking(values, dialog.booking) })
                toast.success('Party updated.')
            }
        } catch (error) {
            toast.error(
                dialog.mode === 'create'
                    ? `The party hasn't been booked. ${getErrorMessage(error)}`
                    : `The party hasn't been updated. ${getErrorMessage(error)}`
            )
            return
        }
        set({ dialog: null })
        showDate?.(new Date(`${values.date}T00:00`))
    },

    requestDelete: (booking) => set({ deleting: booking }),

    cancelDelete: () => set({ deleting: null }),

    confirmDelete: async (lostReason, otherReason) => {
        const { server, deleting, showDate } = get()
        if (!server || !deleting) return
        try {
            await server.delete({
                bookingId: deleting.id,
                eventId: deleting.eventId!,
                location: deleting.location,
                type: deleting.type,
                lostReason,
                lostReasonOtherDetails: lostReason === 'Other' ? otherReason?.trim() : undefined,
            })
        } catch (error) {
            toast.error(`The booking hasn't been deleted. ${getErrorMessage(error)}`)
            return
        }
        set({ deleting: null })
        toast.success('Booking deleted.')
        // reloads the day, which clears the deleted booking from the list
        showDate?.(deleting.dateTime.toDate())
    },

    copyPartyFormLink: (booking) =>
        runBookingAction(booking, async (server) => {
            await copy(await server.getPartyFormUrl({ bookingId: booking.id }))
            toast.success('Party form link copied.')
        }),

    copyCakeFormLink: (booking) =>
        runBookingAction(booking, async (server) => {
            await copy(await server.getCakeFormUrl({ bookingId: booking.id }))
            toast.success('Cake form link copied.')
        }),

    copyInvitationLink: async (booking) => {
        const env = import.meta.env.VITE_ENV
        await copy(
            booking.invitationId
                ? getInvitationShareUrl(env, import.meta.env.DEV, booking.invitationId)
                : getInvitationEntryUrl(env, import.meta.env.DEV, booking.id)
        )
        toast.success('Invitation link copied.')
    },

    resendConfirmationEmail: (booking) =>
        runBookingAction(booking, async (server) => {
            await server.resendConfirmationEmail({ bookingId: booking.id })
            toast.success(`Confirmation email sent to ${booking.parentEmail}.`)
        }),
}))

async function runBookingAction(booking: PartyBooking, action: (server: PartyBookingServer) => Promise<void>) {
    const { server, busyBookingId } = usePartyBookingsStore.getState()
    if (!server || busyBookingId) return
    usePartyBookingsStore.setState({ busyBookingId: booking.id })
    try {
        await action(server)
    } catch (error) {
        toast.error(getErrorMessage(error))
    } finally {
        usePartyBookingsStore.setState({ busyBookingId: null })
    }
}

async function copy(text: string) {
    await navigator.clipboard.writeText(text)
}

function getErrorMessage(error: unknown) {
    return (error as { message?: string }).message || 'Something went wrong. Please try again.'
}
