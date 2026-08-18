import fs from 'fs'
import path from 'path'

import { logger } from 'firebase-functions/v2'
import Mustache from 'mustache'

import { assertNever } from '@fizz-kidz/core'

import type { Emails } from './types'
import type { ClientStatus } from '@/shared/lazy-client/client-status'

import { env } from '@/app/init/firebase'

// This type query is erased; SendGrid is loaded only by #initialise's dynamic import.
// oxlint-disable-next-line typescript/consistent-type-imports
type MailService = typeof import('@sendgrid/mail')

type Options = {
    /**
     * Should a copy of this email be sent to 'bookings@fizzkidz.com.au'?
     *
     * @default true
     */
    bccBookings?: boolean
    from?: {
        name: string
        email: string
    }
    subject?: string
    replyTo?: string
    bcc?: string[]
    cc?: string[]
}

export class MailClient {
    private static instance: MailClient
    #status: ClientStatus = 'not-initialised'

    #client: MailService | null = null

    private constructor() {}

    static async getInstance() {
        if (!MailClient.instance) {
            MailClient.instance = new MailClient()
            await MailClient.instance.#initialise()
        }
        while (MailClient.instance.#status === 'initialising') {
            await new Promise((resolve) => setTimeout(resolve, 20))
        }
        return MailClient.instance
    }

