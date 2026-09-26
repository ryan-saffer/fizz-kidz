import { Link2, Loader2, Mail, MoreHorizontal, Pencil, Trash2, UsersRound } from 'lucide-react'

import { getInvitationShareUrl } from '@fizz-kidz/core'
import type { FirestoreBooking, WithId } from '@fizz-kidz/core'

import { useOrg } from '@session/use-org'
import { useConfirm } from '@shared/components/dialogs/confirmation/use-confirmation-dialog'
import { Button } from '@shared/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu'

import { usePartyBookingsStore } from '../state/party-bookings-store'

export function PartyBookingActions({ booking }: { booking: WithId<FirestoreBooking> }) {
    const { hasPermission } = useOrg()
    const canEdit = hasPermission('bookings:edit')
    const confirm = useConfirm()
    const busy = usePartyBookingsStore((state) => state.busyBookingId === booking.id)
    const store = usePartyBookingsStore.getState

    const handleResendConfirmation = async () => {
        const confirmed = await confirm({
            title: 'Resend confirmation email?',
            description: `This will send the party booking confirmation email to ${booking.parentEmail}.`,
        })
        if (confirmed) await store().resendConfirmationEmail(booking)
    }

    return (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {canEdit && (
                <Button size="sm" variant="darkPurple" onClick={() => store().openEdit(booking)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                </Button>
            )}
            {booking.invitationId && (
                <Button size="sm" variant="outline" className="bg-white" asChild>
                    <a
                        href={getInvitationShareUrl(
                            import.meta.env.VITE_ENV,
                            import.meta.env.DEV,
                            booking.invitationId
                        )}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <UsersRound className="mr-2 h-4 w-4" />
                        View RSVPs
                    </a>
                </Button>
            )}
            {canEdit && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="bg-white" aria-label="More actions">
                            {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <MoreHorizontal className="h-4 w-4" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="twp z-[1302] w-60">
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger disabled={busy}>
                                <Link2 className="mr-2 h-4 w-4" />
                                Copy form link
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent className="twp z-[1302]">
                                    <DropdownMenuItem onClick={() => store().copyPartyFormLink(booking)}>
                                        Party form
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => store().copyCakeFormLink(booking)}>
                                        Cake form
                                    </DropdownMenuItem>
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                        {booking.useRsvpSystem && (
                            <DropdownMenuItem onClick={() => store().copyInvitationLink(booking)}>
                                <Link2 className="mr-2 h-4 w-4" />
                                Copy invitation link
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem disabled={busy} onClick={handleResendConfirmation}>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend confirmation email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => store().requestDelete(booking)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete booking
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    )
}
