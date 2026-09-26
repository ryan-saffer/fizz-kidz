import { useMutation } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { useEffect } from 'react'

import { getPartyBirthdayChildDisplay } from '@fizz-kidz/core'

import { useDateNavigation } from '@features/bookings/date-navigation/date-navigation.hooks'
import { useTRPC } from '@integrations/trpc'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@shared/components/ui/sheet'

import { useWhileClosing } from '../hooks/use-while-closing'
import { usePartyBookingsStore } from '../state/party-bookings-store'
import { DeletePartyBookingDialog } from './delete-party-booking-dialog'
import { PartyBookingForm } from './form/party-booking-form'

/**
 * The full screen dialog for booking or editing a party, and the delete dialog. Mounted once on the bookings page,
 * where it also gives the store its server calls.
 */
export function PartyBookingDialog() {
    usePartyBookingServer()
    const open = usePartyBookingsStore((state) => state.dialog !== null)
    const dialog = useWhileClosing(usePartyBookingsStore((state) => state.dialog))
    const closeDialog = usePartyBookingsStore((state) => state.closeDialog)

    return (
        <>
            <Sheet open={open} onOpenChange={(open) => !open && closeDialog()}>
                {/* slides up to fill the screen */}
                <SheetContent
                    side="bottom"
                    className="twp top-0 flex h-[100dvh] flex-col gap-0 border-0 bg-slate-100 p-0 focus:outline-none"
                    // focusing the first field would pop the keyboard up over the form on the iPads
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    {dialog && (
                        <>
                            <SheetHeader className="border-b border-slate-200 bg-white px-4 py-4 text-left sm:px-6">
                                <div className="mx-auto w-full max-w-3xl pr-8">
                                    <SheetTitle className="font-lilita text-2xl font-normal">
                                        {dialog.mode === 'create' ? 'New party booking' : 'Edit party booking'}
                                    </SheetTitle>
                                    <SheetDescription>
                                        {dialog.mode === 'create'
                                            ? 'Book the party in. The parent fills in creations and food in their party form.'
                                            : `${getPartyBirthdayChildDisplay(dialog.booking)} party · ${dialog.booking.parentFirstName} ${dialog.booking.parentLastName}`}
                                    </SheetDescription>
                                </div>
                            </SheetHeader>
                            <PartyBookingForm
                                key={dialog.mode === 'edit' ? dialog.booking.id : 'new'}
                                dialog={dialog}
                            />
                        </>
                    )}
                </SheetContent>
            </Sheet>
            <DeletePartyBookingDialog />
        </>
    )
}

function usePartyBookingServer() {
    const trpc = useTRPC()
    const { setDate } = useDateNavigation()
    const register = usePartyBookingsStore((state) => state.register)

    const { mutateAsync: create } = useMutation(trpc.parties.createPartyBooking.mutationOptions())
    const { mutateAsync: update } = useMutation(trpc.parties.updatePartyBooking.mutationOptions())
    const { mutateAsync: remove } = useMutation(trpc.parties.deletePartyBooking.mutationOptions())
    const { mutateAsync: getPartyFormUrl } = useMutation(trpc.parties.getPartyFormUrl.mutationOptions())
    const { mutateAsync: getCakeFormUrl } = useMutation(trpc.parties.getCakeFormUrl.mutationOptions())
    const { mutateAsync: resendConfirmationEmail } = useMutation(
        trpc.parties.resendPartyBookingConfirmationEmail.mutationOptions()
    )

    useEffect(() => {
        register({
            server: { create, update, delete: remove, getPartyFormUrl, getCakeFormUrl, resendConfirmationEmail },
            showDate: (date) => setDate(DateTime.fromJSDate(date)),
        })
    }, [register, create, update, remove, getPartyFormUrl, getCakeFormUrl, resendConfirmationEmail, setDate])

    // the store outlives the page, so leaving it closes anything still open
    useEffect(
        () => () => {
            const { closeDialog, cancelDelete } = usePartyBookingsStore.getState()
            closeDialog()
            cancelDelete()
        },
        []
    )
}
