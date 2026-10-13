import { assertNever } from '@fizz-kidz/core'
import type { InvoiceStatus } from '@fizz-kidz/core'

import { Badge } from '@shared/components/ui/badge'

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus | undefined }) {
    if (!status) return <Badge variant="outline">Loading</Badge>

    switch (status.status) {
        case 'NOT_SENT':
            return <Badge variant="secondary">Not Sent</Badge>
        case 'UNPAID':
            return <Badge variant="destructive">Unpaid</Badge>
        case 'PAID':
            return <Badge className="bg-green-600 hover:bg-green-600">Paid</Badge>
        case 'VOID':
            return <Badge variant="outline">Void</Badge>
        case 'UNSUPPORTED':
            return <Badge variant="outline">Unsupported</Badge>
        default:
            assertNever(status)
            throw new Error(`Unhandled invoice status: ${JSON.stringify(status)}`)
    }
}
