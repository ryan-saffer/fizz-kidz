import { birthdayPartyCreation } from './documents/birthday-party-creation'
import { birthdayPartyCreationOffering } from './documents/birthday-party-creation-offering'
import { birthdayPartyPackage } from './documents/birthday-party-package'
import { holidayProgramCreation } from './documents/holiday-program-creation'
import { holidayProgramWeek } from './documents/holiday-program-week'
import { websiteImage } from './documents/website-image'
import { birthdayPartyCreationCard } from './objects/birthday-party-creation-card'
import { birthdayPartyOfferingEntry } from './objects/birthday-party-offering-entry'
import { creationInstructions } from './objects/creation-instructions'
import { externalImage } from './objects/external-image'
import { holidayProgramSession } from './objects/holiday-program-session'

export const schemaTypes = [
    birthdayPartyCreation,
    birthdayPartyCreationOffering,
    birthdayPartyPackage,
    holidayProgramCreation,
    holidayProgramWeek,
    websiteImage,
    creationInstructions,
    birthdayPartyCreationCard,
    birthdayPartyOfferingEntry,
    externalImage,
    holidayProgramSession,
]
