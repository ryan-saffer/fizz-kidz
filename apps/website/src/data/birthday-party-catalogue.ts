import { sanityClient } from '@/utils/sanity-api-client'

export const birthdayPartyCatalogue = await sanityClient.getBirthdayPartyCatalogue()

export const birthdayPartyPackageNavigationLinks = birthdayPartyCatalogue.packages
    .toSorted((left, right) => left.websitePage.navigation.order - right.websitePage.navigation.order)
    .map((partyPackage) => ({
        isNew: partyPackage.websitePage.navigation.isNew,
        path: getBirthdayPartyPackagePath(partyPackage.websitePage.slug),
        title: partyPackage.websitePage.navigation.title,
        type: 'link' as const,
    }))

export const birthdayPartyThemePackages = birthdayPartyCatalogue.packages.toSorted(
    (left, right) => left.websitePage.themeCard.order - right.websitePage.themeCard.order
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
