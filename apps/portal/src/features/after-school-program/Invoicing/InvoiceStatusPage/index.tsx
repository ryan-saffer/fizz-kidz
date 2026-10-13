import { useQuery } from '@tanstack/react-query'
import { Result } from 'antd'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { assertNever } from '@fizz-kidz/core'
import type { AfterSchoolEnrolment, Service } from '@fizz-kidz/core'

import useFirebase from '@integrations/firebase/use-firebase'
import { useTRPC } from '@integrations/trpc'
import SkeletonRows from '@shared/components/skeleton-rows'
import useWindowDimensions from '@shared/hooks/use-window-dimensions'

import { EnrolmentsTable } from './EnrolmentsTable/EnrolmentsTable'

export const AfterSchoolProgramInvoicing: React.FC = () => {
    const trpc = useTRPC()
    const firebase = useFirebase()
    const { height } = useWindowDimensions()

    const [searchParams] = useSearchParams()
    const [appointmentTypeId, setAppointmentTypeId] = useState(parseInt(searchParams.get('appointmentTypeId')!))
    const calendarName = searchParams.get('calendarName') ?? ''

    const [enrolmentsService, setEnrolmentsService] = useState<Service<AfterSchoolEnrolment[]>>({ status: 'loading' })

    const { data: appointmentTypes } = useQuery(
        trpc.acuity.getAppointmentTypes.queryOptions({
            category:
                import.meta.env.VITE_ENV === 'prod'
                    ? ['Science Club', 'Art Program']
                    : ['TEST', 'TEST-science', 'TEST-art'],
        })
    )

    useEffect(() => {
        const enrolmentsQuery = query(
            collection(firebase.db, 'afterSchoolEnrolments'),
            where('appointmentTypeId', '==', appointmentTypeId),
            where('status', '==', 'active')
        )
        const unsubscribe = onSnapshot(enrolmentsQuery, (snapshot) => {
            let enrolments = snapshot.docs.map((enrolment) => {
                return {
                    ...(enrolment.data() as AfterSchoolEnrolment),
                    id: enrolment.id,
                }
            })
            enrolments = enrolments.sort((a, b) => a.parent.firstName.localeCompare(b.parent.firstName))
            setEnrolmentsService({ status: 'loaded', result: enrolments })
        })

        return () => unsubscribe()
        // oxlint-disable-next-line react/exhaustive-deps
    }, [appointmentTypeId])

    switch (enrolmentsService.status) {
        case 'init':
        case 'loading':
            return <SkeletonRows rowCount={(height - 64) / 64} />
        case 'loaded':
            return (
                <EnrolmentsTable
                    enrolments={enrolmentsService.result}
                    calendar={calendarName}
                    appointmentTypes={appointmentTypes || []}
                    onAppointmentTypeChange={(id: number) => setAppointmentTypeId(id)}
                />
            )
        case 'error':
            return <Result status="500" title="Oh no" subTitle="There was an error retrieving the enrolments" />
        default:
            assertNever(enrolmentsService)
            throw new Error(`Unhandled service status: ${JSON.stringify(enrolmentsService)}`)
    }
}
