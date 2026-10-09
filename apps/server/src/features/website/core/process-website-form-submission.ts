import {
    ContactFormLocationMap,
    FranchisingInterestDisplayValueMap,
    LocationDisplayValueMap,
    ModuleDisplayValueMap,
    PartyFormLocationMap,
    PartyThemeDisplayValueMap,
    ReferenceDisplayValueMap,
    RoleDisplayValueMap,
    ServiceDisplayValueMap,
    type WebsiteForm,
    type WebsiteFormId,
} from '@fizz-kidz/core'

import { generateDiscountCode } from '@/features/discount-codes/core/generate-discount-code'
import { MixpanelClient } from '@/integrations/mixpanel/mixpanel.client'
import { getTimeOfWeekProperties } from '@/integrations/mixpanel/time-of-week-properties'
import { logError } from '@/integrations/observability/log-error'
import { MailClient } from '@/integrations/sendgrid/sendgrid.client'
import { getZohoRecordUrl, ZohoClient } from '@/integrations/zoho/zoho.client'

type WebsiteFormSubmission = {
    [FormId in WebsiteFormId]: { formId: FormId; data: WebsiteForm[FormId] }
}[WebsiteFormId]
type HolidayProgramDiscountSubmission = Extract<WebsiteFormSubmission, { formId: 'holidayProgramDiscount' }>
type StandardWebsiteFormSubmission = Exclude<WebsiteFormSubmission, HolidayProgramDiscountSubmission>
type HolidayProgramDiscountCode = Awaited<ReturnType<typeof generateDiscountCode>>

/** Runs a Zoho sync, logging a failure rather than failing the submission. Returns the task's result, if it succeeds. */
async function runZohoTask<T>({
    description,
    formId,
    requestBody,
    task,
}: {
    description: string
    formId: WebsiteFormId
    requestBody: unknown
    task: () => Promise<T>
}) {
    try {
        return await task()
    } catch (err) {
        logError(`Zoho sync failed for website form '${formId}' during ${description}`, err, {
            formId,
            requestBody,
        })
    }
}

type ProcessWebsiteFormOptions = {
    /** A website chat transcript, added as a note on the Zoho deal for contact enquiries left by the chat assistant. */
    chatTranscript?: string
}

