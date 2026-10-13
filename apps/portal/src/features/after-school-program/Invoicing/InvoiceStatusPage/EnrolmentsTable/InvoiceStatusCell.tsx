import { Tag } from 'antd'
import React from 'react'

import { assertNever } from '@fizz-kidz/core'
import type { AfterSchoolEnrolment, InvoiceStatusMap } from '@fizz-kidz/core'

import Loader from '@shared/components/loader'

type Props = {
    enrolment: AfterSchoolEnrolment
    invoiceStatusMap: InvoiceStatusMap
}

const InvoiceStatusCell: React.FC<Props> = ({ enrolment, invoiceStatusMap }) => {
    const result = invoiceStatusMap[enrolment.id]
    if (result) {
        let colour
        let text
        switch (result.status) {
            case 'NOT_SENT':
                colour = 'gold'
                text = 'NOT SENT'
                break
            case 'UNPAID':
                colour = 'red'
                text = 'UNPAID'
                break
            case 'PAID':
                colour = 'green'
                text = 'PAID'
                break
            case 'VOID':
                colour = 'default'
                text = 'VOID'
                break
            case 'UNSUPPORTED':
                colour = 'default'
                text = 'UNSUPPORTED'
                break
            default:
                assertNever(result)
                throw new Error(`Unhandled invoice status: ${JSON.stringify(result)}`)
        }
        return <Tag color={colour}>{text}</Tag>
    }
    return <Loader size="sm" />
}

export default InvoiceStatusCell
