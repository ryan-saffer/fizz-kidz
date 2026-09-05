import type { BirthdayPartyBookingCatalogue, BirthdayPartyBookingChannel } from '@fizz-kidz/core'
import {
    getActiveBirthdayPartyBookingCreationKeys,
    getActiveBirthdayPartyBookingPackages,
    getBirthdayPartyCreationDisplayName,
} from '@fizz-kidz/core'

export function getBirthdayPartyCreationMenu(
    catalogue: BirthdayPartyBookingCatalogue,
    channel: BirthdayPartyBookingChannel,
    selectedCreation?: string
) {
    const packages = getActiveBirthdayPartyBookingPackages(catalogue, channel)
    const activeCreationKeys = getActiveBirthdayPartyBookingCreationKeys(catalogue, channel)

    return {
        packages,
        previouslySelected:
            selectedCreation && !activeCreationKeys.has(selectedCreation)
                ? {
                      key: selectedCreation,
                      name: getBirthdayPartyCreationDisplayName(selectedCreation, catalogue),
                  }
                : undefined,
    }
}