    async #initialise() {
        this.#status = 'initialising'
        const sgMail = await import('@sendgrid/mail')
        this.#client = sgMail.default
        this.#client.setApiKey(process.env.SEND_GRID_API_KEY)
        this.#status = 'initialised'
    }

    get #sgMail() {
        if (this.#client) return this.#client
        throw new Error('Mail client not initialised')
    }

    async sendEmail<T extends keyof Emails>(email: T, to: string, values: Emails[T], _options: Options = {}) {
        const defaultOptions = { bccBookings: true, bcc: [], cc: [] } satisfies Options
        let options = { ...defaultOptions, ..._options }

        // if the email is being sent to bookings@fizz, and `bccBookings` is set to true, it will fail.
        // fix this here in case.
        if (options.bccBookings && to === 'bookings@fizzkidz.com.au') {
            options = { ...options, bccBookings: false }
        }

        const { emailInfo, template, useMjml } = this._getInfo(email, to, options)
        const html = await this._generateHtml(template, values, useMjml)

        // no need to bcc people in dev environment.
        // this only ignores those dynamically bcc'd and bookings@fizz. Those hardcoded in _getInfo() will still be sent.
        if (env === 'prod') {
            emailInfo.bcc = [
                ...(emailInfo.bcc || []),
                ...options.bcc,
                ...(options.bccBookings ? ['bookings@fizzkidz.com.au'] : []),
                '8gvzc6g7_w0e8cp7c@mails1.zohocrm.com.au', // zoho crm bcc dropbox
            ]
            emailInfo.cc = [...(emailInfo.cc || []), ...options.cc]
        }

        await this.#sgMail.send({ ...emailInfo, html })
    }

    private async _generateHtml(template: string, values: Record<string, unknown>, useMjml: boolean) {
        // if running script locally the path to the mjml files will be different vs when bundled for deployement.
        const possiblePaths = [
            path.resolve(__dirname, `mjml/${template}`),
            path.resolve(__dirname, `integrations/sendgrid/mjml/${template}`),
        ]
        const templatePath = possiblePaths.find((it) => fs.existsSync(it))

        if (!templatePath) {
            throw new Error(`Could not find email template '${template}'`)
        }

        const mjml = fs.readFileSync(templatePath, 'utf-8')
        const output = Mustache.render(mjml, values)
        if (useMjml) {
            const mjml2html = await import('mjml')
            const mjmlOutput = mjml2html.default(output, { keepComments: false })
            if (mjmlOutput.errors.length > 0) {
                mjmlOutput.errors.forEach((error) => {
                    logger.log(error.formattedMessage)
                })
                logger.log('error converting mjml to html')
                throw new Error('error converting mjml to html')
            } else {
                return mjmlOutput.html
            }
        } else {
            return output
        }
    }

    private _getInfo<T extends keyof Emails>(
        email: T,
        to: string,
        options: Options
    ): {
        emailInfo: {
            to: string
            from: { name: string; email: string }
            subject: string
            replyTo: string
            bcc?: string[]
            cc?: string[]
        }
        template: string
        useMjml: boolean
    } {
        const { from, subject, replyTo } = options
        switch (email) {
            case 'holidayProgramConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Holiday program booking confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'holiday_program_confirmation.mjml',
                    useMjml: true,
                }
            case 'holidayProgramCancellation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Holiday Program Cancelled',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'holiday_program_cancellation.mjml',
                    useMjml: true,
                }
            case 'geelongOpeningConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Geelong open day booking confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'geelong_opening_confirmation.mjml',
                    useMjml: true,
                }
            case 'afterSchoolEnrolmentConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Science Program Enrolment Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'after_school_enrolment_confirmation.mjml',
                    useMjml: true,
                }
            case 'termContinuationEmail':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Thanks for coming to your first session!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'term_continuation_email.mjml',
                    useMjml: true,
                }
            case 'afterSchoolUnenrolmentConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Unenrolment Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'term_unenrolment_confirmation.mjml',
                    useMjml: true,
                }
            case 'afterSchoolParentPortalLink':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Manage your enrolment',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'after_school_parent_portal.mjml',
                    useMjml: true,
                }
            case 'standardEventBookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'event_booking_confirmation.mjml',
                    useMjml: true,
                }
            case 'incursionBookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'incursion_booking_confirmation.mjml',
                    useMjml: true,
                }
            case 'incursionForm':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Science incursion is coming up!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'incursion_form.mjml',
                    useMjml: true,
                }
            case 'incursionFormCompletedToCustomer': {
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Submission Received',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'incursion_form_completed.mjml',
                    useMjml: true,
                }
            }
            case 'incursionFormCompletedToFizz': {
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Incursion Form Completed',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Incursion Form Completed',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'incursion_form_completed_notification.mjml',
                    useMjml: true,
                }
            }
            case 'partyBookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Party Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_booking_confirmation.mjml',
                    useMjml: true,
                }
            case 'cakeForm':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Time to Order Your Childs Birthday Cake 🎉',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'cake_form.mjml',
                    useMjml: true,
                }
            case 'partyForm':
                return {
                    emailInfo: {
                        to,
                        from: from || {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Your party is coming up!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_form.mjml',
                    useMjml: true,
                }
            case 'partyFormFilledInAgain':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Party form filled in again!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_form_filled_in_again.html',
                    useMjml: false,
                }
            case 'tooManyCreationsChosen':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Too many creations chosen!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'too_many_creations_chosen.html',
                    useMjml: false,
                }
            case 'partyFormQuestions':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Questions asked in party form!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_form_questions.html',
                    useMjml: false,
                }
            case 'partyPackNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Party packs ordered!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_pack_notification.html',
                    useMjml: false,
                }
            case 'takeHomeNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Take-home items ordered!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'take_home_notification.html',
                    useMjml: false,
                }
            case 'partyFormConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: from || {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Your Party Details',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_form_completed.mjml',
                    useMjml: true,
                }
            case 'cakeFormConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: from || {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Order Received',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'cake_form_completed.mjml',
                    useMjml: true,
                }
            case 'partyFeedback':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: 'Review your Fizz Kidz experience and WIN!',
                        replyTo: 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_feedback.mjml',
                    useMjml: true,
                }
            case 'onboarding':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Onboarding',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'onboarding.html',
                    useMjml: true,
                }
            case 'onboardingFormCompletedNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'Employee onboarding form completed',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'onboarding_form_completed_notification.html',
                    useMjml: false,
                }
            case 'wwccReminder':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'WWCC Reminder',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'wwcc_reminder.html',
                    useMjml: false,
                }
            case 'turning18NextMonthReminder':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'Employees turning 18 next month',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'turning_18_next_month_reminder.html',
                    useMjml: false,
                }
            case 'minimumShiftLengthReport':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Minimum shift length report',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'minimum_shift_length_report.html',
                    useMjml: false,
                }
            case 'createDiscountCode':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Here is your unique discount code!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'discount_code.mjml',
                    useMjml: true,
                }
            case 'invitationGuests':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'We hope you had fun at Fizz Kidz!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'guest_of_party.mjml',
                    useMjml: true,
                }
            case 'notContinuingNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Not Continuing With Term Notification',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'not_continuing_after_school_notification.html',
                    useMjml: false,
                }
            case 'partyFormFoodPackageChanged':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Food package has changed!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'food_package_changed.html',
                    useMjml: false,
                }
            case 'partyFormReminder':
                return {
                    emailInfo: {
                        to,
                        from: from || {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Party Form Reminder',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'party_form_reminder.mjml',
                    useMjml: true,
                }
            case 'accountInvite':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Portal Invitation',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'account_invite.mjml',
                    useMjml: true,
                }
            case 'passwordReset':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz Portal',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Reset your Fizz Kidz Portal password',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'password_reset.mjml',
                    useMjml: true,
                }
            case 'websiteContactFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Enquiry Received!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'website_contact_to_customer.mjml',
                    useMjml: true,
                }
            case 'websiteContactFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Contact Form Enquiry',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Contact Form Enquiry',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_contact_form_to_fizz.html',
                    useMjml: false,
                }
            case 'websiteEventFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Enquiry Received!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'website_activations_and_events_to_customer.mjml',
                    useMjml: true,
                }
            case 'websiteEventFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Event Form Enquiry',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Event Form Enquiry',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_activations_and_events_to_fizz.html',
                    useMjml: false,
                }
            case 'websiteIncurionFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Enquiry Received!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'website_incursion_form_to_customer.mjml',
                    useMjml: true,
                }
            case 'websiteIncurionFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Incursion Form Enquiry',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Incursion Form Enquiry',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_incursion_form_to_fizz.html',
                    useMjml: false,
                }
            case 'websiteCareersFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'people@fizzkidz.com.au',
                        },
                        subject: subject || 'Application Received!',
                        replyTo: replyTo || 'people@fizzkidz.com.au',
                    },
                    template: 'website_careers_form_to_customer.mjml',
                    useMjml: true,
                }
            case 'websiteCareersFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Job Application',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Job Application',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_careers_form_to_fizz.html',
                    useMjml: false,
                }
            case 'websitePartyFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Enquiry Received!',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'website_party_form_to_customer.mjml',
                    useMjml: true,
                }
            case 'websitePartyFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Party Enquiry',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Party Enquiry',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_party_form_to_fizz.html',
                    useMjml: false,
                }
            case 'websiteFranchisingFormToCustomer':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'kym@fizzkidz.com.au',
                        },
                        subject: subject || 'Enquiry Received!',
                        replyTo: replyTo || 'kym@fizzkidz.com.au',
                    },
                    template: 'website_franchising_form_to_customer.mjml',
                    useMjml: true,
                }
            case 'websiteFranchisingFormToFizz':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Franchising Enquiry',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Franchsing Enquiry Received',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'website_franchising_form_to_fizz.html',
                    useMjml: false,
                }
            case 'cakeNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Cake Ordered',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'cake_notification.html',
                    useMjml: false,
                }
            case 'takeHomeBagNotification':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'Fizz Kidz Take Home Bags Ordered',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'take_home_bag_notification.html',
                    useMjml: false,
                }
            case 'playLabBookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Play Lab Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'play_lab_confirmation.mjml',
                    useMjml: true,
                }
            case 'playLabCancellation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Play Lab Session Cancelled',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'play_lab_cancellation.mjml',
                    useMjml: true,
                }
            case 'preschoolProgramBookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Preschool Program Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'preschool_program_booking_confirmation.mjml',
                    useMjml: true,
                }
            case 'preschoolProgramV2BookingConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Preschool Program Booking Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'preschool_program_v2_booking_confirmation.mjml',
                    useMjml: true,
                }
            case 'preschoolProgramV2Cancellation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Preschool Program Session Cancelled',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'preschool_program_v2_cancellation.mjml',
                    useMjml: true,
                }
            case 'preschoolProgramUnenrolmentConfirmation':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'Preschool Program Unenrolment Confirmation',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'preschool_program_unenrolment_confirmation.mjml',
                    useMjml: true,
                }
            case 'rsvpToParty':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'bookings@fizzkidz.com.au',
                        },
                        subject: subject || 'RSVP Recieved',
                        replyTo: replyTo || 'bookings@fizzkidz.com.au',
                    },
                    template: 'rsvp_to_party.mjml',
                    useMjml: true,
                }
            case 'rsvpNotificationToHost':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || 'New RSVP Received',
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'rsvp_notification_to_host.mjml',
                    useMjml: true,
                }
            case 'invitationCreated':
                return {
                    emailInfo: {
                        to,
                        from: {
                            name: 'Fizz Kidz',
                            email: 'noreply@fizzkidz.com.au',
                        },
                        subject: subject || "You're invitation is ready",
                        replyTo: replyTo || 'noreply@fizzkidz.com.au',
                    },
                    template: 'invitation_generated_notification_to_host.mjml',
                    useMjml: true,
                }
            default: {
                assertNever(email)
                throw new Error(`Unrecognised email template: ${email}`)
            }
        }
    }
}
