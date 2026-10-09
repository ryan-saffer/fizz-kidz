import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import type { PartyFormV2Mode } from '@fizz-kidz/core'

import { ErrorScreen } from '@app/root/error-page'
import { useTRPC } from '@integrations/trpc'

import { LoadingState } from '../components/common/loading-state'
import { PartyPageShell } from '../components/layout/page-shell'
import { PartyForm } from '../components/party-form'

/**
 * Replacement for the hosted Paperform party form.
 * Reached via /party-form-v2?id=<bookingId>.
 */
export function PartyFormV2Page() {
    const trpc = useTRPC()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('id')
    // cake form links (sent from booking time) only order a cake and take-home goodies
    const mode: PartyFormV2Mode = searchParams.get('mode') === 'cake' ? 'cake' : 'party'

    const configQuery = useQuery(
        trpc.parties.getPartyFormV2Config.queryOptions(
            { bookingId: bookingId || '' },
            {
                enabled: Boolean(bookingId),
                retry: (failureCount, error) => error.data?.code !== 'NOT_FOUND' && failureCount < 3,
            }
        )
    )

    if (!bookingId) {
        return (
            <ErrorScreen
                showGoHome={false}
                label="Invalid form link"
                text="This form link is missing information or is no longer available."
            />
        )
    }

    if (configQuery.isPending) {
        return (
            <PartyPageShell>
                <LoadingState title="Loading your party details" className="min-h-[50vh]" />
            </PartyPageShell>
        )
    }

    if (configQuery.error?.data?.code === 'NOT_FOUND') {
        return (
            <ErrorScreen
                showGoHome={false}
                label="Party booking not found"
                text="We couldn't find the party booking for this form. It may have been cancelled or moved. Please contact us at bookings@fizzkidz.com.au if you think this is a mistake."
            />
        )
    }

    if (configQuery.isError) {
        return (
            <ErrorScreen
                showRefresh
                showGoHome={false}
                label="Unable to load form"
                text="We couldn't load this form right now. Please refresh and try again, or contact us if the problem continues."
            />
        )
    }

    return (
        <PartyPageShell>
            <PartyForm config={configQuery.data} mode={mode} />
        </PartyPageShell>
    )
}
