import { CircleCheck, LoaderCircle } from 'lucide-react'
import { Fragment } from 'react'

import {
    ContactFormLocationOptions,
    ContactFormServiceOptions,
    PartyThemeOptions,
    WEBSITE_CHAT_CHANGE_SOMETHING_REASON,
    WEBSITE_CHAT_DONT_SEND_REASON,
} from '@fizz-kidz/core'

import { cn } from '@/react-lib/utils'

type EnquiryInput = Partial<Record<string, string>>

/** The details Frankie filled in, as the customer would describe them. Frankie's note for the team is left out. */
export function getEnquiryDetails(input: EnquiryInput) {
    const label = (options: readonly { value: string; label: string }[], value?: string) =>
        options.find((option) => option.value === value)?.label
    const where =
        input.location === 'at-home'
            ? ['At your place', input.suburb].filter(Boolean).join(', ')
            : input.location === 'other'
              ? undefined
              : label(ContactFormLocationOptions, input.location)

    return [
        ['Enquiry', label(ContactFormServiceOptions, input.service)],
        ['Name', input.name],
        ['Email', input.email],
        ['Mobile', input.contactNumber],
        ['Date and time', input.preferredDateAndTime],
        ['Where', where],
        ['Theme', input.partyTheme === 'mix' ? undefined : label(PartyThemeOptions, input.partyTheme)],
        ['School', input.school],
        ['Organisation', input.organisation],
    ].flatMap(([detail, value]) => (value ? [{ label: detail!, value }] : []))
}

/**
 * Frankie's submit_enquiry call. The customer checks the details and taps Send enquiry before anything is sent
 * (the server waits for their approval), Change something to tell Frankie what's wrong, or Don't send.
 * A customer who leaves without choosing still has the enquiry sent for them when the chat goes idle.
 */
export function EnquiryConfirmation({
    state,
    input,
    output,
    approval,
    canRespond,
    onRespond,
}: {
    state: string
    input: unknown
    output: unknown
    approval?: { id: string; approved?: boolean }
    /** Only the latest message can be answered: once the customer types a reply instead, it's out of date. */
    canRespond: boolean
    onRespond: (response: { id: string; approved: boolean; reason?: string }) => void
}) {
    if (state === 'input-streaming' || state === 'input-available') {
        return (
            <p className="flex items-center gap-1.5 text-xs text-[#542785]">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Getting your details ready…
            </p>
        )
    }

    const isSent = state === 'output-available' && (output as { success?: boolean } | undefined)?.success === true
    const isSending = state === 'approval-responded' && approval?.approved === true
    const isWaiting = state === 'approval-requested' && canRespond
    const details = getEnquiryDetails((input ?? {}) as EnquiryInput)

    return (
        <div className="flex flex-col gap-2">
            <div
                className={cn(
                    'w-full max-w-sm rounded-2xl border border-[#E8DBFD] bg-white p-3 text-sm text-[#1F1433]',
                    !isWaiting && !isSending && !isSent && 'opacity-60'
                )}
            >
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {details.map(({ label, value }) => (
                        <Fragment key={label}>
                            <dt className="text-[#542785]/70">{label}</dt>
                            <dd className="break-words">{value}</dd>
                        </Fragment>
                    ))}
                </dl>
                {isWaiting && approval && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => onRespond({ id: approval.id, approved: true })}
                            className="rounded-full bg-[#9044E2] px-3 py-1.5 font-semibold text-white transition-colors hover:bg-[#7732BE]"
                        >
                            Send enquiry
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                onRespond({
                                    id: approval.id,
                                    approved: false,
                                    reason: WEBSITE_CHAT_CHANGE_SOMETHING_REASON,
                                })
                            }
                            className="rounded-full border border-[#9044E2] px-3 py-1.5 text-[#542785] transition-colors hover:bg-[#F7F2FE]"
                        >
                            Change something
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                onRespond({ id: approval.id, approved: false, reason: WEBSITE_CHAT_DONT_SEND_REASON })
                            }
                            className="rounded-full px-3 py-1.5 text-[#542785]/70 transition-colors hover:bg-[#F7F2FE] hover:text-[#542785]"
                        >
                            Don't send
                        </button>
                    </div>
                )}
                {isWaiting && (
                    <p className="mt-2 text-xs text-[#542785]/70">
                        If you leave without choosing, we'll still pass these on so the team can help.
                    </p>
                )}
            </div>
            {isSending && (
                <p className="flex items-center gap-1.5 text-xs text-[#542785]">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Sending your enquiry…
                </p>
            )}
            {isSent && (
                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#2F8F46]">
                    <CircleCheck className="h-4 w-4" />
                    Enquiry sent to the Fizz Kidz team
                </p>
            )}
        </div>
    )
}
