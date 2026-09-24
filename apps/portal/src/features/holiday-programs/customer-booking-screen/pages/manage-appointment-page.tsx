import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'

import { HOLIDAY_PROGRAM_POLICY } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import Root from '@shared/components/public-page-shell'
import { Button } from '@shared/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@shared/components/ui/dialog'

import { SessionDetails } from '../components/session-details'
import { formatSessionTime } from '../components/session-time'

export function ManageAppointmentPage() {
    const { appointmentId } = useParams()
    const { hash } = useLocation()
    const token = new URLSearchParams(hash.slice(1)).get('token') || ''

    return (
        <Root width="centered">
            <div className="w-full max-w-[500px] space-y-6 pb-4">
                <header className="space-y-2 text-center">
                    <h1 className="text-2xl font-semibold">Manage your holiday program</h1>
                    <p className="text-sm text-muted-foreground">Change or cancel one child's session.</p>
                </header>
                <ManageAppointment appointmentId={Number(appointmentId)} token={token} />
                <section className="space-y-3 border-t pt-5 text-sm">
                    <h2 className="font-semibold">{HOLIDAY_PROGRAM_POLICY.title}</h2>
                    {HOLIDAY_PROGRAM_POLICY.paragraphs.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                    ))}
                </section>
                <p className="text-center text-sm">
                    Need a hand? Call{' '}
                    <a className="underline" href="tel:0390598144">
                        (03) 9059 8144
                    </a>
                    .
                </p>
            </div>
        </Root>
    )
}

