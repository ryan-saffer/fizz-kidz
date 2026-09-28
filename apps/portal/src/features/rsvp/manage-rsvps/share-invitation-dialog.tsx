import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { useMutation } from '@tanstack/react-query'
import { Copy, Download, Loader2, Mail, MessageCircleMore, PartyPopper, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { WhatsappShareButton } from 'react-share'
import { toast } from 'sonner'

import { getInvitationShareUrl } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { WhatsappIcon } from '@shared/assets/icons/whatsapp'
import { Button } from '@shared/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@shared/components/ui/dialog'
import { Input } from '@shared/components/ui/input'
import { copyToClipboard } from '@shared/lib/clipboard'

import { useInvitation } from '../hooks/use-invitation'

export function ShareInvitaitonDialog({ isOpen, close }: { isOpen: boolean; close: () => void }) {
    const trpc = useTRPC()
    const invitation = useInvitation()
    const [isDownloading, setIsDownloading] = useState(false)
    const invitationText = `You're invited to ${invitation.childName}'s party!`
    const inviteUrl = getInvitationShareUrl(import.meta.env.VITE_ENV, import.meta.env.DEV, invitation.id)
    const { mutateAsync: getInvitationDownloadUrl } = useMutation(
        trpc.parties.getInvitationDownloadUrl.mutationOptions()
    )

    async function copy() {
        try {
            await copyToClipboard(inviteUrl)
            toast.success('Invitation copied to clipboard!')
        } catch (error) {
            toast.error((error as Error).message)
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
        <Dialog open={isOpen} onOpenChange={close}>
            <DialogContent
                className="twp max-w-3xl overflow-hidden border-none bg-gradient-to-br from-[#F7F1FF] via-white to-[#EAF6FF] p-0"
                aria-describedby={undefined}
            >
                <VisuallyHidden>
                    <DialogTitle>Share your invitation</DialogTitle>
                </VisuallyHidden>
                <div className="space-y-6 p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-[#9B3EEA]">
                                <PartyPopper className="h-4 w-4" />
                                Ready to send
                            </div>
                            <h5 className="font-lilita text-3xl text-slate-900 sm:text-4xl">Share your invitation</h5>
                            <p className="text-sm text-slate-600">
                                Share the link or download and print the invite (QR code included) so guests can RSVP
                                instantly.
                            </p>
                        </div>
                        <div className="hidden items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#9B3EEA] shadow sm:inline-flex">
                            <Sparkles className="h-4 w-4" />
                            Link never expires
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/70 bg-white/80 p-3 shadow-md backdrop-blur">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
                            <Input value={inviteUrl} readOnly className="text-sm" />
                            <Button variant="outline" className="w-full sm:w-auto" onClick={copy}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy link
                            </Button>
                            <Button
                                variant="ghost"
                                className="w-full sm:w-auto"
                                onClick={downloadInvitation}
                                disabled={isDownloading}
                            >
                                {isDownloading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                )}
                                {isDownloading ? 'Downloading...' : 'Download invite'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <ShareTile>
                            <WhatsappShareButton
                                url={inviteUrl}
                                aria-label="Share on WhatsApp"
                                className="absolute inset-0 z-10 h-full w-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B3EEA] focus-visible:ring-offset-2"
                            >
                                <span className="sr-only">Share on WhatsApp</span>
                            </WhatsappShareButton>
                            <WhatsappIcon aria-hidden="true" size={32} />
                            <span className="mt-2 text-sm font-semibold text-slate-800">WhatsApp</span>
                        </ShareTile>
                        <ShareTile onClick={() => window.open(`sms://?body=${encodeURIComponent(inviteUrl)}`)}>
                            <MessageCircleMore id="sms" className="h-8 w-8 text-slate-800" />
                            <span className="mt-2 text-sm font-semibold text-slate-800">SMS</span>
                        </ShareTile>
                        <ShareTile
                            onClick={() =>
                                window.open(
                                    `mailto: ?subject=${encodeURIComponent(invitationText)}&body=${encodeURIComponent(inviteUrl)}`
                                )
                            }
                        >
                            <Mail id="email" className="h-8 w-8 text-slate-800" />
                            <span className="mt-2 text-sm font-semibold text-slate-800">Email</span>
                        </ShareTile>
                    </div>

                    <p className="px-8 text-center text-sm text-muted-foreground">
                        Want to see what your guests will experience? Try opening the link in an{' '}
                        <span className="italic">incognito</span> or <span className="italic">private</span> window.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ShareTile({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
    return (
        <div
            onClick={onClick}
            onKeyDown={(event) => {
                if (!onClick) return
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onClick()
                }
            }}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            className="group relative flex h-full w-full flex-col items-center justify-center rounded-xl border border-white/70 bg-white/80 p-3 text-slate-700 shadow-sm transition hover:border-[#9B3EEA]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B3EEA] focus-visible:ring-offset-2"
        >
            <span className="flex flex-col items-center justify-center gap-1 group-hover:text-[#9B3EEA]">
                {children}
            </span>
        </div>
    )
}
