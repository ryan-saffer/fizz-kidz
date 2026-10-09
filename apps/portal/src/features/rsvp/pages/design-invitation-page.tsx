import { useMutation } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import type { Invitations, WithoutId, WithoutUid } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { useAuth } from '@session/use-auth'
import Loader from '@shared/components/loader'
import { Button } from '@shared/components/ui/button'
import { Carousel, CarouselContent, CarouselItem } from '@shared/components/ui/carousel'
import type { CarouselApi } from '@shared/components/ui/carousel'

import { INVITATIONS } from '../constants/invitations'
import { CreateInvitationForm } from '../create-invitation-form'
import { useInvitationImage } from '../hooks/use-invitation-image'
import { useInvitationRouterState } from '../hooks/use-invitation-router-state'
import { LoginDialog } from '../login-dialog'
import { Navbar } from '../navbar'

export function DesignInvitationPage() {
    const trpc = useTRPC()
    const auth = useAuth()

    const state = useInvitationRouterState()
    const childName = state?.childName

    const [step, setStep] = useState(1)
    const [invitation, setInvitation] = useState<WithoutUid<Invitations.Invitation> | null>(null)

    const navigate = useNavigate()

    const [api, setApi] = useState<CarouselApi>()
    const subscribeToCarousel = useCallback(
        (onStoreChange: () => void) => {
            if (!api) {
                return () => {}
            }

            api.on('select', onStoreChange)
            api.on('reInit', onStoreChange)

            return () => {
                api.off('select', onStoreChange)
                api.off('reInit', onStoreChange)
            }
        },
        [api]
    )
    const selectedInvitation = useSyncExternalStore(
        subscribeToCarousel,
        () => api?.selectedScrollSnap() ?? 0,
        () => 0
    )
    const canScrollPrev = useSyncExternalStore(
        subscribeToCarousel,
        () => api?.canScrollPrev() ?? false,
        () => false
    )
    const canScrollNext = useSyncExternalStore(
        subscribeToCarousel,
        () => api?.canScrollNext() ?? false,
        () => false
    )

    const [finishPressed, setFinishPressed] = useState(false)

    const { mutateAsync: linkInvitation } = useMutation(trpc.parties.linkInvitation.mutationOptions())

    // scroll to top when moving between steps
    useEffect(() => {
        window.scrollTo({ top: 0 })
    }, [step])

    const hasCreatedAccount = !!auth?.uid && finishPressed

    // listening for when both authenticated and ready to move on
    useEffect(() => {
        async function _linkInvitation() {
            if (hasCreatedAccount && invitation) {
                try {
                    const { invitationId } = await linkInvitation(invitation)
                    navigate(`/invite/${invitationId}`)
                } catch (err: any) {
                    let message = 'There was an error linking your invitation to your booking.'
                    if (err instanceof TRPCClientError) {
                        message = err.message
                    }
                    toast.error(message, {
                        duration: Infinity,
                        closeButton: true,
                    })
                } finally {
                    setFinishPressed(false)
                }
            }
        }

        _linkInvitation()
    }, [hasCreatedAccount, invitation, linkInvitation, navigate])

    function nextStep() {
        if (step === 3) {
            setFinishPressed(true)
        } else {
            setStep((prev) => prev + 1)
        }
    }

    function goBack() {
        if (step === 1) {
            navigate(-1)
            return
        }

        setStep((prev) => prev - 1)
    }

    return (
        <div className="twp min-h-screen bg-gradient-to-br from-[#F7F1FF] via-white to-[#EAF6FF]">
            <Navbar />
            <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-3">
                    <Button variant="ghost" size="sm" className="gap-2 text-slate-700" onClick={goBack}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <div className="text-sm font-semibold text-slate-600">Step {step} of 3</div>
                </div>
                {childName && (
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/80 px-6 py-4 shadow-lg backdrop-blur">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-[#F2E7FF] p-2 text-[#9B3EEA]">
                                <Wand2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                                    Invitation setup
                                </p>
                                <p className="font-lilita text-2xl text-slate-900">{childName}'s birthday party</p>
                            </div>
                        </div>
                        <div className="hidden text-sm text-slate-600 sm:block">
                            We'll choose a design, personalise details, then preview & share.
                        </div>
                    </div>
                )}
                <div className="mt-6 h-2 rounded-full bg-white/60 shadow-inner">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[#9B3EEA] to-[#7EC8F4] transition-all"
                        style={{ width: `${(step / 3) * 100}%` }}
                    />
                </div>
                <div className="mt-8">
                    {!state ? (
                        <div className="flex min-h-64 items-center justify-center rounded-2xl border border-white/70 bg-white/80 shadow-2xl backdrop-blur">
                            <Loader />
                        </div>
                    ) : (
                        <>
                            {step === 1 && (
                                <Step1
                                    api={api}
                                    setApi={setApi}
                                    nextStep={nextStep}
                                    selectedInvitation={selectedInvitation}
                                    canScrollPrev={canScrollPrev}
                                    canScrollNext={canScrollNext}
                                />
                            )}
                            {step === 2 && (
                                <Step2
                                    selectedInvitation={selectedInvitation}
                                    onInvitationGenerated={(invitation) => {
                                        setInvitation(invitation)
                                        nextStep()
                                    }}
                                />
                            )}
                            {step === 3 && invitation && (
                                <Step3 invitationId={invitation.id} nextStep={nextStep} loading={hasCreatedAccount} />
                            )}
                        </>
                    )}
                </div>
                <LoginDialog open={!auth?.uid && finishPressed} />
            </div>
        </div>
    )
}

function Step1({
    api,
    setApi,
    nextStep,
    selectedInvitation,
    canScrollPrev,
    canScrollNext,
}: {
    api: CarouselApi | undefined
    setApi: (api: CarouselApi) => void
    nextStep: () => void
    selectedInvitation: number
    canScrollPrev: boolean
    canScrollNext: boolean
}) {
    const selectedName = INVITATIONS[selectedInvitation]?.name

    return (
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 1</p>
                    <p className="text-xl font-semibold text-slate-900">Choose your invitation design</p>
                    <p className="text-sm text-slate-600">Swipe through the options or use the arrows to preview.</p>
                </div>
                {selectedName && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#F2E7FF] px-3 py-2 text-sm font-semibold text-[#9B3EEA]">
                        <Sparkles className="h-4 w-4" />
                        {selectedName}
                    </div>
                )}
            </div>
            <div className="px-4 py-6 sm:px-6">
                <div className="mb-4 flex items-center justify-center gap-3">
                    <Button
                        disabled={!canScrollPrev}
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-white/80"
                        onClick={() => api?.scrollPrev()}
                    >
                        <ChevronLeft />
                    </Button>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Swipe or tap to preview
                    </p>
                    <Button
                        disabled={!canScrollNext}
                        variant="outline"
                        size="icon"
                        className="rounded-full bg-white/80"
                        onClick={() => api?.scrollNext()}
                    >
                        <ChevronRight />
                    </Button>
                </div>
                <Carousel className="pb-4" setApi={setApi} opts={{ align: 'center' }}>
                    <CarouselContent className="m-auto max-w-3xl">
                        {INVITATIONS.map((invitation, index) => {
                            const isActive = selectedInvitation === index
                            return (
                                <CarouselItem key={index} className="basis-full px-2 sm:px-4">
                                    <div
                                        className={`relative overflow-hidden rounded-2xl border bg-white shadow-lg transition-all duration-200 ${
                                            isActive ? 'scale-[1.01] border-slate-200 shadow-xl' : 'border-slate-100'
                                        }`}
                                    >
                                        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow">
                                            {invitation.name}
                                        </div>
                                        <img src={invitation.src} className="w-full" />
                                    </div>
                                </CarouselItem>
                            )
                        })}
                    </CarouselContent>
                </Carousel>
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
                    <p className="text-sm text-slate-600">
                        We'll personalise this design with your party details next.
                    </p>
                    <Button
                        className="rounded-xl bg-[#9B3EEA] px-6 text-sm font-semibold hover:bg-[#8B2DE3]"
                        onClick={nextStep}
                    >
                        Use this design
                    </Button>
                </div>
            </div>
        </div>
    )
}

