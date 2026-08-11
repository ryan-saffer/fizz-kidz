import { z } from 'zod'

import type { Studio } from '../core/studio'

type SelectOption = {
    value: string
    label: string
}

type SelectOptionTuple = readonly [SelectOption, ...SelectOption[]]

type OptionValues<T extends SelectOptionTuple> = {
    [Index in keyof T]: T[Index] extends SelectOption ? T[Index]['value'] : never
}

function getOptionValues<const T extends SelectOptionTuple>(options: T): OptionValues<T> {
    return options.map(({ value }) => value) as OptionValues<T>
}

export const WebsiteStudioOptions = [
    { value: 'balwyn', label: 'Balwyn' },
    { value: 'cheltenham', label: 'Cheltenham' },
    { value: 'essendon', label: 'Essendon' },
    { value: 'geelong', label: 'Geelong' },
    { value: 'kingsville', label: 'Kingsville' },
    { value: 'malvern', label: 'Malvern' },
    { value: 'werribee', label: 'Werribee' },
] as const satisfies SelectOptionTuple & readonly { value: Studio; label: string }[]

export const ContactFormLocationOptions = [
    ...WebsiteStudioOptions,
    { value: 'at-home', label: 'At Home' },
    { value: 'other', label: 'Other' },
] as const satisfies SelectOptionTuple

export const PartyThemeOptions = [
    { value: 'glam', label: 'Glam Party' },
    { value: 'fluid-bears', label: 'Fluid Bears Party' },
    { value: 'kpop', label: 'Kpop Power Party' },
    { value: 'fairy', label: 'Fairy Party' },
    { value: 'safari', label: 'Jungle Safari Party' },
    { value: 'science', label: 'Science Party' },
    { value: 'slime', label: 'Slime Party' },
    { value: 'swiftie', label: 'Swiftie Party' },
    { value: 'tie-dye', label: 'Tie-Dye Party' },
    { value: 'own', label: 'My own theme' },
    { value: 'mix', label: 'A mix of the above' },
] as const satisfies SelectOptionTuple

export const ReferenceOptions = [
    { value: 'google', label: 'Google Search' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'word-of-mouth', label: 'Word of mouth' },
    { value: 'attended-fizz', label: 'Attended a Fizz Kidz experience' },
    { value: 'other', label: 'Other' },
] as const satisfies SelectOptionTuple

export const ContactFormServiceOptions = [
    { value: 'party', label: 'Birthday Party' },
    { value: 'holiday-program', label: 'Holiday Program' },
    { value: 'after-school-program', label: 'After School Program' },
    { value: 'incursion', label: 'School Incursion' },
    { value: 'activation', label: 'Activation and Events' },
    { value: 'other', label: 'Other' },
] as const satisfies SelectOptionTuple

export const IncursionFormModuleOptions = [
    { value: 'chemicalScience', label: 'Chemical Science' },
    { value: 'pushAndPull', label: 'Push and Pull' },
    { value: 'lightAndSound', label: 'Light and Sound' },
    { value: 'earthWeatherSustainability', label: 'Earth, Weather and Sustainability' },
    { value: 'notSure', label: 'A combination of the above / not sure' },
] as const satisfies SelectOptionTuple

export const CareersFormRoleOptions = [
    { value: 'facilitator', label: 'Studio Facilitator' },
    { value: 'other', label: 'Other' },
] as const satisfies SelectOptionTuple

export const YesNoOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
] as const satisfies SelectOptionTuple

export const AustralianStateOptions = [
    { value: 'ACT', label: 'ACT' },
    { value: 'NSW', label: 'NSW' },
    { value: 'NT', label: 'NT' },
    { value: 'QLD', label: 'QLD' },
    { value: 'TAS', label: 'TAS' },
    { value: 'VIC', label: 'VIC' },
    { value: 'WA', label: 'WA' },
] as const satisfies SelectOptionTuple

export const FranchisingInterestOptions = [
    { value: '3', label: 'Get started in 3 months' },
    { value: '6', label: 'Get started in 3-6 months' },
    { value: '12', label: 'Get started in 6-12 months' },
    { value: '12+', label: 'Get started in 12+ months' },
    { value: 'browsing', label: 'Just browsing' },
] as const satisfies SelectOptionTuple

const websiteStudioSchema = z.enum(getOptionValues(WebsiteStudioOptions))
const contactFormLocationSchema = z.enum(getOptionValues(ContactFormLocationOptions), {
    required_error: 'Please select a location',
})
const partyThemeSchema = z.enum(getOptionValues(PartyThemeOptions), {
    required_error: 'Please select your preferred party theme',
})
const referenceSchema = z.enum(getOptionValues(ReferenceOptions), {
    required_error: 'Please select how you heard about us',
})
const contactFormServiceSchema = z.enum(getOptionValues(ContactFormServiceOptions), {
    required_error: 'Please select which experience you are interested in',
})
const incursionFormModuleSchema = z.enum(getOptionValues(IncursionFormModuleOptions), {
    required_error: 'Please select a module',
})
const careersFormRoleSchema = z.enum(getOptionValues(CareersFormRoleOptions), {
    required_error: 'Please select which role you are applying for',
})
const yesNoSchema = z.enum(getOptionValues(YesNoOptions))
const australianStateSchema = z.enum(getOptionValues(AustralianStateOptions), {
    required_error: 'Please select a state',
})
const franchisingInterestSchema = z.enum(getOptionValues(FranchisingInterestOptions), {
    required_error: 'Please select your interest level',
})

