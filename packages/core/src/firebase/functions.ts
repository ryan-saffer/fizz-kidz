import type { IncursionForm, OnboardingForm, PaperFormResponse } from '../paperform'

export interface PubSubFunctions {
    background:
        | { name: 'sendIncursionForms' }
        | { name: 'sendGuestsEmail' }
        | { name: 'sendCakeForms' }
        | { name: 'sendPartyFormReminderEmails' }
        | { name: 'sendPartyForms' }
        | { name: 'sendPartyFeedbackEmails' }
        | { name: 'remindAboutWwcc' }
        | { name: 'remindAboutTurning18NextMonth' }
        | { name: 'sendMinimumShiftLengthReport' }
        | { name: 'updateSlingWages' }
        | { name: 'paperformSubmission'; form: 'incursion'; data: PaperFormResponse<IncursionForm> }
        | {
              name: 'paperformSubmission'
              form: 'onboarding'
              data: { formData: PaperFormResponse<OnboardingForm>; pdfUrl: string }
          }
        | { name: 'cleanUpStaleInvitations' }
        | { name: 'finishWebsiteChats' }
}
