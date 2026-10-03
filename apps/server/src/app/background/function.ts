import { assertNever, type PubSubFunctions } from '@fizz-kidz/core'

import { onMessagePublished } from '@/app/background/on-message-published'
import { sendIncursionForms } from '@/features/events/core/send-incursion-forms'
import {
    handleGoogleBusinessProfileReviewNotification,
    isGoogleBusinessProfileReviewNotification,
    type GoogleBusinessProfileReviewNotification,
} from '@/features/google-business-profile/core/google-business-profile-review-notification'
import { useInventoryForPastParties } from '@/features/inventory/core/inventory.reservations'
import { cleanUpStaleInvitations } from '@/features/party-bookings/core/rsvp/clean-up-stale-invitations'
import { sendCakeForms } from '@/features/party-bookings/core/send-cake-form'
import { sendGuestsEmail } from '@/features/party-bookings/core/send-guests-email'
import { sendPartyFeedbackEmails } from '@/features/party-bookings/core/send-party-feedback-emails'
import { sendPartyFormReminderEmails } from '@/features/party-bookings/core/send-party-form-reminder-emails'
import { sendPartyForms } from '@/features/party-bookings/core/send-party-forms'
import { updateSlingWages } from '@/features/staff/core/payroll/update-sling-wages'
import { remindAboutTurning18NextMonth } from '@/features/staff/core/remind-about-turning-18-next-month'
import { remindAboutWwcc } from '@/features/staff/core/remind-about-wwcc'
import { sendMinimumShiftLengthReport } from '@/features/staff/core/send-minimum-shift-length-report'
import { finishIdleWebsiteChats } from '@/features/website-chat/core/finish-idle-website-chats'
import { logError } from '@/integrations/observability/log-error'
import { handlePaperformSubmission } from '@/integrations/paperforms/functions/pubsub/paperform.pubsub'

export const pubsub = onMessagePublished(
    'background',
    async (input: PubSubFunctions['background'] | GoogleBusinessProfileReviewNotification) => {
        if (isGoogleBusinessProfileReviewNotification(input)) {
            await handleGoogleBusinessProfileReviewNotification(input)
            return
        }

        if ('name' in input) {
            const { name } = input
            switch (name) {
                case 'sendIncursionForms':
                    // daily at 8:30am
                    await sendIncursionForms()
                    break
                case 'sendGuestsEmail':
                    // daily at 12pm
                    await sendGuestsEmail()
                    break
                case 'sendPartyFormReminderEmails':
                    // 8:30am every Monday
                    await sendPartyFormReminderEmails()
                    break
                case 'sendCakeForms':
                    // 8:30am every Tuesday
                    await sendCakeForms()
                    break
                case 'sendPartyForms':
                    // 8:30am every Tuesday
                    await sendPartyForms()
                    break
                case 'sendPartyFeedbackEmails':
                    // daily at 8:30am
                    await sendPartyFeedbackEmails()
                    break
                case 'remindAboutWwcc':
                    // 1st and 15th of every month at 8:30am
                    await remindAboutWwcc()
                    break
                case 'remindAboutTurning18NextMonth':
                    // 15th of every month at 8:30am
                    await remindAboutTurning18NextMonth()
                    break
                case 'updateSlingWages':
                    // 6:00am every Friday
                    await updateSlingWages()
                    break
                case 'sendMinimumShiftLengthReport':
                    // every Monday at 6:00am; the report checks whether it's the fortnightly pay-cycle Monday
                    await sendMinimumShiftLengthReport()
                    break
                case 'paperformSubmission':
                    // triggered by paperform webhook
                    await handlePaperformSubmission(input)
                    break
                case 'cleanUpStaleInvitations':
                    // 1st of each month at 3:00am
                    await cleanUpStaleInvitations()
                    break
                case 'finishWebsiteChats':
                    // every 15 minutes
                    await finishIdleWebsiteChats()
                    break
                case 'useInventoryForPastParties':
                    // daily at 3:00am
                    await useInventoryForPastParties()
                    break
                default:
                    assertNever(name)
                    logError(`unrecognised pubsub task: '${name}'`)
            }
            return
        }

        logError('unrecognised pubsub message', undefined, { input })
    }
)
