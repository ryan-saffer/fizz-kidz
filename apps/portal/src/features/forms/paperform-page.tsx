import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ErrorScreen } from '@app/root/error-page'

const PAPERFORMS = {
    'incident-reporting': { paperformId: 'pyornlcz' },
    onboarding: { paperformId: 'fizz-kidz-onboarding' },
    incursion: { paperformId: 'dtrdgb8b' },
    'staff-feedback': { paperformId: 'b55fbq3h' },
} as const

type PaperformKey = keyof typeof PAPERFORMS

function getPaperformKey(searchParams: URLSearchParams): PaperformKey | null {
    const form = searchParams.get('form')
    return form && form in PAPERFORMS ? (form as PaperformKey) : null
}

/** Every query parameter except `form` prefills the Paperform. */
function getQueryPrefill(searchParams: URLSearchParams) {
    const params = new URLSearchParams(searchParams)
    params.delete('form')
    return params.toString()
}

/** Embeds a hosted Paperform (staff onboarding, incursions, incident reporting, staff feedback). */
export const Paperform = () => {
    const [searchParams] = useSearchParams()
    const paperformRef = useRef<HTMLDivElement | null>(null)

    const form = getPaperformKey(searchParams)
    const paperformId = form ? PAPERFORMS[form].paperformId : null
    const prefill = getQueryPrefill(searchParams)

    useEffect(() => {
        const node = paperformRef.current
        if (!paperformId || !node) {
            return
        }

        node.setAttribute('data-paperform-id', paperformId)
        node.setAttribute('spinner', '1')
        if (prefill) {
            node.setAttribute('prefill', prefill)
        } else {
            node.removeAttribute('prefill')
        }

        const script = document.createElement('script')
        script.src = 'https://paperform.co/__embed.min.js'
        script.async = true

        document.body.appendChild(script)

        return () => {
            script.remove()
        }
    }, [paperformId, prefill])

    if (!form) {
        return (
            <ErrorScreen
                showGoHome={false}
                label="Invalid form link"
                text="This form link is missing information or is no longer available."
            />
        )
    }

    return <div key={`${form}:${prefill}`} ref={paperformRef} data-takeover="1"></div>
}
