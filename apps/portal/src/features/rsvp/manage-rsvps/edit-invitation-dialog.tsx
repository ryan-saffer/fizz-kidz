import { Share } from '@mui/icons-material'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useMutation } from '@tanstack/react-query'
import { Download, Edit, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { Img } from 'react-image'
import { toast } from 'sonner'

import type { InvitationsV2 } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@shared/components/ui/dialog'

import { CreateInvitationForm } from '../create-invitation-form'
import { useInvitation } from '../hooks/use-invitation'
import { useInvitationImage } from '../hooks/use-invitation-image'

export function EditInvitationDialog({
    isOpen,
    close,
    share,
}: {
    isOpen: boolean
    close: () => void
    share: () => void
}) {
    const trpc = useTRPC()
    const invitation = useInvitation()
    const invitationUrl = useInvitationImage(invitation.id, false)

    const [isEditing, setIsEditing] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)

    const { isPending, mutateAsync: generateAndLinkInvitation } = useMutation(
        trpc.parties.generateAndLinkInvitation.mutationOptions()
    )
    const { mutateAsync: getInvitationDownloadUrl } = useMutation(
        trpc.parties.getInvitationDownloadUrl.mutationOptions()
    )
    const { mutateAsync: generateNewDesignUrl, isPending: isPendingNewUrl } = useMutation(
        trpc.parties.generateInvitationUrl.mutationOptions()
    )

    async function onSubmit(values: InvitationsV2.Invitation) {
        try {
            await generateAndLinkInvitation({
                ...values,
                bookingId: invitation.bookingId,
                id: invitation.id,
                uid: invitation.uid,
                invitation: invitation.invitation,
            })
            setIsEditing(false)
            close()
            location.reload() // needed to refetch the image from storage
        } catch (err: any) {
            console.error(err)
            toast.error(err?.message || 'There was an error editing your invitation')
        }
    }

    async function downloadInvitation() {
        setIsDownloading(true)
        try {
            const url = await getInvitationDownloadUrl({ invitationId: invitation.id })
            const result = await fetch(url)
            const blob = await result.blob()
            const objectUrl = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.style.display = 'none'
            a.href = objectUrl
            a.download = `${invitation.childName}'s Party Invitation.png`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(objectUrl)
            a.remove()
        } catch {
            toast.error('There was an error downloading your invitation.')
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={() => {
                setIsEditing(false)
                close()
            }}
        >
            <DialogContent
                className="twp max-h-[90vh] w-full max-w-[95vw] overflow-auto border-none bg-gradient-to-br from-[#F7F1FF] via-white to-[#EAF6FF] p-0 sm:max-w-6xl sm:overflow-auto"
                aria-describedby={undefined}
            >
                <VisuallyHidden>
                    <DialogTitle>Your invite is ready to share</DialogTitle>
                </VisuallyHidden>
                {!isEditing ? (
                    <div className="grid gap-6 p-6 sm:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-6 pr-10">
                            <div className="space-y-2">
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                    Invitation preview
                                </p>
                                <p className="font-lilita text-3xl text-slate-900 sm:text-4xl">
                                    Your invite is ready to share
                                </p>
                                <p className="text-sm text-slate-600">
                                    Save, edit, or jump back to sending. You can always return to tweak details without
                                    losing RSVPs.
                                </p>
                            </div>
                            <div className="hidden items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#9B3EEA] shadow sm:inline-flex">
                                <Sparkles className="h-4 w-4" />
                                High-res download included
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-4 shadow-md backdrop-blur">
                            <div className="flex justify-center rounded-2xl bg-gradient-to-b from-slate-50 to-white p-2">
                                <Img
                                    src={invitationUrl}
                                    loader={<Loader className="my-12" />}
                                    className="max-h-[60vh] w-full max-w-4xl object-contain"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-3">
                            <Button
                                variant="outline"
                                className="w-full gap-2 rounded-xl border-slate-200 bg-white/80"
                                onClick={downloadInvitation}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="h-4 w-4" />
                                )}
                                {isDownloading ? 'Downloading...' : 'Download'}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full gap-2 rounded-xl border-slate-200 bg-white/80"
                                onClick={() => {
                                    close()
                                    share()
                                }}
                            >
                                <Share className="h-4 w-4" />
                                Share
                            </Button>
                            <Button
                                variant="darkPurple"
                                className="w-full gap-2 rounded-xl bg-[#9B3EEA] font-semibold hover:bg-[#8B2DE3]"
                                onClick={() => setIsEditing(true)}
                            >
                                <Edit className="h-4 w-4" />
                                Edit details
                            </Button>
                        </div>

                        <div className="flex flex-col items-start gap-3 rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-sm text-slate-700 shadow-sm">
                            <div className="flex w-full items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F2E7FF] text-[#9B3EEA]">
                                    <Wand2 className="h-4 w-4" />
                                </div>
                                <div className="flex w-full flex-col gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-900">Choose a different design</p>
                                        <p className="text-sm text-slate-600">
                                            Click the button below to choose a new design entirely. You won't lose any
                                            of your RSVP data.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full gap-2 rounded-xl"
                                onClick={async () => {
                                    const url = await generateNewDesignUrl({ bookingId: invitation.bookingId })
                                    window.location.assign(url)
                                }}
                                disabled={isPendingNewUrl}
                            >
                                {isPendingNewUrl ? (
                                    <Loader2 className="animate-spin" />
                                ) : (
                                    <>
                                        <Wand2 className="h-4 w-4" />
                                        Choose a new design
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 p-6 sm:p-8">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                Edit invitation
                            </p>
                            <p className="font-lilita text-3xl text-slate-900 sm:text-4xl">Update your party details</p>
                            <p className="text-sm text-slate-600">
                                To switch designs entirely, reopen the booking link and regenerate—your RSVP list will
                                stay safe.
                            </p>
                        </div>
                        <CreateInvitationForm
                            defaultValues={invitation}
                            isLoading={isPending}
                            onSubmit={onSubmit}
                            canEditSchedule
                            submitButton={
                                <div className="pt-4">
                                    <Button
                                        type="submit"
                                        className="w-full rounded-xl bg-[#9B3EEA] font-semibold hover:bg-[#8B2DE3]"
                                        disabled={isPending}
                                    >
                                        {isPending ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            'Save & refresh invite'
                                        )}
                                    </Button>
                                </div>
                            }
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
