import { tool } from 'ai'
import { z } from 'zod'

import {
    ContactFormLocationOptions,
    ContactFormServiceOptions,
    ContactWebsiteFormSchema,
    IncursionFormModuleOptions,
    PartyThemeOptions,
} from '@fizz-kidz/core'

import { formatTranscript, getTranscriptFromModelMessages } from './website-chat-transcript'

import { processWebsiteFormSubmission } from '@/features/website/core/process-website-form-submission'
import { logError } from '@/integrations/observability/log-error'

function values<T extends readonly { value: string }[]>(options: T) {
    return options.map(({ value }) => value) as [T[number]['value'], ...T[number]['value'][]]
}

// What the model fills in. Required details per service are checked by the website contact form schema.
const SubmitEnquiryInputSchema = z.object({
    name: z.string().describe("The customer's full name"),
    email: z.string().describe("The customer's email address"),
    contactNumber: z.string().describe("The customer's phone number"),
    service: z.enum(values(ContactFormServiceOptions)).describe('What the enquiry is about'),
    location: z
        .enum(values(ContactFormLocationOptions))
        .optional()
        .describe('Preferred studio. Use at-home for a party at their home. Required for parties and holiday programs'),
    suburb: z.string().optional().describe('Suburb, required for at-home parties'),
    preferredDateAndTime: z
        .string()
        .optional()
        .describe('Preferred date and time, in their words. Required for parties and incursions'),
    partyTheme: z.enum(values(PartyThemeOptions)).optional().describe('Party theme, required for parties'),
    school: z.string().optional().describe('School name, required for incursions'),
    module: z.enum(values(IncursionFormModuleOptions)).optional().describe('Incursion module, required for incursions'),
    numberOfSessions: z.string().optional().describe('Number of incursion sessions, as a whole number'),
    numberOfStudentsPerSession: z.string().optional().describe('Students per incursion session'),
    organisation: z.string().optional().describe('Organisation name, for activations and events'),
    numberOfAttendees: z
        .string()
        .optional()
        .describe('Expected attendees. Only for activations and events, never ask for parties'),
    budget: z.string().optional().describe('Budget, for activations and events'),
    enquiry: z
        .string()
        .describe(
            'A short summary for the Fizz Kidz team of what the customer wants, including any useful details from the chat'
        ),
})

export const submitEnquiryTool = tool({
    description:
        "Leave an enquiry with the Fizz Kidz team on the customer's behalf. The team follows up and the customer gets a confirmation email. Only call this after the customer has confirmed the details and said yes to sending it.",
    inputSchema: SubmitEnquiryInputSchema,
    execute: async (input, { messages }) => {
        const enquiry = ContactWebsiteFormSchema.safeParse({
            ...input,
            enquiry: `${input.enquiry}\n\n(Left by Frankie, the website chat assistant)`,
            reference: 'other',
            referenceOther: 'Website chat',
        })
        if (!enquiry.success) {
            return {
                success: false as const,
                problems: enquiry.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
            }
        }

        try {
            await processWebsiteFormSubmission(
                { formId: 'contact', data: enquiry.data },
                { chatTranscript: formatTranscript(getTranscriptFromModelMessages(messages)) }
            )
            return { success: true as const }
        } catch (err) {
            logError('Website chat failed to submit an enquiry', err, { service: input.service })
            return { success: false as const, problems: ['The enquiry could not be sent. Ask them to try again soon.'] }
        }
    },
})
