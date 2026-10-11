import type { WWCC } from '..'

export type PFFile = { url: string; name: string; type: string }

export type OnboardingForm = {
    id: string
    firstName: string
    lastName: string
    pronouns: string
    dob: string
    email: string
    mobile: string
    address: string
    address_street: string
    address_suburb: string
    address_state: string
    address_postcode: string
    health: string
    wwccStatus: WWCC['status']
    wwccPhoto: PFFile
    wwccCardNumber: string
    wwccApplicationNumber: string
    cprFirstAid: PFFile | null
    foodSafety: PFFile | null
    tfnForm: PFFile
    bankAccountName: string
    bsb: string
    accountNumber: string
    emergencyContactName: string
    emergencyContactMobile: string
    emergencyContactRelation: string
}

export type IncursionForm = {
    id: string
    organisation: string
    address: string
    numberOfChildren: string
    location: string
    parking: string
    expectedLearning: string
    teacherInformation: string
    additionalInformation: string
    hearAboutUs: string
}
