import type { BirthdayPartyBookingCatalogue, BirthdayPartyBookingChannel } from '@fizz-kidz/core'
import {
    getActiveBirthdayPartyBookingCreationKeys,
    getActiveBirthdayPartyBookingPackages,
    getBirthdayPartyCreationDisplayName,
} from '@fizz-kidz/core'

export function getBirthdayPartyCreationMenu(
    catalogue: BirthdayPartyBookingCatalogue | undefined,
    channel: BirthdayPartyBookingChannel,
    selectedCreation?: string
) {
    const packages = catalogue ? getActiveBirthdayPartyBookingPackages(catalogue, channel) : []
    const activeCreationKeys = catalogue
        ? getActiveBirthdayPartyBookingCreationKeys(catalogue, channel)
        : new Set<string>()

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
