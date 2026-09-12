import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AcuityConstants, capitalise } from '@fizz-kidz/core'
import type { AcuityTypes, StudioOrTest } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Skeleton } from '@shared/components/ui/skeleton'

import { resolveCalendarStudio } from '../preschool-program/booking-form/utils/resolve-calendar-studio'

import type { ReactNode } from 'react'

const isProdEnv = import.meta.env.VITE_ENV === 'prod'

function Root({ children }: { children: ReactNode }) {
    return <div className="twp mx-4 my-4 max-w-3xl md:mx-auto">{children}</div>
}

function getCalendarIdForStudio(studio: StudioOrTest) {
    return studio === 'test' ? AcuityConstants.TestCalendarId : AcuityConstants.StoreCalendars[studio]
}

type ClassSelectionAppointmentType =
    | typeof AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM
    | typeof AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM
    | typeof AcuityConstants.AppointmentTypes.OPEN_DAY

function getProgramTitle(appointmentTypeId: ClassSelectionAppointmentType) {
    switch (appointmentTypeId) {
        case AcuityConstants.AppointmentTypes.HOLIDAY_PROGRAM:
        case AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM:
            return 'Holiday Program Class Selection'
        case AcuityConstants.AppointmentTypes.OPEN_DAY:
            return 'Open Day & Community Day Class Selection'
        default: {
            const exhaustive: never = appointmentTypeId
            throw new Error(`Unhandled appointment type in getProgramTitle(): ${exhaustive}`)
        }
    }
}

function getClassLabel(klass: AcuityTypes.Client.Class) {
    const classDateTime = DateTime.fromISO(klass.time, { setZone: true })
    const className = klass.title || klass.name

    return `${classDateTime.toFormat('cccc d LLLL, h:mm a')} - ${className}`
}

function getSelectionDescription(showStudioSelector: boolean) {
    return showStudioSelector
        ? 'Choose the studio and holiday program class to view enrolments.'
        : 'Choose the holiday program class to view enrolments.'
}

function LoadingState({ title, showStudioSelector }: { title: string; showStudioSelector: boolean }) {
    return (
        <Root>
            <Card>
                <CardHeader>
                    <CardTitle className="font-lilita text-2xl font-normal tracking-wide">{title}</CardTitle>
                    <CardDescription>{getSelectionDescription(showStudioSelector)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {showStudioSelector && <Skeleton className="h-10" />}
                    <Skeleton className="h-10" />
                    <Button className="w-full" disabled>
                        Select Class
                    </Button>
                </CardContent>
            </Card>
        </Root>
    )
}

export const HolidayProgramSelectionPage = () => {
    const { currentOrg } = useOrg()

    return <HolidayProgramSelectionPageContent key={currentOrg ?? 'master'} currentOrg={currentOrg} />
}

function HolidayProgramSelectionPageContent({ currentOrg }: { currentOrg: ReturnType<typeof useOrg>['currentOrg'] }) {
    const trpc = useTRPC()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const appointmentTypeId = parseInt(searchParams.get('id') || '0') as ClassSelectionAppointmentType
    const programTitle = getProgramTitle(appointmentTypeId)
    const showStudioSelector = currentOrg === 'master'

    const [selectedStudio, setSelectedStudio] = useState<StudioOrTest | null>(
        currentOrg === 'master' ? null : isProdEnv ? currentOrg : 'test'
    )
    const [selectedClass, setSelectedClass] = useState<string | null>(null)
    const [minDate] = useState(() => DateTime.now().startOf('day').toMillis())

    const {
        data: classes,
        isPending,
        isSuccess,
        isError,
        refetch,
        isFetching,
    } = useQuery(
        trpc.acuity.classAvailability.queryOptions({
            appointmentTypeIds: isProdEnv
                ? [appointmentTypeId]
                : [AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM],
            includeUnavailable: true,
            minDate,
        })
    )

    const availableStudios = useMemo(() => {
        if (!classes) return []

        return Array.from(
            new Set(
                classes
                    .map((klass) => resolveCalendarStudio(klass.calendarID))
                    .filter((studio): studio is StudioOrTest => !!studio)
            )
        ).sort((a, b) => a.localeCompare(b))
    }, [classes])

    const filteredClasses = useMemo(() => {
        if (!classes || !selectedStudio) return []

        const selectedCalendarId = getCalendarIdForStudio(selectedStudio)

        return classes
            .filter((klass) => klass.calendarID === selectedCalendarId)
            .sort((a, b) => DateTime.fromISO(a.time).toMillis() - DateTime.fromISO(b.time).toMillis())
    }, [classes, selectedStudio])

    function handleClassSelection() {
        const klass = classes?.find((it) => it.id === parseInt(selectedClass || '0'))
        if (!klass) return

        navigate(
            `class?appointmentTypeId=${klass.appointmentTypeID}&calendarId=${klass.calendarID}&classId=${
                klass.id
            }&classTime=${encodeURIComponent(klass.time)}`
        )
    }

    if (isPending) {
        return <LoadingState title={programTitle} showStudioSelector={showStudioSelector} />
    }

    if (isError) {
        return (
            <div className="twp m-4 flex h-[calc(100vh-64px)] flex-col items-center justify-center">
                <Alert variant="destructive" className="w-full max-w-md">
                    <AlertTitle className="text-center">Unable to load holiday program classes</AlertTitle>
                    <AlertDescription className="text-center">
                        We couldn't load the available classes from Acuity.
                    </AlertDescription>
                </Alert>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                    {isFetching ? <Loader2 className="animate-spin" /> : 'Retry'}
                </Button>
            </div>
        )
    }

    if (!isSuccess) return null

    const hasAnyClasses = classes.length > 0
    const hasStudioClasses = filteredClasses.length > 0

    return (
        <Root>
            <Card>
                <CardHeader>
                    <CardTitle className="font-lilita text-2xl font-normal tracking-wide">{programTitle}</CardTitle>
                    <CardDescription>{getSelectionDescription(showStudioSelector)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!hasAnyClasses && (
                        <Alert>
                            <AlertTitle>No holiday program classes found</AlertTitle>
                            <AlertDescription>
                                There are no upcoming classes available for this program right now.
                            </AlertDescription>
                        </Alert>
                    )}

                    {hasAnyClasses && showStudioSelector && (
                        <Select
                            onValueChange={(studio) => {
                                setSelectedStudio(studio as StudioOrTest)
                                setSelectedClass(null)
                            }}
                            value={selectedStudio || ''}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select Studio" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableStudios.map((studio) => (
                                    <SelectItem key={studio} value={studio}>
                                        {capitalise(studio)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {hasAnyClasses && (
                        <Select
                            onValueChange={setSelectedClass}
                            value={selectedClass || ''}
                            disabled={!selectedStudio || !hasStudioClasses}
                        >
                            <SelectTrigger>
                                <SelectValue
                                    placeholder={
                                        selectedStudio && !hasStudioClasses
                                            ? 'No classes for this studio'
                                            : 'Select Class'
                                    }
                                />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredClasses.map((klass) => (
                                    <SelectItem key={klass.id} value={klass.id.toString()}>
                                        {getClassLabel(klass)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {hasAnyClasses && selectedStudio && !hasStudioClasses && (
                        <Alert>
                            <AlertTitle>No classes for {capitalise(selectedStudio)}</AlertTitle>
                            <AlertDescription>
                                This studio does not have any upcoming classes for this holiday program.
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button className="w-full" disabled={!selectedClass} onClick={handleClassSelection}>
                        Select Class
                    </Button>
                </CardContent>
            </Card>
        </Root>
    )
}
