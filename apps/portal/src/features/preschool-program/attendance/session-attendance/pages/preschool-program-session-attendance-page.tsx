import * as Accordion from '@radix-ui/react-accordion'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Loader2, LogOut, RefreshCw, Users } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { AcuityConstants } from '@fizz-kidz/core'

import { filterAttendanceClassesForCurrentTerms } from '@features/preschool-program/booking-v2/state/session-grouping'
import { useTRPC } from '@integrations/trpc'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Skeleton } from '@shared/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table'
import { cn } from '@shared/lib/tailwind'

import { ChildExpandedDetails } from '../components/child-expanded-details'
import { ChildRow } from '../components/child-row'
import { useParams } from '../hooks/use-params'
import { getPreschoolAttendanceDetails, getPreschoolAttendanceStatus } from '../utils/acuity-attendance'

const EXPECTED_APPOINTMENT_TYPE_ID =
    import.meta.env.VITE_ENV === 'prod'
        ? AcuityConstants.AppointmentTypes.PRESCHOOL_PROGRAM
        : AcuityConstants.AppointmentTypes.TEST_PRESCHOOL_PROGRAM

export function PreschoolProgramSessionAttendancePage() {
    const trpc = useTRPC()
    const params = useParams()
    const navigate = useNavigate()
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
    const [now] = useState(() => DateTime.now())
    const validParams = params?.appointmentTypeId === EXPECTED_APPOINTMENT_TYPE_ID ? params : null
    const appointmentsQuery = useQuery(
        trpc.acuity.searchForAppointments.queryOptions(validParams!, { enabled: !!validParams })
    )
    const classesQuery = useQuery(
        trpc.acuity.classAvailability.queryOptions(
            {
                appointmentTypeIds: [EXPECTED_APPOINTMENT_TYPE_ID],
                includeUnavailable: true,
                minDate: now.minus({ months: 6 }).toMillis(),
            },
            { enabled: !!validParams }
        )
    )

    const appointments = useMemo(
        () =>
            [...(appointmentsQuery.data || [])].sort((a, b) =>
                getPreschoolAttendanceDetails(a).childName.localeCompare(getPreschoolAttendanceDetails(b).childName)
            ),
        [appointmentsQuery.data]
    )
    const signedInCount = appointments.filter(
        (appointment) => getPreschoolAttendanceStatus(appointment) === 'signed-in'
    ).length
    const signedOutCount = appointments.filter(
        (appointment) => getPreschoolAttendanceStatus(appointment) === 'signed-out'
    ).length
    const sessionOptions = useMemo(() => {
        if (!validParams) return []

        const studioClasses = (classesQuery.data || []).filter((klass) => klass.calendarID === validParams.calendarId)
        const visibleClassIds = new Set(
            filterAttendanceClassesForCurrentTerms(
                studioClasses.map((klass) => ({ ...klass, time: new Date(klass.time) })),
                true,
                now.toJSDate()
            ).map((klass) => klass.id)
        )
        visibleClassIds.add(validParams.classId)

        return studioClasses
            .filter((klass) => visibleClassIds.has(klass.id))
            .sort((a, b) => DateTime.fromISO(a.time).toMillis() - DateTime.fromISO(b.time).toMillis())
    }, [classesQuery.data, now, validParams])

    /** Navigates directly to another preschool session in the current studio. */
    function selectSession(classId: string) {
        const klass = sessionOptions.find((session) => session.id.toString() === classId)
        if (!klass) return

        setOpenItems({})
        navigate(
            `/dashboard/preschool-program/${EXPECTED_APPOINTMENT_TYPE_ID}?classId=${klass.id}&calendarId=${klass.calendarID}&classTime=${encodeURIComponent(klass.time)}&className=${encodeURIComponent('Preschool Program')}`
        )
    }

    if (!validParams) return <Navigate to="/dashboard/preschool-program" replace />

    if (appointmentsQuery.isError) {
        return (
            <div className="twp flex min-h-[calc(100vh-7rem)] items-center justify-center p-4">
                <Alert variant="destructive" className="max-w-lg">
                    <AlertTitle>Unable to load attendance</AlertTitle>
                    <AlertDescription className="mt-2 flex items-center justify-between gap-4">
                        {appointmentsQuery.error.message}
                        <Button variant="outline" size="sm" onClick={() => appointmentsQuery.refetch()}>
                            {appointmentsQuery.isFetching ? <Loader2 className="size-4 animate-spin" /> : 'Retry'}
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        )
    }

    return (
        <main className="twp mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 mb-1"
                        onClick={() => navigate('/dashboard/preschool-program')}
                    >
                        <ArrowLeft className="mr-2 size-4" /> Sessions
                    </Button>
                    <h1 className="text-2xl font-bold">Messy Play attendance</h1>
                    {classesQuery.isError ? (
                        <p className="text-sm text-muted-foreground">
                            {DateTime.fromISO(validParams.classTime, { setZone: true }).toFormat('cccc d LLLL, h:mm a')}
                        </p>
                    ) : (
                        <Select
                            value={validParams.classId.toString()}
                            onValueChange={selectSession}
                            disabled={classesQuery.isLoading}
                        >
                            <SelectTrigger className="mt-1 h-8 w-full min-w-64 border-0 bg-transparent px-0 text-muted-foreground shadow-none focus:ring-0 sm:w-auto">
                                <SelectValue>
                                    {DateTime.fromISO(validParams.classTime, { setZone: true }).toFormat(
                                        'cccc d LLLL, h:mm a'
                                    )}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {sessionOptions.map((klass) => (
                                    <SelectItem value={klass.id.toString()} key={klass.id}>
                                        {DateTime.fromISO(klass.time, { setZone: true }).toFormat(
                                            'cccc d LLLL, h:mm a'
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
                <Button
                    variant="outline"
                    onClick={() => {
                        void appointmentsQuery.refetch()
                        void classesQuery.refetch()
                    }}
                    disabled={appointmentsQuery.isFetching || classesQuery.isFetching}
                >
                    <RefreshCw
                        className={
                            appointmentsQuery.isFetching || classesQuery.isFetching
                                ? 'mr-2 size-4 animate-spin'
                                : 'mr-2 size-4'
                        }
                    />
                    Refresh
                </Button>
            </div>

            {appointmentsQuery.isPending ? (
                <Skeleton className="h-64" />
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 py-1">
                        <SummaryItem icon={<Users className="size-4" />} label="Children" value={appointments.length} />
                        <SummaryItem
                            icon={<CheckCircle2 className="size-4 text-green-600" />}
                            label="Signed in"
                            value={signedInCount}
                        />
                        <SummaryItem
                            icon={<LogOut className="size-4 text-slate-600" />}
                            label="Signed out"
                            value={signedOutCount}
                        />
                    </div>

                    {appointments.length === 0 ? (
                        <Alert>
                            <AlertTitle>No children booked</AlertTitle>
                            <AlertDescription>There are no Acuity appointments for this session.</AlertDescription>
                        </Alert>
                    ) : (
                        <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
                            <Accordion.Root type="multiple">
                                <Table className="table-fixed">
                                    <colgroup>
                                        <col className="w-10" />
                                        <col />
                                        <col className="hidden w-24 sm:table-column" />
                                        <col className="w-36 sm:w-72" />
                                        <col className="w-24 sm:w-40" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead />
                                            <TableHead>Child</TableHead>
                                            <TableHead className="hidden sm:table-cell">Age</TableHead>
                                            <TableHead className="text-center">Tags</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {appointments.map((appointment) => {
                                            const id = appointment.id.toString()
                                            const isOpen = openItems[id] === true
                                            const status = getPreschoolAttendanceStatus(appointment)

                                            return (
                                                <Accordion.Item value={id} key={id} asChild>
                                                    <>
                                                        <Accordion.Trigger asChild>
                                                            <TableRow
                                                                className={cn(
                                                                    'h-16 cursor-pointer [&[data-state=open]>td#arrow>svg]:rotate-90',
                                                                    {
                                                                        'bg-green-50/70 hover:bg-green-100/70':
                                                                            status === 'signed-in',
                                                                        'bg-slate-50 text-muted-foreground hover:bg-slate-100':
                                                                            status === 'signed-out',
                                                                    }
                                                                )}
                                                                onClick={() =>
                                                                    setOpenItems((current) => ({
                                                                        ...current,
                                                                        [id]: !current[id],
                                                                    }))
                                                                }
                                                            >
                                                                <ChildRow appointment={appointment} />
                                                            </TableRow>
                                                        </Accordion.Trigger>
                                                        {isOpen ? (
                                                            <Accordion.Content
                                                                asChild
                                                                className="overflow-hidden data-[state=open]:animate-accordion-down"
                                                            >
                                                                <TableRow>
                                                                    <TableCell colSpan={5} className="p-0">
                                                                        <ChildExpandedDetails
                                                                            appointment={appointment}
                                                                        />
                                                                    </TableCell>
                                                                </TableRow>
                                                            </Accordion.Content>
                                                        ) : null}
                                                    </>
                                                </Accordion.Item>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </Accordion.Root>
                        </div>
                    )}
                </>
            )}
        </main>
    )
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-muted-foreground">{label}</span>
            <span className="font-semibold tabular-nums">{value}</span>
        </div>
    )
}
