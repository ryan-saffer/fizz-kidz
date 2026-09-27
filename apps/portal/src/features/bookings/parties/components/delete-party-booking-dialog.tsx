import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { PARTY_LOST_REASONS } from '@fizz-kidz/core'
import type { PartyLostReason } from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@shared/components/ui/dialog'
import { Label } from '@shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'
import { Textarea } from '@shared/components/ui/textarea'

import { useWhileClosing } from '../hooks/use-while-closing'
import { usePartyBookingsStore } from '../state/party-bookings-store'

/** Deleting a booking records why it was lost, and also removes its invitation and RSVPs. */
export function DeletePartyBookingDialog() {
    const open = usePartyBookingsStore((state) => state.deleting !== null)
    const booking = useWhileClosing(usePartyBookingsStore((state) => state.deleting))
    const cancelDelete = usePartyBookingsStore((state) => state.cancelDelete)

    return (
        <Dialog open={open} onOpenChange={(open) => !open && cancelDelete()}>
            {/* remounts per booking so the reason starts empty */}
            {booking && <DeleteForm key={booking.id} />}
        </Dialog>
    )
}

function DeleteForm() {
    const cancelDelete = usePartyBookingsStore((state) => state.cancelDelete)
    const confirmDelete = usePartyBookingsStore((state) => state.confirmDelete)
    const [reason, setReason] = useState<PartyLostReason | ''>('')
    const [otherReason, setOtherReason] = useState('')
    const [pending, setPending] = useState(false)

    const canDelete = reason !== '' && (reason !== 'Other' || otherReason.trim() !== '')

    const handleDelete = async () => {
        if (!canDelete) return
        setPending(true)
        await confirmDelete(reason, otherReason)
        setPending(false)
    }

    return (
        <DialogContent className="twp sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Delete booking</DialogTitle>
                <DialogDescription>
                    This also deletes the party’s invitation and RSVPs, and can’t be undone.
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
                <Label className="text-slate-700">Why was the party lost?</Label>
                <RadioGroup
                    value={reason}
                    onValueChange={(value) => setReason(value as PartyLostReason)}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                >
                    {PARTY_LOST_REASONS.map((lostReason) => (
                        <div key={lostReason} className="flex items-center gap-2">
                            <RadioGroupItem id={`lost-reason-${lostReason}`} value={lostReason} />
                            <Label htmlFor={`lost-reason-${lostReason}`} className="font-normal">
                                {lostReason}
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
                {reason === 'Other' && (
                    <Textarea
                        aria-label="Other reason"
                        placeholder="What happened?"
                        value={otherReason}
                        onChange={(e) => setOtherReason(e.target.value)}
                    />
                )}
            </div>
            <DialogFooter className="gap-2">
                <Button variant="outline" onClick={cancelDelete} disabled={pending}>
                    Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || pending}>
                    {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete booking
                </Button>
            </DialogFooter>
        </DialogContent>
    )
}