const nameSchema = z.string().min(1, 'Name is required')
const contactNameSchema = z.string().min(1, 'Contact name is required')
const emailSchema = z.string().min(1, 'Email address is required').email()
const contactNumberSchema = z.string().min(10, 'Contact number must be at least 10 digits long')

export const PartyWebsiteFormSchema = z
    .object({
        name: contactNameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema,
        location: contactFormLocationSchema,
        suburb: z.string().optional(),
        preferredDateAndTime: z.string().min(1, 'Please enter your preferred date and time'),
        partyTheme: partyThemeSchema,
        enquiry: z.string().min(1, 'Please enter an enquiry'),
        reference: referenceSchema,
        referenceOther: z.string().optional(),
    })
    .superRefine((value, context) => {
        if (value.location === 'at-home' && !value.suburb) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please enter your suburb',
                path: ['suburb'],
            })
        }
    })

const optionalPositiveInteger = z
    .string()
    .trim()
    .refine((value) => value === '' || /^[1-9]\d*$/.test(value), 'Please enter a whole number greater than zero')
    .optional()

export const ContactWebsiteFormSchema = z
    .object({
        name: contactNameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema,
        service: contactFormServiceSchema,
        location: contactFormLocationSchema.optional(),
        suburb: z.string().optional(),
        preferredDateAndTime: z.string().optional(),
        school: z.string().optional(),
        organisation: z.string().optional(),
        module: incursionFormModuleSchema.optional(),
        numberOfSessions: optionalPositiveInteger,
        numberOfStudentsPerSession: z.string().trim().optional(),
        numberOfAttendees: z.string().trim().optional(),
        budget: z.string().optional(),
        partyTheme: partyThemeSchema.optional(),
        enquiry: z.string().min(1, 'Please enter an enquiry'),
        reference: referenceSchema.optional(),
        referenceOther: z.string().optional(),
    })
    .superRefine((value, context) => {
        if ((value.service === 'party' || value.service === 'holiday-program') && !value.location) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please choose a location',
                path: ['location'],
            })
        }
        if (value.service === 'party' && !value.preferredDateAndTime) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please enter your preferred date and time',
                path: ['preferredDateAndTime'],
            })
        }
        if (value.service === 'party' && !value.partyTheme) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please select your preferred party theme',
                path: ['partyTheme'],
            })
        }
        if (value.service === 'party' && value.location === 'at-home' && !value.suburb) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please enter your suburb',
                path: ['suburb'],
            })
        }
        if (value.service === 'incursion') {
            const requiredFields = [
                ['school', value.school, 'School name is required'],
                ['preferredDateAndTime', value.preferredDateAndTime, 'Please enter your preferred date and time'],
                ['module', value.module, 'Please select a module'],
                ['numberOfSessions', value.numberOfSessions, 'Please enter the number of sessions'],
                [
                    'numberOfStudentsPerSession',
                    value.numberOfStudentsPerSession,
                    'Please enter the number of students per session',
                ],
            ] as const

            for (const [field, fieldValue, message] of requiredFields) {
                if (!fieldValue) {
                    context.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] })
                }
            }
        }
        if (value.service === 'activation') {
            const requiredFields = [
                ['organisation', value.organisation, 'Organisation name is required'],
                ['preferredDateAndTime', value.preferredDateAndTime, 'Please enter your preferred date and time'],
                ['numberOfAttendees', value.numberOfAttendees, 'Please enter the estimated number of attendees'],
            ] as const

            for (const [field, fieldValue, message] of requiredFields) {
                if (!fieldValue) {
                    context.addIssue({ code: z.ZodIssueCode.custom, message, path: [field] })
                }
            }
        }
        if (value.service !== 'incursion' && value.service !== 'activation' && !value.reference) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please select how you heard about us',
                path: ['reference'],
            })
        }
    })

export const EventWebsiteFormSchema = z.object({
    name: contactNameSchema,
    email: emailSchema,
    contactNumber: contactNumberSchema,
    organisation: z.string().min(1, 'Organisation name is required'),
    preferredDateAndTime: z.string().min(1, 'Please enter your preferred dates'),
    numberOfAttendees: z.string().trim().min(1, 'Please enter the estimated number of attendees'),
    budget: z.string().optional(),
    enquiry: z.string().min(1, 'Please enter an enquiry'),
    reference: referenceSchema.optional(),
})

