import { publishedId, ReferenceBacklinks } from './reference-backlinks'

import type { ObjectInputProps } from 'sanity'

const REFERENCING_PACKAGES_QUERY = `
    *[
        _type == "birthdayPartyPackage" &&
        count(websiteCards[creation._ref in [$publishedId, $draftId]]) > 0
    ]{
        _id,
        key,
        status,
        "sortOrder": position,
        "title": packageName
    }
`

type CreationDocument = {
    _id?: string
}

export function BirthdayPartyCreationOfferingInput(props: ObjectInputProps) {
    const documentId = (props.value as CreationDocument | undefined)?._id

    return (
        <>
            {props.renderDefault(props)}
            <ReferenceBacklinks
                description="This list is derived automatically. Edit a package’s Website cards to change it."
                documentId={documentId ? publishedId(documentId) : undefined}
                emptyMessage="No packages currently contain this creation."
                errorMessage="Packages could not be loaded. Refresh the page to try again."
                fallbackLabel="Package"
                heading="Used in packages"
                query={REFERENCING_PACKAGES_QUERY}
                targetType="birthdayPartyPackage"
            />
        </>
    )
}
