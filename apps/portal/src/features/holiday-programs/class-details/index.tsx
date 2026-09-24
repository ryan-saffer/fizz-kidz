import { styled } from '@mui/material/styles'
import { useQuery } from '@tanstack/react-query'
import { Card, Empty, Select, Skeleton, Typography } from 'antd'
import { DateTime } from 'luxon'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { AcuityConstants, AcuityUtilities } from '@fizz-kidz/core'
import type { AcuityTypes } from '@fizz-kidz/core'

import useFetchAppointments from '@features/holiday-programs/hooks/use-fetch-appointments'
import { useTRPC } from '@integrations/trpc'
import { useOrg } from '@session/use-org'
import SkeletonRows from '@shared/components/skeleton-rows'
import useWindowDimensions from '@shared/hooks/use-window-dimensions'

import ChildExpansionPanel from './ChildExpansionPanel'

const PREFIX = 'ClassDetailsPage'

const classes = {
    main: `${PREFIX}-main`,
    root: `${PREFIX}-root`,
    card: `${PREFIX}-card`,
}

const Root = styled('div')({
    [`& .${classes.root}`]: {
        // backgroundColor: '#f0f2f2',
        backgroundImage: 'linear-gradient(45deg, #f86ca7ff, #f4d444ff)',
        minHeight: '100vh',
        paddingBottom: 24,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    [`& .${classes.card}`]: {
        width: '100%',
        height: 'fit-content',
        borderRadius: 16,
        boxShadow: 'rgba(0, 0, 0, 0.35) 0px 5px 15px',
    },
})

const getClassSlotKey = (klass: Pick<AcuityTypes.Client.Class, 'time'>) => {
    return DateTime.fromISO(klass.time).toFormat('yyyy-MM-dd HH:mm')
}

const getClassLabel = (klass: AcuityTypes.Client.Class) => {
    const classDateTime = DateTime.fromISO(klass.time)
    const className = klass.title || klass.name

    return `${classDateTime.toFormat('ccc d LLL, h:mm a')} - ${className}`
}

const getClassRoute = (klass: AcuityTypes.Client.Class) => {
    return `?appointmentTypeId=${klass.appointmentTypeID}&calendarId=${klass.calendarID}&classId=${
        klass.id
    }&classTime=${encodeURIComponent(klass.time)}`
}

export const ClassDetailsPage = () => {
    const trpc = useTRPC()
    const { height } = useWindowDimensions()
    const navigate = useNavigate()
    const { currentOrg } = useOrg()

    const [loading, setLoading] = useState(true)
    const [minDate] = useState(() => DateTime.now().startOf('day').toMillis())

    const [searchParams] = useSearchParams()
    const appointmentTypeId = parseInt(searchParams.get('appointmentTypeId')!)
    const calendarId = parseInt(searchParams.get('calendarId')!)
    const classId = parseInt(searchParams.get('classId')!)
    const classTime = decodeURIComponent(searchParams.get('classTime')!)

    const { data: classOptions, isPending: isLoadingClasses } = useQuery(
        trpc.acuity.classAvailability.queryOptions({
            appointmentTypeIds:
                import.meta.env.VITE_ENV === 'prod'
                    ? [appointmentTypeId]
                    : [AcuityConstants.AppointmentTypes.TEST_HOLIDAY_PROGRAM],
            includeUnavailable: true,
            minDate,
        })
    )

    const availableClasses = useMemo(() => {
        return (classOptions || [])
            .filter((klass) => DateTime.fromISO(klass.time) >= DateTime.now().startOf('day'))
            .sort((a, b) => DateTime.fromISO(a.time).toMillis() - DateTime.fromISO(b.time).toMillis())
    }, [classOptions])

    const currentClass = useMemo(() => {
        return availableClasses.find((klass) => klass.id === classId)
    }, [availableClasses, classId])

    const showStudioSelector = currentOrg === 'master'
    const selectedClassCalendarId =
        currentOrg && currentOrg !== 'master' ? AcuityConstants.StoreCalendars[currentOrg] : calendarId

    const studios = useMemo(() => {
        const calendars = new Map<number, string>()

        availableClasses.forEach((klass) => {
            if (!calendars.has(klass.calendarID)) {
                calendars.set(klass.calendarID, klass.calendar)
            }
        })

        return [...calendars.entries()].sort(([, a], [, b]) => a.localeCompare(b))
    }, [availableClasses])

    const selectedStudioClasses = useMemo(() => {
        return availableClasses.filter((klass) => klass.calendarID === selectedClassCalendarId)
    }, [availableClasses, selectedClassCalendarId])

    const sortByChildName = (a: AcuityTypes.Api.Appointment, b: AcuityTypes.Api.Appointment) => {
        const aName = AcuityUtilities.retrieveFormAndField(
            a,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        ) as string
        const bName = AcuityUtilities.retrieveFormAndField(
            b,
            AcuityConstants.Forms.CHILDREN_DETAILS,
            AcuityConstants.FormFields.CHILDREN_NAMES
        ) as string
        return aName.toUpperCase() < bName.toUpperCase() ? -1 : aName > bName ? 1 : 0
    }

    const appointments = useFetchAppointments({
        setLoading,
        appointmentTypeId,
        calendarId,
        classId,
        classTime,
        sorter: sortByChildName,
    })

    const enrolmentTitle =
        loading || appointments?.length === 0 ? 'Enrolments' : `Total kids booked in: ${appointments?.length ?? 0}`

    const navigateToClass = (klass: AcuityTypes.Client.Class) => {
        navigate(getClassRoute(klass))
    }

    const handleStudioChange = (nextCalendarId: number) => {
        const nextStudioClasses = availableClasses.filter((klass) => klass.calendarID === nextCalendarId)
        const currentSlotKey = currentClass
            ? getClassSlotKey(currentClass)
            : DateTime.fromISO(classTime).toFormat('yyyy-MM-dd HH:mm')
        const matchingClass = nextStudioClasses.find((klass) => getClassSlotKey(klass) === currentSlotKey)
        const nextClass = matchingClass || nextStudioClasses[0]

        if (nextClass) {
            navigateToClass(nextClass)
        }
    }

    return (
        <Root>
            <div className={classes.root}>
                <Card className={classes.card} style={{ marginTop: 16, marginBottom: 16 }}>
                    {isLoadingClasses ? (
                        <Skeleton active paragraph={false} />
                    ) : (
                        <div className={showStudioSelector ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4'}>
                            {showStudioSelector && (
                                <div>
                                    <Typography.Text strong>Jump to studio</Typography.Text>
                                    <Select
                                        className="mt-2 w-full"
                                        value={calendarId}
                                        onChange={handleStudioChange}
                                        options={studios.map(([studioCalendarId, studioName]) => ({
                                            label: studioName,
                                            value: studioCalendarId,
                                        }))}
                                    />
                                </div>
                            )}
                            <div>
                                <Typography.Text strong>Selected class</Typography.Text>
                                <Select
                                    showSearch={{
                                        optionFilterProp: 'label',
                                    }}
                                    className="mt-2 w-full"
                                    value={
                                        selectedStudioClasses.some((klass) => klass.id === classId)
                                            ? classId
                                            : undefined
                                    }
                                    placeholder="Select a class"
                                    onChange={(nextClassId) => {
                                        const nextClass = selectedStudioClasses.find(
                                            (klass) => klass.id === nextClassId
                                        )
                                        if (nextClass) {
                                            navigateToClass(nextClass)
                                        }
                                    }}
                                    options={selectedStudioClasses.map((klass) => ({
                                        label: getClassLabel(klass),
                                        value: klass.id,
                                    }))}
                                />
                            </div>
                        </div>
                    )}
                </Card>
                <Card className={classes.card} title={enrolmentTitle}>
                    {appointments !== null && appointments.length !== 0 && (
                        <div className="space-y-2">
                            {appointments.map((appointment) => (
                                <ChildExpansionPanel key={appointment.id} appointment={appointment} />
                            ))}
                        </div>
                    )}
                    {appointments === null && (
                        <Empty description="No enrolments" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                    {loading && <SkeletonRows rowCount={(height - 64) / 64} />}
                </Card>
            </div>
        </Root>
    )
}
