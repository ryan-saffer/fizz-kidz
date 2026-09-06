import { publishedId, ReferenceBacklinks } from './reference-backlinks'

import type { ObjectInputProps } from 'sanity'

const REFERENCING_CREATIONS_QUERY = `
    *[
        _type == "birthdayPartyCreationOffering" &&
        recipe._ref in [$publishedId, $draftId]
    ]{
        _id,
        key,
        status,
        "title": name
    }
`

type InstructionDocument = {
    _id?: string
}

export function BirthdayPartyCreationInput(props: ObjectInputProps) {
    const documentId = (props.value as InstructionDocument | undefined)?._id

    return (
        <>
            {props.renderDefault(props)}
            <ReferenceBacklinks
                description="This list is derived automatically. Edit a creation’s instructions reference to change it."
                documentId={documentId ? publishedId(documentId) : undefined}
                emptyMessage="No creations currently reference these instructions."
                errorMessage="Creations could not be loaded. Refresh the page to try again."
                fallbackLabel="Creation"
                heading="Referenced by creations"
                query={REFERENCING_CREATIONS_QUERY}
                targetType="birthdayPartyCreationOffering"
            />
        </>
    )
}
