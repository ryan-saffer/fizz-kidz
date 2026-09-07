import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { ErrorScreen } from '@app/root/error-page'
import { useTRPC } from '@integrations/trpc'
import type { AppRouter } from '@server/app/trpc/app.trpc'
import Logo from '@shared/assets/FizzKidzLogoHorizontal.png'
import Loader from '@shared/components/loader'

import { PartyFormV2Form } from './party-form-v2-form'
import './party-form-v2.css'

import type { inferRouterOutputs } from '@trpc/server'

export type PartyFormV2Config = inferRouterOutputs<AppRouter>['parties']['getPartyFormV2Config']

/**
 * Prototype replacement for the hosted Paperform party form.
 * Reached via /party-form-v2?id=<bookingId>.
 */
export function PartyFormV2Page() {
    const trpc = useTRPC()
    const [searchParams] = useSearchParams()
    const bookingId = searchParams.get('id')

    const configQuery = useQuery(
        trpc.parties.getPartyFormV2Config.queryOptions({ bookingId: bookingId || '' }, { enabled: Boolean(bookingId) })
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
        return <Loader fullScreen />
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
        <div className="party-experience twp">
            <header className="party-brand-header">
                <a href="https://www.fizzkidz.com.au" target="_blank" rel="noreferrer" aria-label="Fizz Kidz website">
                    <img src={Logo} alt="Fizz Kidz" width={148} />
                </a>
            </header>
            <main>
                <PartyFormV2Form config={configQuery.data} />
            </main>
        </div>
    )
}