export const IncursionWebsiteFormSchema = z.object({
    name: contactNameSchema,
    school: z.string().min(1, 'School name is required'),
    email: emailSchema,
    contactNumber: contactNumberSchema,
    preferredDateAndTime: z.string().min(1, 'Please enter a preferred date and time'),
    module: incursionFormModuleSchema,
    numberOfSessions: z
        .string()
        .trim()
        .regex(/^[1-9]\d*$/, 'Please enter a whole number greater than zero'),
    numberOfStudentsPerSession: z.string().trim().min(1, 'Please enter the number of students per session'),
    enquiry: z.string().min(1, 'Please enter an enquiry'),
    reference: referenceSchema.optional(),
})

export const CareersWebsiteFormSchema = z
    .object({
        name: contactNameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema,
        role: careersFormRoleSchema,
        location: websiteStudioSchema.optional(),
        wwcc: yesNoSchema,
        driversLicense: yesNoSchema,
        application: z.string().min(1, 'Please answer'),
        reference: z.string().min(1, 'Please answer'),
        resume: z.object({
            name: z.string().min(1),
            url: z.string().url(),
        }),
    })
    .superRefine((value, context) => {
        if (!value.location) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Please select location',
                path: ['location'],
            })
        }
    })

export const MailingListWebsiteFormSchema = z.object({
    name: nameSchema,
    email: emailSchema,
})

export const HolidayProgramDiscountWebsiteFormSchema = z.object({
    name: nameSchema,
    email: emailSchema,
    joinMailingList: z.boolean().default(true),
})

export const FranchisingWebsiteFormSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: emailSchema,
    contactNumber: contactNumberSchema,
    suburb: z.string().min(1, 'Suburb is required'),
    state: australianStateSchema,
    interest: franchisingInterestSchema,
    enquiry: z.string().min(1, 'Please tell us a bit about yourself!'),
    reference: z.string().min(1, 'Please enter how you heard about us'),
})

export const WebsiteFormSchemas = {
    party: PartyWebsiteFormSchema,
    contact: ContactWebsiteFormSchema,
    event: EventWebsiteFormSchema,
    incursion: IncursionWebsiteFormSchema,
    careers: CareersWebsiteFormSchema,
    mailingList: MailingListWebsiteFormSchema,
    holidayProgramDiscount: HolidayProgramDiscountWebsiteFormSchema,
    franchising: FranchisingWebsiteFormSchema,
} as const

export type WebsiteFormId = keyof typeof WebsiteFormSchemas
export type WebsiteForm = {
    [FormId in WebsiteFormId]: z.infer<(typeof WebsiteFormSchemas)[FormId]>
}

export const WebsiteFormIdSchema = z.enum(Object.keys(WebsiteFormSchemas) as [WebsiteFormId, ...WebsiteFormId[]])

export type ContactFormLocationOption = z.infer<typeof contactFormLocationSchema>
export type ContactFormServiceOption = z.infer<typeof contactFormServiceSchema>
export type ReferenceOption = z.infer<typeof referenceSchema>
export type PartyTheme = z.infer<typeof partyThemeSchema>
export type IncursionFormModuleOption = z.infer<typeof incursionFormModuleSchema>
export type CareersFormRoleOption = z.infer<typeof careersFormRoleSchema>
export type FranchisingInterestOption = z.infer<typeof franchisingInterestSchema>

export const ContactFormLocationMap = Object.fromEntries(
    ContactFormLocationOptions.map(({ value }) => [
        value,
        WebsiteStudioOptions.some((studio) => studio.value === value) ? (value as Studio) : undefined,
    ])
) as Record<ContactFormLocationOption, Studio | undefined>

export const PartyFormLocationMap = ContactFormLocationMap

export const LocationDisplayValueMap = Object.fromEntries(
    ContactFormLocationOptions.map(({ value, label }) => [
        value,
        value === 'at-home' || value === 'other' ? label : `${label} Studio`,
    ])
) as Record<ContactFormLocationOption, string>

export const PartyThemeDisplayValueMap = Object.fromEntries(
    PartyThemeOptions.map(({ value, label }) => [value, label])
) as Record<PartyTheme, string>

export const ReferenceDisplayValueMap = Object.fromEntries(
    ReferenceOptions.map(({ value, label }) => [value, label])
) as Record<ReferenceOption, string>

export const ServiceDisplayValueMap = Object.fromEntries(
    ContactFormServiceOptions.map(({ value, label }) => [value, label])
) as Record<ContactFormServiceOption, string>

export const ModuleDisplayValueMap = Object.fromEntries(
    IncursionFormModuleOptions.map(({ value, label }) => [value, label])
) as Record<IncursionFormModuleOption, string>

export const RoleDisplayValueMap = Object.fromEntries(
    CareersFormRoleOptions.map(({ value, label }) => [value, label])
) as Record<CareersFormRoleOption, string>

export const FranchisingInterestDisplayValueMap = Object.fromEntries(
    FranchisingInterestOptions.map(({ value, label }) => [value, label])
) as Record<FranchisingInterestOption, string>
