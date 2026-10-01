import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { submitEnquiryTool } from '../submit-enquiry-tool'

const mocks = vi.hoisted(() => ({ process: vi.fn(), logError: vi.fn() }))
vi.mock('@/features/website/core/process-website-form-submission', () => ({
    processWebsiteFormSubmission: mocks.process,
}))
vi.mock('@/integrations/observability/log-error', () => ({ logError: mocks.logError }))

const partyEnquiry = {
    name: 'Sam Lee',
    email: 'sam.lee@example.com',
    contactNumber: '0400111222',
    service: 'party',
    location: 'essendon',
    preferredDateAndTime: 'Saturday 14 November, 10am',
    partyTheme: 'slime',
    enquiry: 'Asking whether a 2 year old sibling can come along.',
} as const

const messages = [
    { role: 'user', content: 'Can my 2 year old come to the party?' },
    { role: 'assistant', content: [{ type: 'text', text: 'I can leave an enquiry for you.' }] },
]

function submit(input: Record<string, unknown>) {
    return submitEnquiryTool.execute!(input as never, { toolCallId: 'call', messages } as never)
}

describe('submitEnquiryTool', () => {
    beforeEach(() => {
        mocks.process.mockReset()
        mocks.logError.mockReset()
    })

    it('sends the enquiry through the website contact form pipeline', async () => {
        await expect(submit(partyEnquiry)).resolves.toEqual({ success: true })

        expect(mocks.process).toHaveBeenCalledWith(
            {
                formId: 'contact',
                data: expect.objectContaining({
                    name: 'Sam Lee',
                    service: 'party',
                    enquiry: expect.stringContaining('(Left by Frankie, the website chat assistant)'),
                    reference: 'other',
                    referenceOther: 'Website chat',
                }),
            },
            {
                chatTranscript:
                    'Customer: Can my 2 year old come to the party?\n\nFrankie: I can leave an enquiry for you.',
            }
        )
    })

    it('sends a party enquiry with just contact details and a rough date', async () => {
        const minimal = {
            ...partyEnquiry,
            location: undefined,
            partyTheme: undefined,
            preferredDateAndTime: 'late April',
        }

        await expect(submit(minimal)).resolves.toEqual({ success: true })

        expect(mocks.process).toHaveBeenCalledWith(
            {
                formId: 'contact',
                data: expect.objectContaining({
                    location: 'other',
                    partyTheme: 'mix',
                    preferredDateAndTime: 'late April',
                    enquiry: expect.stringContaining('Not provided yet: studio, party theme.'),
                }),
            },
            expect.anything()
        )
    })

    it('passes on an events question with just contact details', async () => {
        await expect(
            submit({
                name: 'Sam Lee',
                email: 'sam.lee@example.com',
                contactNumber: '0400111222',
                service: 'activation',
                enquiry: 'Do you run sensory-friendly activities at shopping centres?',
            })
        ).resolves.toEqual({ success: true })

        expect(mocks.process).toHaveBeenCalledWith(
            {
                formId: 'contact',
                data: expect.objectContaining({
                    service: 'activation',
                    organisation: 'Not provided yet',
                    enquiry: expect.stringContaining(
                        'Not provided yet: organisation, preferred date, number of attendees.'
                    ),
                }),
            },
            expect.anything()
        )
    })

    it('reports details the form still needs without sending', async () => {
        const result = await submit({ ...partyEnquiry, contactNumber: '123' })

        expect(result).toEqual({
            success: false,
            problems: [expect.stringContaining('contactNumber')],
        })
        expect(mocks.process).not.toHaveBeenCalled()
    })

    it('reports a failed send so the assistant can tell the customer', async () => {
        mocks.process.mockRejectedValue(new Error('SendGrid down'))

        await expect(submit(partyEnquiry)).resolves.toMatchObject({ success: false })
        expect(mocks.logError).toHaveBeenCalled()
    })
})
