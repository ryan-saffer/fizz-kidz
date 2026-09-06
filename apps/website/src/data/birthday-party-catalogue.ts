import { getBirthdayPartyPackagePartyName } from '@fizz-kidz/core'

import { sanityClient } from '@/utils/sanity-api-client'

export const birthdayPartyCatalogue = await sanityClient.getBirthdayPartyCatalogue()

export const birthdayPartyPackageNavigationLinks = birthdayPartyCatalogue.packages
    .toSorted((left, right) => left.position - right.position)
    .map((partyPackage) => ({
        isNew: partyPackage.websitePage.navigation.isNew,
        path: getBirthdayPartyPackagePath(partyPackage.websitePage.slug),
        title: getBirthdayPartyPackagePartyName(partyPackage.name),
        type: 'link' as const,
    }))

export const birthdayPartyThemePackages = birthdayPartyCatalogue.packages.toSorted(
    (left, right) => left.position - right.position
)

export function getBirthdayPartyPackagePath(slug: string) {
    return `/birthday-parties/${slug}/`
}

export function getBirthdayPartyCataloguePackage(key: string) {
    const partyPackage = birthdayPartyCatalogue.packages.find((item) => item.key === key)
    if (!partyPackage) throw new Error(`Missing active Sanity birthday party package: ${key}`)
    return partyPackage
}

export function getBirthdayPartyPackageStaticPaths() {
    return birthdayPartyCatalogue.packages.map((partyPackage) => ({
        params: { slug: partyPackage.websitePage.slug },
        props: { partyPackage },
    }))
}
