import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AcuityConstants, capitalise } from '@fizz-kidz/core'
import type { StudioOrTest } from '@fizz-kidz/core'

import { resolveCalendarStudio } from '@features/preschool-program/booking-form/utils/resolve-calendar-studio'
import { filterAttendanceClassesForCurrentTerms } from '@features/preschool-program/booking-v2/state/session-grouping'
import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Label } from '@shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Skeleton } from '@shared/components/ui/skeleton'

const APPOINTMENT_TYPE_ID =
    import.meta.env.VITE_ENV === 'prod'
        ? AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM
        : AcuityConstants.AppointmentTypes.TEST_PRESCHOOL_PROGRAM

export function PreschoolProgramSessionSelectorPage() {
    const { currentOrg } = useOrg()
    return <SessionSelector key={currentOrg ?? 'master'} currentOrg={currentOrg} />
}

function SessionSelector({ currentOrg }: { currentOrg: ReturnType<typeof useOrg>['currentOrg'] }) {
    const trpc = useTRPC()
    const navigate = useNavigate()
    const [today] = useState(() => DateTime.now())
    const [selectedStudio, setSelectedStudio] = useState<StudioOrTest | null>(
        currentOrg === 'master' ? null : import.meta.env.VITE_ENV === 'prod' ? currentOrg : 'test'
    )
    const [selectedClassId, setSelectedClassId] = useState<string>('')
    const [showPreviousSessions, setShowPreviousSessions] = useState(false)

    const classesQuery = useQuery(
        trpc.acuity.classAvailability.queryOptions({
            appointmentTypeIds: [APPOINTMENT_TYPE_ID],
            includeUnavailable: true,
            minDate: today.minus({ months: 6 }).toMillis(),
        })
    )

    const availableStudios = useMemo(() => {
        return Array.from(
            new Set(
                (classesQuery.data || [])
                    .map((klass) => resolveCalendarStudio(klass.calendarID))
                    .filter((studio): studio is StudioOrTest => !!studio)
            )
        ).sort((a, b) => a.localeCompare(b))
    }, [classesQuery.data])

    const sessions = useMemo(() => {
        if (!selectedStudio) return []

        const studioClasses = (classesQuery.data || []).filter(
            (klass) => resolveCalendarStudio(klass.calendarID) === selectedStudio
        )
        const visibleClassIds = new Set(
            filterAttendanceClassesForCurrentTerms(
                studioClasses.map((klass) => ({ ...klass, time: new Date(klass.time) })),
                showPreviousSessions,
                today.toJSDate()
            ).map((klass) => klass.id)
        )

        return studioClasses
            .filter((klass) => visibleClassIds.has(klass.id))
            .sort((a, b) => DateTime.fromISO(a.time).toMillis() - DateTime.fromISO(b.time).toMillis())
    }, [classesQuery.data, selectedStudio, showPreviousSessions, today])

    const selectedClass = sessions.find((klass) => klass.id.toString() === selectedClassId)

    function selectSession() {
        if (!selectedClass) return

        navigate(
            `${APPOINTMENT_TYPE_ID}?classId=${selectedClass.id}&calendarId=${selectedClass.calendarID}&classTime=${encodeURIComponent(selectedClass.time)}&className=${encodeURIComponent('Preschool Program')}`
        )
    }

    if (classesQuery.isPending) {
        return (
            <PageCard>
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
            </PageCard>
        )
    }

    if (classesQuery.isError) {
        return (
            <div className="twp flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-lg">
                    <AlertTitle>Unable to load preschool sessions</AlertTitle>
                    <AlertDescription className="mt-2 flex items-center justify-between gap-4">
                        Please try again.
                        <Button variant="outline" size="sm" onClick={() => classesQuery.refetch()}>
                            {classesQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : 'Retry'}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <PageCard>
            {currentOrg === 'master' ? (
                <div className="space-y-2">
                    <Label htmlFor="preschool-studio">Studio</Label>
                    <Select
                        value={selectedStudio || ''}
                        onValueChange={(value) => {
                            setSelectedStudio(value as StudioOrTest)
                            setSelectedClassId('')
                        }}
                    >
                        <SelectTrigger id="preschool-studio">
                            <SelectValue placeholder="Select a studio" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableStudios.map((studio) => (
                                <SelectItem value={studio} key={studio}>
                                    {capitalise(studio)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            ) : null}

            <div className="space-y-2">
                <Label htmlFor="preschool-session">Session</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={!selectedStudio}>
                    <SelectTrigger id="preschool-session">
                        <SelectValue
                            placeholder={
                                sessions.length === 0 && selectedStudio ? 'No sessions found' : 'Select a session'
                            }
                        />
                    </SelectTrigger>
                    <SelectContent>
                        {sessions.map((klass) => (
                            <SelectItem value={klass.id.toString()} key={klass.id}>
                                {DateTime.fromISO(klass.time, { setZone: true }).toFormat('cccc d LLLL, h:mm a')}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
                <Checkbox
                    id="show-previous-preschool-sessions"
                    checked={showPreviousSessions}
                    onCheckedChange={(checked) => setShowPreviousSessions(checked === true)}
                />
                <Label htmlFor="show-previous-preschool-sessions" className="cursor-pointer font-normal">
                    Show previous sessions
                </Label>
            </div>

            <Button onClick={selectSession} disabled={!selectedClass}>
                View attendance
            </Button>
        </PageCard>
    )
}

function PageCard({ children }: { children: React.ReactNode }) {
    return (
        <main className="twp mx-auto w-full max-w-2xl p-4 sm:p-6">
            <Card>
                <CardHeader>
                    <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-[#AC4390]/10 p-2 text-[#AC4390]">
                            <CalendarDays className="size-5" />
                        </div>
                        <div>
                            <CardTitle>Messy Play attendance</CardTitle>
                            <CardDescription className="mt-1">
                                Choose a studio and session to sign children in and out.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">{children}</CardContent>
            </Card>
        </main>
    )
}