function Step2({
    selectedInvitation,
    onInvitationGenerated,
}: {
    selectedInvitation: number
    onInvitationGenerated: (invitation: WithoutUid<Invitations.Invitation>) => void
}) {
    const trpc = useTRPC()
    const state = useInvitationRouterState()

    const { isPending, mutateAsync: generateInvitation } = useMutation(
        trpc.parties.generateInvitation.mutationOptions()
    )

    if (!state) return null

    const { bookingId, ...defaultValues } = state

    const onSubmit = async (values: Invitations.Invitation) => {
        try {
            const invitation = {
                childName: values.childName,
                childAge: values.childAge,
                time: values.time,
                date: values.date,
                studio: values.studio,
                parentName: values.parentName,
                rsvpDate: values.rsvpDate,
                parentMobile: values.parentMobile,
                invitation: INVITATIONS[selectedInvitation].name,
                rsvpNotificationsEnabled: values.rsvpNotificationsEnabled,
                bookingId,
                ...(values.$type === 'studio'
                    ? {
                          $type: 'studio',
                      }
                    : {
                          $type: 'mobile',
                          address: values.address,
                      }),
            } satisfies WithoutUid<WithoutId<Invitations.Invitation>>

            const { invitationId } = await generateInvitation(invitation)
            onInvitationGenerated({ ...invitation, id: invitationId })
        } catch (err: any) {
            if (err?.data?.code === 'UNAUTHORIZED') {
                // This page is not technically protected, and clearing cookies can remove their anonymous login.
                // In this case, they must return to the starting screen and sign in anonymously again.
                toast.error(
                    'There was an error generating your invitation. Please return to the link sent to you in your booking confirmation email.'
                )
            } else {
                toast.error('There was an error generating your invitation.')
            }
        }
    }

    return (
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-2xl backdrop-blur">
            <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 2</p>
                <p className="text-xl font-semibold text-slate-900">Confirm the party details</p>
                <p className="text-sm text-slate-600">
                    We pre-filled everything from your booking. Update anything that needs tweaking before we generate
                    your invite.
                </p>
            </div>
            <div className="relative px-4 py-6 sm:px-6">
                <CreateInvitationForm
                    defaultValues={defaultValues}
                    isLoading={isPending}
                    onSubmit={onSubmit}
                    submitButton={
                        <div className="sticky bottom-0 left-0 right-0 -mx-4 -mb-4 bg-gradient-to-t from-white via-white to-white/80 px-4 pb-4 pt-4 sm:px-0">
                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-[#9B3EEA] font-semibold shadow-lg hover:bg-[#8B2DE3]"
                                disabled={isPending}
                            >
                                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Preview invitation'}
                            </Button>
                        </div>
                    }
                    className="pb-20"
                />
            </div>
        </div>
    )
}

function Step3({ invitationId, nextStep, loading }: { invitationId: string; nextStep: () => void; loading: boolean }) {
    const invitationUrl = useInvitationImage(invitationId, true)
    const [loadedPreviewUrl, setLoadedPreviewUrl] = useState('')
    const isPreviewLoading = !invitationUrl || loadedPreviewUrl !== invitationUrl

    return (
        <div className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-2xl backdrop-blur">
            <div className="border-b border-slate-100 px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 3</p>
                <p className="text-xl font-semibold text-slate-900">Preview your invitation</p>
                <p className="text-sm text-slate-600">
                    Looks good? Save and move to sharing. You can go back to adjust details or pick a different design.
                </p>
            </div>
            <div className="px-4 py-8 sm:px-8">
                <div className="relative mx-auto aspect-[7/10] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    {isPreviewLoading && <Loader className="absolute inset-0 z-10" />}
                    {invitationUrl && (
                        <img
                            src={invitationUrl}
                            className={`h-full w-full transition-opacity duration-200 ${isPreviewLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setLoadedPreviewUrl(invitationUrl)}
                            onError={() => setLoadedPreviewUrl(invitationUrl)}
                            onContextMenu={() => false}
                        />
                    )}
                    <div className="absolute inset-0" />
                </div>
                <div className="mt-8 flex items-center justify-center">
                    <Button
                        onClick={nextStep}
                        className="min-w-[220px] rounded-xl bg-[#9B3EEA] px-6 font-semibold shadow-lg hover:bg-[#8B2DE3]"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Finish & share'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
