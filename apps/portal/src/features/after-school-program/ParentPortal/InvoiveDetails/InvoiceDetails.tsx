import { styled } from '@mui/material/styles'
import { useQuery } from '@tanstack/react-query'
import { Card, Typography } from 'antd'
import React from 'react'

import { assertNever } from '@fizz-kidz/core'
import type { AfterSchoolEnrolment } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import Loader from '@shared/components/loader'

import InvoiceStatistic from './InvoiceStatistic'

const PREFIX = 'InvoiceDetails'

const classes = {
    card: `${PREFIX}-card`,
}

const StyledCard = styled(Card)({
    [`&.${classes.card}`]: {
        height: '100%',
        boxShadow: 'rgba(100, 100, 111, 0.15) 0px 7px 29px 0px',
    },
})

type Props = {
    appointment: AfterSchoolEnrolment
}

const InvoiceDetails: React.FC<Props> = ({ appointment }) => {
    const trpc = useTRPC()
    const { data, isPending, isSuccess, isError } = useQuery(
        trpc.afterSchoolProgram.retrieveInvoiceStatuses.queryOptions(
            { appointmentIds: [appointment.id] },
            {
                enabled: appointment.invoiceId !== '',
                initialData: { [appointment.id]: { status: 'NOT_SENT' } },
            }
        )
    )

    return (
        <StyledCard className={classes.card} title="🧾 Invoice Status">
            {(() => {
                if (isPending) {
                    return <Loader />
                }

                if (isError) {
                    return <Typography.Text type="danger">There was an error retrieving your invoice.</Typography.Text>
                }

                if (isSuccess) {
                    const invoiceStatus = data[appointment.id]
                    switch (invoiceStatus.status) {
                        case 'PAID':
                            return <InvoiceStatistic invoice={invoiceStatus} status="PAID" />
                        case 'UNPAID':
                            return <InvoiceStatistic invoice={invoiceStatus} status="UNPAID" />
                        case 'VOID':
                        case 'NOT_SENT':
                        case 'UNSUPPORTED':
                            return (
                                <>
                                    <p>Invoice not yet sent.</p>
                                    <p>
                                        The price for {appointment.appointments.length} weeks is $
                                        {(parseFloat(appointment.price) * appointment.appointments.length).toFixed(2)}
                                    </p>
                                </>
                            )
                        default:
                            assertNever(invoiceStatus)
                            throw new Error(`Unhandled invoice status: ${JSON.stringify(invoiceStatus)}`)
                    }
                }
            })()}
        </StyledCard>
    )
}

export default InvoiceDetails
