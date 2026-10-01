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
        .describe('Preferred studio, or at-home if we host it at their place. Leave out if they are not sure'),
    suburb: z.string().optional().describe('Suburb, required for at-home parties'),
    preferredDateAndTime: z
        .string()
        .optional()
        .describe(
            'Preferred date and time in their words; rough is fine, e.g. "late April". Required for parties and incursions'
        ),
    partyTheme: z.enum(values(PartyThemeOptions)).optional().describe('Party theme. Leave out if they are not sure'),
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

type SubmitEnquiryInput = z.infer<typeof SubmitEnquiryInputSchema>

const NOT_PROVIDED = 'Not provided yet'

// Details the contact form requires for each service, with the value to send when the customer hasn't given one.
// Frankie only insists on contact details (and a rough date for bookings); the note tells the team what's missing.
// The number of incursion sessions has no fallback because the form needs a real number.
const FORM_FALLBACKS: Partial<
    Record<SubmitEnquiryInput['service'], Partial<Record<keyof SubmitEnquiryInput, [label: string, value: string]>>>
> = {
    party: {
        location: ['studio', 'other'],
        partyTheme: ['party theme', 'mix'],
        preferredDateAndTime: ['preferred date and time', NOT_PROVIDED],
    },
    'holiday-program': { location: ['studio', 'other'] },
    incursion: {
        school: ['school', NOT_PROVIDED],
        preferredDateAndTime: ['preferred date', NOT_PROVIDED],
        module: ['module', 'notSure'],
        numberOfStudentsPerSession: ['students per session', NOT_PROVIDED],
    },
    activation: {
        organisation: ['organisation', NOT_PROVIDED],
        preferredDateAndTime: ['preferred date', NOT_PROVIDED],
        numberOfAttendees: ['number of attendees', NOT_PROVIDED],
    },
}

function withFormFallbacks(input: SubmitEnquiryInput) {
    const filled: Record<string, unknown> = { ...input }
    const notProvided: string[] = []
    for (const [field, [label, value]] of Object.entries(FORM_FALLBACKS[input.service] ?? {})) {
        if (filled[field]) continue
        filled[field] = value
        notProvided.push(label)
    }
    return { filled, notProvided }
}

export const submitEnquiryTool = tool({
    description:
        "Pass the customer's question or booking request to the Fizz Kidz team, who follow up with them. The customer gets a confirmation email. Only call this after the customer has confirmed the details and said yes to sending it.",
    inputSchema: SubmitEnquiryInputSchema,
    execute: async (input, { messages }) => {
        const { filled, notProvided } = withFormFallbacks(input)
        const enquiry = ContactWebsiteFormSchema.safeParse({
            ...filled,
            enquiry: [
                input.enquiry,
                notProvided.length > 0 && `Not provided yet: ${notProvided.join(', ')}.`,
                '(Left by Frankie, the website chat assistant)',
            ]
                .filter(Boolean)
                .join('\n\n'),
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
