export type Emails = {
    // HOLIDAY PROGRAMS
    holidayProgramConfirmation: {
        parentName: string
        location: string
        address: string
        bookings: { datetime: string; confirmationPage: string }[]
        receiptUrl: string | undefined
    }

    holidayProgramCancellation: {
        parentName: string
        location: string
        booking: string
        receiptUrl: string | undefined
    }

    geelongOpeningConfirmation: {
        parentName: string
        location: string
        address: string
        bookings: { datetime: string; confirmationPage: string }[]
    }

    createDiscountCode: {
        name: string
        code: string
        expiryDate: string
    }

    // PLAY LAB
    playLabBookingConfirmation: {
        parentName: string
        location: string
        bookings: { time: string; details: string; confirmationPage: string }[]
        isTermEnrolment: boolean
        receiptUrl: string | undefined
    }

    playLabCancellation: {
        parentName: string
        location: string
        booking: string
        receiptUrl: string | undefined
    }

    preschoolProgramBookingConfirmation: {
        parentName: string
        childName: string
        className: string
        location: string
        appointmentTimes: string[]
    }

    preschoolProgramV2BookingConfirmation: {
        parentName: string
        location: string
        bookings: { time: string; details: string; confirmationPage: string; isFullTermDiscount: boolean }[]
        receiptUrl: string | undefined
    }

    preschoolProgramV2Cancellation: {
        parentName: string
        booking: string
        location: string
        receiptUrl: string
        refundAmount: string
        hasRefund: boolean
    }

    preschoolProgramUnenrolmentConfirmation: {
        parentName: string
        childName: string
        className: string
    }

    // AFTER SCHOOL PROGRAM
    termContinuationEmail: {
        parentName: string
        className: string
        price: string
        childName: string
        continueUrl: string
        unenrollUrl: string
    }

    afterSchoolEnrolmentConfirmation: {
        isScience: boolean
        isArt: boolean
        inStudio: boolean
        parentName: string
        childName: string
        className: string
        appointmentTimes: string[]
        price: string
        location: string
        numberOfWeeks: string
    }

    afterSchoolUnenrolmentConfirmation: {
        parentName: string
        childName: string
        className: string
    }

    afterSchoolParentPortalLink: {
        parentName: string
        childName: string
        className: string
        portalUrl: string
    }

    notContinuingNotification: {
        parentName: string
        parentEmail: string
        parentMobile: string
        childName: string
        program: string
    }

    // BIRTHDAY PARTIES
    partyBookingConfirmation: {
        header: string
        openingLine: string
        parentName: string
        childName: string
        childAge: string
        startDate: string
        startTime: string
        endTime: string
        address: string
        location: string
        isMobile: boolean
        contactEmail: string
        contactPhone: string
        contactName?: string
        numberOfKidsAllowed: string[]
        studioPhotoUrl: string
        useRsvpSystem: boolean
        invitationsUrl: string
        includesFood: boolean
        canOrderCake: boolean
        cakeFormUrl: string
    }

    cakeForm: {
        parentName: string
        childName: string
        prefilledFormUrl: string
    }

    partyForm: {
        parentName: string
        childName: string
        childAge: string
        birthdayChildDisplay: string
        startDate: string
        startTime: string
        endTime: string
        address: string
        location: string
        prefilledFormUrl: string
        contactPhone: string
        contactName?: string
        contactSignoff: string
        isMobile: boolean
    }

    partyFormReminder: {
        parentName: string
        childName: string
        contactPhone: string
        contactName?: string
        contactSignoff: string
        prefilledFormUrl: string
    }

    partyFormFoodPackageChanged: {
        parentName: string
        parentEmail: string
        parentMobile: string
        childName: string
        dateTime: string
        oldIncludesFood: boolean
        newIncludesFood: boolean
    }

    partyFormFilledInAgain: {
        parentName: string
        parentEmail: string
        parentMobile: string
        childName: string
        dateTime: string
        oldNumberOfKids: string
        oldCreations: string[]
        oldAdditions: string[]
        newNumberOfKids: string
        newCreations: string[]
        newAdditions: string[]
        oldIncludesFood: boolean
        newIncludesFood: boolean
        isMobile: boolean
        oldCake?: {
            selection: string
            size: string
            flavours: string
            served: string
            candles: string
            message?: string
        }
        newCake?: {
            selection: string
            size: string
            flavours: string
            served: string
            candles: string
            message?: string
        }
        oldTakeHomeBags?: { name: string; quantity: string }[]
        newTakeHomeBags?: { name: string; quantity: string }[]
        oldProducts?: { name: string; quantity: string }[]
        newProducts?: { name: string; quantity: string }[]
    }

    tooManyCreationsChosen: {
        parentName: string
        parentEmail: string
        parentMobile: string
        childName: string
        dateTime: string
        chosenCreations: string[]
    }

    partyFormQuestions: {
        dateTime: string
        location: string
        parentName: string
        childName: string
        questions: string
        parentEmail: string
    }

    partyPackNotification: {
        parentName: string
        dateTime: string
        location: string
        mobile: string
        email: string
        partyPacks: string[]
    }

    takeHomeNotification: {
        parentName: string
        dateTime: string
        location: string
        mobile: string
        email: string
        takeHomeBags?: { name: string; quantity: string }[]
        products?: { name: string; quantity: string }[]
    }

    partyFormConfirmation: {
        parentName: string
        numberOfChildren: string
        creations: string[]
        isTyeDyeParty: boolean
        hasAdditions: boolean
        additions: string[]
        // for parent confirmation, merge take home bags and products
        hasTakeHomeBags: boolean
        takeHomeBags: { name: string; quantity: string }[]
        isMobile: boolean
        hasQuestions: boolean
        contactPhone: string
        contactName?: string
        contactSignoff: string
        includesFood: boolean
        cake?: {
            selection: string
            size: string
            flavours: string
            served: string
            candles: string
            message?: string
        }
    }

    cakeFormConfirmation: {
        parentName: string
        // for parent confirmation, merge take home bags and products
        hasTakeHomeBags: boolean
        takeHomeBags: { name: string; quantity: string }[]
        contactPhone: string
        contactName?: string
        contactSignoff: string
        cake?: {
            selection: string
            size: string
            flavours: string
            served: string
            candles: string
            message?: string
        }
    }

    partyFeedback: {
        parentName: string
        childName: string
        reviewUrl: string
    }

    invitationGuests: {
        name: string
    }

    cakeNotification: {
        parentName: string
        dateTime: string
        studio: string
        mobile: string
        email: string
        cakeSelection: string
        cakeSize: string
        cakeFlavours: string
        cakeServed: string
        cakeCandles: string
        cakeMessage?: string
    }

    takeHomeBagNotification: {
        parentName: string
        dateTime: string
        studio: string
        mobile: string
        email: string
        newTakeHomeBags: { name: string; quantity: string }[]
        hasExistingTakeHomeBags: boolean
        oldTakeHomeBags?: { name: string; quantity: string }[]
    }

    // PARTY RSVPS
    invitationCreated: {
        parentName: string
        invitationLink: string
    }

    rsvpToParty: {
        parentName: string
        children: {
            childName: string
            isAttending: boolean
            allergies?: string
        }[]
        attending: boolean // if any child is attending set this to true
        hostName: string
        hostPhone: string
        date: string
        time: string
        isMobile: boolean
        studio: string
        address: string
    }

    rsvpNotificationToHost: {
        parentName: string
        childrenNames: string
        children: {
            childName: string
            isAttending: boolean
            allergies?: string
        }[]
        birthdayChildName: string
        invitationUrl: string
    }

    // EVENTS
    standardEventBookingConfirmation: {
        contactName: string
        address: string
        slots: { startTime: string; endTime: string }[]
        emailMessage: string
        price: string
    }

    incursionBookingConfirmation: {
        contactName: string
        organisation: string
        address: string
        slots: { startTime: string; endTime: string }[]
        emailMessage: string
        incursion: string
        module: string
        price: string
    }

    incursionForm: {
        contactName: string
        incursionName: string
        organisation: string
        slots: string[]
        formUrl: string
    }

    incursionFormCompletedToCustomer: {
        contactName: string
        slots: string[]
        numberOfChildren: string
        location: string
        parking: string
        expectedLearning: string
        teacherInformation: string
        additionalInformation: string
    }

    incursionFormCompletedToFizz: {
        contactName: string
        contactEmail: string
        contactNumber: string
        organisation: string
        address: string
        studio: string
        eventName: string
        module: string
        incursion: string
        price: string
        slots: string[]
        notes: string
        invoiceUrl?: string
        numberOfChildren: string
        location: string
        parking: string
        expectedLearning: string
        teacherInformation: string
        additionalInformation: string
        hearAboutUs: string
    }

    // ONBOARDING
    onboarding: {
        employeeName: string
        formUrl: string
        senderName: string
    }

    onboardingFormCompletedNotification: {
        employeeName: string
    }

    wwccReminder: {
        employees: string[]
    }

    turning18NextMonthReminder: {
        month: string
        employees: string[]
    }
    minimumShiftLengthReport: {
        periodLabel: string
        studios: {
            studio: string
            shifts: {
                employeeName: string
                positionName: string
                shiftDate: string
                workedLength: string
                minimumLength: string
                notes: string
            }[]
        }[]
    }

    accountInvite: {
        firstname: string
        resetLink: string
    }

    passwordReset: {
        resetLink: string
    }

    // WEBSITE FORMS
    websiteContactFormToCustomer: {
        name: string
        email: string
        contactNumber: string
        service: string
        location?: string
        suburb?: string
        preferredDateAndTime?: string
        school?: string
        organisation?: string
        module?: string
        numberOfSessions?: string
        numberOfStudentsPerSession?: string
        numberOfAttendees?: string
        budget?: string
        enquiry: string
        reference?: string
    }

    websiteContactFormToFizz: {
        name: string
        email: string
        contactNumber: string
        service: string
        location?: string
        suburb?: string
        preferredDateAndTime?: string
        school?: string
        organisation?: string
        module?: string
        numberOfSessions?: string
        numberOfStudentsPerSession?: string
        numberOfAttendees?: string
        budget?: string
        enquiry: string
        reference?: string
    }

    websiteEventFormToCustomer: {
        name: string
        email: string
        contactNumber: string
        organisation: string
        preferredDateAndTime: string
        numberOfAttendees: string
        budget?: string
        enquiry: string
        reference?: string
    }

    websiteEventFormToFizz: {
        name: string
        email: string
        contactNumber: string
        organisation: string
        preferredDateAndTime: string
        numberOfAttendees: string
        budget?: string
        enquiry: string
        reference?: string
    }

    websiteIncurionFormToCustomer: {
        name: string
        school: string
        email: string
        contactNumber: string
        preferredDateAndTime: string
        module: string
        numberOfSessions: string
        numberOfStudentsPerSession: string
        enquiry: string
        reference?: string
    }

    websiteIncurionFormToFizz: {
        name: string
        school: string
        email: string
        contactNumber: string
        preferredDateAndTime: string
        module: string
        numberOfSessions: string
        numberOfStudentsPerSession: string
        enquiry: string
        reference?: string
    }

    websiteCareersFormToCustomer: {
        name: string
        email: string
        contactNumber: string
        role: string
        location: string
        wwcc: string
        driversLicense: string
        resumeUrl: string
        resumeFilename: string
        application: string
        reference: string
    }

    websiteCareersFormToFizz: {
        name: string
        email: string
        contactNumber: string
        role: string
        location: string
        wwcc: string
        driversLicense: string
        resumeUrl: string
        resumeFilename: string
        application: string
        reference: string
    }

    websitePartyFormToCustomer: {
        name: string
        email: string
        contactNumber: string
        location: string
        suburb?: string
        preferredDateAndTime: string
        partyTheme: string
        enquiry: string
        reference: string
    }

    websitePartyFormToFizz: {
        name: string
        email: string
        contactNumber: string
        location: string
        suburb?: string
        preferredDateAndTime: string
        partyTheme: string
        enquiry: string
        reference: string
    }

    websiteFranchisingFormToCustomer: {
        firstName: string
        lastName: string
        email: string
        contactNumber: string
        suburb: string
        state: string
        interest: string
        enquiry: string
        reference: string
    }

    websiteFranchisingFormToFizz: {
        firstName: string
        lastName: string
        email: string
        contactNumber: string
        suburb: string
        state: string
        interest: string
        enquiry: string
        reference: string
    }
}
