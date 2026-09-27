import type { BirthdayPartyBookingCatalogue, BirthdayPartyBookingChannel } from '@fizz-kidz/core'
import {
    getActiveBirthdayPartyBookingCreationKeys,
    getActiveBirthdayPartyBookingPackages,
    getBirthdayPartyCreationDisplayName,
} from '@fizz-kidz/core'

/**
 * The creations staff can pick, grouped by package. A creation offered in several packages is listed once, under the
 * first, so each choice in the menu is unique.
 */
export function getBirthdayPartyCreationMenu(
    catalogue: BirthdayPartyBookingCatalogue | undefined,
    channel: BirthdayPartyBookingChannel,
    selectedCreation?: string
) {
    const listed = new Set<string>()
    const packages = (catalogue ? getActiveBirthdayPartyBookingPackages(catalogue, channel) : [])
        .map((partyPackage) => ({
            ...partyPackage,
            creations: partyPackage.creations.filter((creation) => {
                if (listed.has(creation.key)) return false
                listed.add(creation.key)
                return true
            }),
        }))
        .filter((partyPackage) => partyPackage.creations.length > 0)
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