export function processWebsiteFormSubmission(
    submission: HolidayProgramDiscountSubmission
): Promise<HolidayProgramDiscountCode>
export function processWebsiteFormSubmission(
    submission: StandardWebsiteFormSubmission,
    options?: ProcessWebsiteFormOptions
): Promise<void>
export async function processWebsiteFormSubmission(
    submission: WebsiteFormSubmission,
    options: ProcessWebsiteFormOptions = {}
): Promise<HolidayProgramDiscountCode | void> {
    const formId = submission.formId
    const requestBody = submission.data
    const zohoClient = new ZohoClient()
    const mailClient = await MailClient.getInstance()
    const mixpanelClient = await MixpanelClient.getInstance()

    try {
        switch (submission.formId) {
            case 'party': {
                const formData = submission.data

                const [firstName, lastName] = formData.name.split(' ')
                // A link to the enquiry in Zoho for the team's email.
                const zohoUrl = await runZohoTask({
                    description: 'party enquiry sync',
                    formId,
                    requestBody,
                    task: async () => {
                        const contactId = await zohoClient.addBasicB2CContact({
                            firstName,
                            lastName: lastName || '',
                            email: formData.email,
                            studio: PartyFormLocationMap[formData.location],
                            mobile: formData.contactNumber,
                            optOutOfMarketing: false,
                        })

                        const dealId = await zohoClient.createBirthdayPartyDeal({
                            firstName,
                            lastName: lastName || '',
                            email: formData.email,
                            mobile: formData.contactNumber,
                            contactId,
                            preferredDateAndTime: formData.preferredDateAndTime,
                            type:
                                formData.location === 'at-home'
                                    ? 'mobile'
                                    : formData.location === 'other'
                                      ? 'other'
                                      : 'studio',
                            studio:
                                formData.location === 'at-home' || formData.location === 'other'
                                    ? ''
                                    : formData.location,
                            suburb: formData.suburb,
                            reference: formData.reference,
                            partyTheme: formData.partyTheme,
                            enquiry: formData.enquiry,
                        })
                        return getZohoRecordUrl('Deals', dealId)
                    },
                })

                await mailClient.sendEmail(
                    'websitePartyFormToCustomer',
                    formData.email,
                    {
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        location: LocationDisplayValueMap[formData.location],
                        suburb: formData.suburb,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        partyTheme: PartyThemeDisplayValueMap[formData.partyTheme],
                        enquiry: formData.enquiry,
                        reference:
                            formData.reference === 'other' && formData.referenceOther
                                ? formData.referenceOther
                                : ReferenceDisplayValueMap[formData.reference],
                    },
                    {
                        bccBookings: false,
                    }
                )

                await mailClient.sendEmail(
                    'websitePartyFormToFizz',
                    'bookings@fizzkidz.com.au',
                    {
                        zohoUrl,
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        location: LocationDisplayValueMap[formData.location],
                        suburb: formData.suburb,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        partyTheme: PartyThemeDisplayValueMap[formData.partyTheme],
                        enquiry: formData.enquiry,
                        reference:
                            formData.reference === 'other' && formData.referenceOther
                                ? formData.referenceOther
                                : ReferenceDisplayValueMap[formData.reference],
                    },
                    {
                        subject: `${LocationDisplayValueMap[formData.location]} - ${formData.name}`,
                        replyTo: formData.email,
                    }
                )

                await mixpanelClient.track('website-enquiry', {
                    ...getTimeOfWeekProperties(new Date()),
                    distinct_id: formData.email,
                    form: 'party',
                    service: 'party',
                    location: formData.location,
                    reference: formData.reference,
                    partyTheme: PartyThemeDisplayValueMap[formData.partyTheme],
                    ...(formData.reference === 'other' &&
                        formData.referenceOther && { referenceOther: formData.referenceOther }),
                })

                break
            }

            case 'contact': {
                const formData = submission.data
                const [firstName, lastName] = formData['name'].split(' ')

                const service = formData.service
                // Added to the deal, or to the contact when the enquiry has no deal.
                const addChatTranscript = async (module: 'Deals' | 'Contacts', recordId: string) => {
                    if (!options.chatTranscript) return
                    await zohoClient.addNote({
                        module,
                        recordId,
                        title: 'Website chat transcript',
                        content: options.chatTranscript,
                    })
                }

                // A link to the enquiry in Zoho for the team's email.
                const zohoUrl = await runZohoTask({
                    description: 'contact form sync',
                    formId,
                    requestBody,
                    task: async () => {
                        switch (true) {
                            case service === 'other': {
                                // Kept as a lead, so the team can follow up and they get the right marketing.
                                const contactId = await zohoClient.addBasicB2CContact({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    optOutOfMarketing: false,
                                    ...(formData.location && { studio: ContactFormLocationMap[formData.location] }),
                                })
                                await addChatTranscript('Contacts', contactId)
                                return getZohoRecordUrl('Contacts', contactId)
                            }
                            case service === 'party' && formData.partyTheme !== undefined: {
                                const contactId = await zohoClient.addBasicB2CContact({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    optOutOfMarketing: false,
                                    ...(formData.location && { studio: ContactFormLocationMap[formData.location] }),
                                })
                                const dealId = await zohoClient.createBirthdayPartyDeal({
                                    firstName,
                                    lastName: lastName || '',
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    contactId,
                                    preferredDateAndTime: formData.preferredDateAndTime || '',
                                    type:
                                        formData.location === 'at-home'
                                            ? 'mobile'
                                            : formData.location === 'other'
                                              ? 'other'
                                              : 'studio',
                                    studio:
                                        formData.location === 'at-home' || formData.location === 'other'
                                            ? ''
                                            : formData.location || '',
                                    suburb: formData.suburb,
                                    reference: formData.reference ?? 'other',
                                    partyTheme: formData.partyTheme,
                                    enquiry: formData.enquiry,
                                })
                                await addChatTranscript('Deals', dealId)
                                return getZohoRecordUrl('Deals', dealId)
                            }
                            case service === 'holiday-program' || service === 'after-school-program': {
                                const contactId = await zohoClient.addBasicB2CContact({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    optOutOfMarketing: false,
                                    ...(formData.location && { studio: ContactFormLocationMap[formData.location] }),
                                })
                                await addChatTranscript('Contacts', contactId)
                                return getZohoRecordUrl('Contacts', contactId)
                            }
                            case service === 'incursion': {
                                const contactId = await zohoClient.createB2BContact({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    service: 'incursion',
                                })
                                const dealId = await zohoClient.createB2BDeal({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    contactId,
                                    organisationName: formData.school || '',
                                    service: 'Incursion',
                                    preferredDateAndTime: formData.preferredDateAndTime || '',
                                    ...(formData.module && { module: ModuleDisplayValueMap[formData.module] }),
                                    numberOfSessions: formData.numberOfSessions,
                                    numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                                    enquiry: formData.enquiry,
                                    reference: formData.reference,
                                })
                                await addChatTranscript('Deals', dealId)
                                return getZohoRecordUrl('Deals', dealId)
                            }
                            case service === 'activation': {
                                const contactId = await zohoClient.createB2BContact({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    service: 'activation_event',
                                })
                                const dealId = await zohoClient.createB2BDeal({
                                    firstName,
                                    lastName,
                                    email: formData.email,
                                    mobile: formData.contactNumber,
                                    contactId,
                                    organisationName: formData.organisation || '',
                                    service: 'Activation / Event',
                                    preferredDateAndTime: formData.preferredDateAndTime || '',
                                    numberOfAttendees: formData.numberOfAttendees,
                                    budget: formData.budget,
                                    enquiry: formData.enquiry,
                                    reference: formData.reference,
                                })
                                await addChatTranscript('Deals', dealId)
                                return getZohoRecordUrl('Deals', dealId)
                            }
                            default: {
                                // we still want the user to see a success here, so only log the error
                                logError(`Unrecognised service when submitting website 'contact' form: '${service}'`)
                                return undefined
                            }
                        }
                    },
                })

                await mailClient.sendEmail(
                    'websiteContactFormToCustomer',
                    formData.email,
                    {
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        service: ServiceDisplayValueMap[formData.service],
                        enquiry: formData.enquiry,
                        ...(formData.location && { location: LocationDisplayValueMap[formData.location] }),
                        preferredDateAndTime: formData.preferredDateAndTime,
                        school: formData.school,
                        organisation: formData.organisation,
                        module: formData.module ? ModuleDisplayValueMap[formData.module] : undefined,
                        numberOfSessions: formData.numberOfSessions,
                        numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                        numberOfAttendees: formData.numberOfAttendees,
                        budget: formData.budget,
                        suburb: formData.suburb,
                        reference:
                            formData.reference === 'other' && formData.referenceOther
                                ? formData.referenceOther
                                : formData.reference
                                  ? ReferenceDisplayValueMap[formData.reference]
                                  : undefined,
                    },
                    {
                        bccBookings: false,
                    }
                )

                await mailClient.sendEmail(
                    'websiteContactFormToFizz',
                    'bookings@fizzkidz.com.au',
                    {
                        zohoUrl,
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        service: ServiceDisplayValueMap[formData.service],
                        enquiry: formData.enquiry,
                        ...(formData.location && { location: LocationDisplayValueMap[formData.location] }),
                        preferredDateAndTime: formData.preferredDateAndTime,
                        school: formData.school,
                        organisation: formData.organisation,
                        module: formData.module ? ModuleDisplayValueMap[formData.module] : undefined,
                        numberOfSessions: formData.numberOfSessions,
                        numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                        numberOfAttendees: formData.numberOfAttendees,
                        budget: formData.budget,
                        suburb: formData.suburb,
                        reference:
                            formData.reference === 'other' && formData.referenceOther
                                ? formData.referenceOther
                                : formData.reference
                                  ? ReferenceDisplayValueMap[formData.reference]
                                  : undefined,
                    },
                    {
                        subject: `${ServiceDisplayValueMap[formData.service]} - ${formData.name}`,
                        replyTo: formData.email,
                    }
                )

                await mixpanelClient.track('website-enquiry', {
                    ...getTimeOfWeekProperties(new Date()),
                    distinct_id: formData.email,
                    form: 'contact',
                    service,
                    location: formData.location,
                    reference: formData.reference,
                    ...(formData.partyTheme && { partyTheme: PartyThemeDisplayValueMap[formData.partyTheme] }),
                    ...(formData.reference === 'other' &&
                        formData.referenceOther && { referenceOther: formData.referenceOther }),
                })

                break
            }

            case 'event': {
                const formData = submission.data

                const [firstName, lastName] = formData.name.split(' ')
                // A link to the enquiry in Zoho for the team's email.
                const zohoUrl = await runZohoTask({
                    description: 'event enquiry sync',
                    formId,
                    requestBody,
                    task: async () => {
                        const contactId = await zohoClient.createB2BContact({
                            firstName,
                            lastName,
                            email: formData.email,
                            mobile: formData.contactNumber,
                            service: 'activation_event',
                        })
                        const dealId = await zohoClient.createB2BDeal({
                            firstName,
                            lastName,
                            email: formData.email,
                            mobile: formData.contactNumber,
                            contactId,
                            organisationName: formData.organisation,
                            service: 'Activation / Event',
                            preferredDateAndTime: formData.preferredDateAndTime,
                            numberOfAttendees: formData.numberOfAttendees,
                            budget: formData.budget,
                            enquiry: formData.enquiry,
                            reference: formData.reference,
                        })
                        return getZohoRecordUrl('Deals', dealId)
                    },
                })

                await mailClient.sendEmail(
                    'websiteEventFormToCustomer',
                    formData.email,
                    {
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        organisation: formData.organisation,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        numberOfAttendees: formData.numberOfAttendees,
                        budget: formData.budget,
                        enquiry: formData.enquiry,
                        reference: formData.reference ? ReferenceDisplayValueMap[formData.reference] : undefined,
                    },
                    {
                        bccBookings: false,
                    }
                )
                await mailClient.sendEmail(
                    'websiteEventFormToFizz',
                    'bookings@fizzkidz.com.au',
                    {
                        zohoUrl,
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        organisation: formData.organisation,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        numberOfAttendees: formData.numberOfAttendees,
                        budget: formData.budget,
                        enquiry: formData.enquiry,
                        reference: formData.reference ? ReferenceDisplayValueMap[formData.reference] : undefined,
                    },
                    {
                        subject: `Event - ${formData.name}`,
                        replyTo: formData.email,
                    }
                )

                await mixpanelClient.track('website-enquiry', {
                    ...getTimeOfWeekProperties(new Date()),
                    distinct_id: formData.email,
                    form: 'event',
                    service: 'activation',
                    reference: formData.reference,
                })

                break
            }

            case 'incursion': {
                const formData = submission.data

                const [firstName, lastName] = formData.name.split(' ')
                // A link to the enquiry in Zoho for the team's email.
                const zohoUrl = await runZohoTask({
                    description: 'incursion enquiry sync',
                    formId,
                    requestBody,
                    task: async () => {
                        const contactId = await zohoClient.createB2BContact({
                            firstName,
                            lastName,
                            email: formData.email,
                            mobile: formData.contactNumber,
                            service: 'incursion',
                        })
                        const dealId = await zohoClient.createB2BDeal({
                            firstName,
                            lastName,
                            email: formData.email,
                            mobile: formData.contactNumber,
                            contactId,
                            organisationName: formData.school,
                            service: 'Incursion',
                            preferredDateAndTime: formData.preferredDateAndTime,
                            module: ModuleDisplayValueMap[formData.module],
                            numberOfSessions: formData.numberOfSessions,
                            numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                            enquiry: formData.enquiry,
                            reference: formData.reference,
                        })
                        return getZohoRecordUrl('Deals', dealId)
                    },
                })

                await mailClient.sendEmail(
                    'websiteIncurionFormToCustomer',
                    formData.email,
                    {
                        name: formData.name,
                        school: formData.school,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        module: ModuleDisplayValueMap[formData.module],
                        numberOfSessions: formData.numberOfSessions,
                        numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                        enquiry: formData.enquiry,
                        reference: formData.reference ? ReferenceDisplayValueMap[formData.reference] : undefined,
                    },
                    {
                        bccBookings: false,
                    }
                )
                await mailClient.sendEmail(
                    'websiteIncurionFormToFizz',
                    'bookings@fizzkidz.com.au',
                    {
                        zohoUrl,
                        name: formData.name,
                        school: formData.school,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        preferredDateAndTime: formData.preferredDateAndTime,
                        module: ModuleDisplayValueMap[formData.module],
                        numberOfSessions: formData.numberOfSessions,
                        numberOfStudentsPerSession: formData.numberOfStudentsPerSession,
                        enquiry: formData.enquiry,
                        reference: formData.reference ? ReferenceDisplayValueMap[formData.reference] : undefined,
                    },
                    {
                        subject: `Incursion - ${formData.name}, ${formData.school}`,
                        replyTo: formData.email,
                    }
                )

                await mixpanelClient.track('website-enquiry', {
                    ...getTimeOfWeekProperties(new Date()),
                    distinct_id: formData.email,
                    form: 'incursion',
                    service: 'incursion',
                })

                break
            }

            case 'careers': {
                const formData = submission.data

                await mailClient.sendEmail(
                    'websiteCareersFormToCustomer',
                    formData.email,
                    {
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        role: RoleDisplayValueMap[formData.role],
                        location: formData.location ? LocationDisplayValueMap[formData.location] : '',
                        wwcc: formData.wwcc,
                        driversLicense: formData.driversLicense,
                        resumeUrl: formData.resume.url,
                        resumeFilename: formData.resume.name,
                        application: formData.application,
                        reference: formData.reference,
                    },
                    {
                        bccBookings: false,
                    }
                )

                await mailClient.sendEmail(
                    'websiteCareersFormToFizz',
                    'people@fizzkidz.com.au',
                    {
                        name: formData.name,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        role: RoleDisplayValueMap[formData.role],
                        location: formData.location ? LocationDisplayValueMap[formData.location] : '',
                        wwcc: formData.wwcc,
                        driversLicense: formData.driversLicense,
                        resumeFilename: formData.resume.name,
                        resumeUrl: formData.resume.url,
                        application: formData.application,
                        reference: formData.reference,
                    },
                    {
                        subject: `${formData.name} - Job Application`,
                        replyTo: formData.email,
                        bccBookings: false,
                    }
                )
                break
            }

            case 'mailingList': {
                const formData = submission.data

                const [firstName, lastName] = formData.name.split(' ')

                await runZohoTask({
                    description: 'mailing list sync',
                    formId,
                    requestBody,
                    task: () =>
                        zohoClient.addBasicB2CContact({
                            firstName,
                            lastName,
                            email: formData.email,
                            optOutOfMarketing: false,
                        }),
                })

                await mixpanelClient.track('website-enquiry', {
                    ...getTimeOfWeekProperties(new Date()),
                    distinct_id: formData.email,
                    form: 'mailingList',
                })

                break
            }

            case 'holidayProgramDiscount': {
                const formData = submission.data
                const [firstName, lastName] = formData.name.split(' ')
                const data = await generateDiscountCode(firstName)
                await runZohoTask({
                    description: 'holiday program discount sync',
                    formId,
                    requestBody,
                    task: () =>
                        zohoClient.addBasicB2CContact({
                            firstName,
                            lastName,
                            email: formData.email,
                            optOutOfMarketing: false,
                        }),
                })
                await mixpanelClient.track('holiday-program-website-discount', {
                    name: formData.name,
                    distinct_id: formData.email,
                })

                return data
            }

            case 'franchising': {
                const formData = submission.data

                await mailClient.sendEmail(
                    'websiteFranchisingFormToCustomer',
                    formData.email,
                    {
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        suburb: formData.suburb,
                        state: formData.state,
                        interest: FranchisingInterestDisplayValueMap[formData.interest],
                        enquiry: formData.enquiry,
                        reference: formData.reference,
                    },
                    {
                        bccBookings: false,
                    }
                )

                await mailClient.sendEmail(
                    'websiteFranchisingFormToFizz',
                    'kym@fizzkidz.com.au',
                    {
                        firstName: formData.firstName,
                        lastName: formData.lastName,
                        email: formData.email,
                        contactNumber: formData.contactNumber,
                        suburb: formData.suburb,
                        state: formData.state,
                        interest: FranchisingInterestDisplayValueMap[formData.interest],
                        enquiry: formData.enquiry,
                        reference: formData.reference,
                    },
                    {
                        subject: `${formData.firstName} ${formData.lastName} - ${formData.suburb}, ${formData.state}`,
                        replyTo: formData.email,
                        bccBookings: false,
                    }
                )

                break
            }

            default: {
                const exhaustiveCheck: never = submission
                throw new Error(`Unhandled website form submission: ${exhaustiveCheck}`)
            }
        }
    } catch (err) {
        logError(`Error processing website form with id: ${submission.formId}`, err, {
            formId,
            requestBody,
        })
        throw err
    }

    return undefined
}