function ManageAppointment(access: { appointmentId: number; token: string }) {
    const trpc = useTRPC()
    const queryClient = useQueryClient()
    const [choosingSession, setChoosingSession] = useState(false)
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
    const [confirmation, setConfirmation] = useState<'cancel' | 'reschedule' | null>(null)
    const [notice, setNotice] = useState('')
    const [error, setError] = useState('')

    const appointmentQueryKey = trpc.holidayPrograms.getManagedAppointment.queryKey(access)
    const {
        data: appointment,
        isPending,
        error: loadError,
    } = useQuery(trpc.holidayPrograms.getManagedAppointment.queryOptions(access, { retry: false }))
    const sessions = useQuery(
        trpc.holidayPrograms.rescheduleSessions.queryOptions(access, { enabled: choosingSession })
    )
    const selected = sessions.data?.find((session) => session.id === selectedClassId)

    function onSuccess(message: string) {
        void queryClient.invalidateQueries({ queryKey: appointmentQueryKey })
        setConfirmation(null)
        setChoosingSession(false)
        setSelectedClassId(null)
        setNotice(message)
    }
    function onError(cause: { message: string }) {
        setConfirmation(null)
        setError(cause.message)
    }
    const cancel = useMutation(
        trpc.holidayPrograms.cancelAppointment.mutationOptions({
            onSuccess: () =>
                onSuccess(
                    'Your session has been cancelled. You will receive a cancellation email with any refund details.'
                ),
            onError,
        })
    )
    const reschedule = useMutation(
        trpc.holidayPrograms.rescheduleAppointment.mutationOptions({
            onSuccess: () =>
                onSuccess('Your session has been rescheduled. We have emailed your updated booking details.'),
            onError,
        })
    )
    const busy = cancel.isPending || reschedule.isPending

    if (isPending) {
        return (
            <p role="status" className="py-6 text-center">
                Loading your booking...
            </p>
        )
    }
    if (!appointment) {
        return <p role="alert">{loadError?.message || 'We could not load your booking. Please try again.'}</p>
    }

    return (
        <>
            {notice && (
                <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
                    {notice}
                </p>
            )}
            {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                    {error}
                </p>
            )}
            <section className="space-y-2 rounded-lg border bg-slate-50 p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">
                    {appointment.canceled ? 'Cancelled session' : 'Current session'}
                </h2>
                <p className="text-lg font-semibold">{appointment.childName}</p>
                <SessionDetails time={appointment.datetime} duration={Number(appointment.duration)} />
                <p className="font-medium">Fizz Kidz {appointment.studio}</p>
                <p className="text-sm text-muted-foreground">{appointment.address}</p>
            </section>
            {appointment.canceled ? (
                <p>This appointment has been cancelled. Other sessions in your booking are managed separately.</p>
            ) : !appointment.canCancel ? (
                <p>This session has already started. Please contact us if you need help with your booking.</p>
            ) : (
                <>
                    {!appointment.canReschedule && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
                            Your session starts in less than 48 hours, so rescheduling is no longer available. You can
                            still cancel, but your booking will not be refunded.
                        </p>
                    )}
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                            className="flex-1 bg-gradient-to-r from-pink-400 to-yellow-400 text-white"
                            disabled={!appointment.canReschedule || busy}
                            onClick={() => {
                                setChoosingSession(true)
                                setError('')
                                setNotice('')
                            }}
                        >
                            Reschedule session
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1"
                            disabled={busy}
                            onClick={() => {
                                setError('')
                                setConfirmation('cancel')
                            }}
                        >
                            Cancel session
                        </Button>
                    </div>
                    {choosingSession && (
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold">Choose a new session</h2>
                            <p className="text-sm">
                                Available sessions at Fizz Kidz {appointment.studio}. Your current booking stays in
                                place until you confirm the change.
                            </p>
                            <a
                                className="block text-sm underline"
                                href="https://www.fizzkidz.com.au/holiday-programs/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                View what we are making each day
                            </a>
                            {sessions.isPending ? (
                                <p role="status">Loading sessions...</p>
                            ) : sessions.isError ? (
                                <p role="alert">We could not load available sessions. Please try again later.</p>
                            ) : !sessions.data.some((session) => session.slotsAvailable > 0) ? (
                                <p>
                                    No other sessions are available at this studio at the moment. Please check again
                                    later or contact us.
                                </p>
                            ) : (
                                <fieldset className="space-y-2" disabled={busy}>
                                    <legend className="sr-only">Choose one replacement session</legend>
                                    {sessions.data.map((session) => (
                                        <label
                                            key={session.id}
                                            className={`flex items-start gap-3 rounded-lg border p-3 ${session.slotsAvailable === 0 ? 'opacity-50' : 'cursor-pointer'} ${selectedClassId === session.id ? 'border-pink-400 bg-pink-50' : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="replacement-session"
                                                className="mt-1 accent-pink-500"
                                                checked={selectedClassId === session.id}
                                                disabled={session.slotsAvailable < 1}
                                                onChange={() => setSelectedClassId(session.id)}
                                            />
                                            <SessionDetails
                                                time={session.time}
                                                title={session.title}
                                                duration={session.duration}
                                                slotsAvailable={session.slotsAvailable}
                                            />
                                        </label>
                                    ))}
                                </fieldset>
                            )}
                            <div className="flex gap-3">
                                <Button
                                    disabled={!selected || busy}
                                    onClick={() => {
                                        setError('')
                                        setConfirmation('reschedule')
                                    }}
                                >
                                    Continue
                                </Button>
                                <Button
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => {
                                        setChoosingSession(false)
                                        setSelectedClassId(null)
                                    }}
                                >
                                    Keep current session
                                </Button>
                            </div>
                        </section>
                    )}
                </>
            )}
            <Dialog open={confirmation !== null} onOpenChange={(open) => !open && !busy && setConfirmation(null)}>
                <DialogContent className="twp" hideCloseBtn={busy}>
                    <DialogHeader>
                        <DialogTitle>
                            {confirmation === 'cancel' ? 'Cancel this session?' : 'Confirm your new session'}
                        </DialogTitle>
                        <DialogDescription>
                            This changes only {appointment.childName}'s appointment. Any other booked sessions stay the
                            same.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 text-sm">
                        <p>
                            <strong>Current session:</strong>{' '}
                            {formatSessionTime(appointment.datetime, Number(appointment.duration))}
                        </p>
                        {confirmation === 'cancel' ? (
                            <p>
                                {appointment.canReschedule
                                    ? 'The amount paid for this session will be automatically refunded to your original payment method.'
                                    : 'This cancellation will not be refunded because the session starts in less than 48 hours.'}
                            </p>
                        ) : (
                            selected && (
                                <p>
                                    <strong>New session:</strong> {formatSessionTime(selected.time, selected.duration)}{' '}
                                    at Fizz Kidz {appointment.studio}.
                                </p>
                            )
                        )}
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>
                            Go back
                        </Button>
                        <Button
                            variant={confirmation === 'cancel' ? 'destructive' : 'default'}
                            disabled={busy}
                            onClick={() => {
                                if (confirmation === 'cancel') cancel.mutate(access)
                                else if (selected) reschedule.mutate({ ...access, classId: selected.id })
                            }}
                        >
                            {busy
                                ? 'Saving...'
                                : confirmation === 'cancel'
                                  ? 'Yes, cancel session'
                                  : 'Confirm reschedule'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
