import { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useValidationStatus } from 'sanity'
import { IntentLink } from 'sanity/router'
import styled from 'styled-components'

import type { UserComponent } from 'sanity/structure'

const API_VERSION = '2026-08-01'
const PACKAGE_TYPE = 'birthdayPartyPackage'
const PACKAGE_DOCUMENTS_QUERY = `*[
    _type == "birthdayPartyPackage" &&
    !(_id in path("versions.**"))
]{
    _id,
    _rev,
    packageName,
    position,
    status,
    "hasFeatureList": defined(websitePage.features)
}`

type PackageDocument = {
    _id: string
    _rev: string
    hasFeatureList?: boolean
    packageName?: string
    position?: number
    status?: string
}

type PackageValidation = {
    errors: string[]
    isValidating: boolean
    revision?: string
}

const Page = styled.main`
    box-sizing: border-box;
    margin: 0 auto;
    max-width: 960px;
    padding: 32px;
`

const Panel = styled.section`
    background: var(--card-bg-color);
    border: 1px solid var(--card-border-color);
    border-radius: 8px;
    padding: 24px;

    h1,
    h2,
    p {
        margin-top: 0;
    }
`

const PackageList = styled.ol`
    display: grid;
    gap: 8px;
    list-style: none;
    margin: 20px 0;
    padding: 0;
`

const PackageRow = styled.li`
    align-items: center;
    background: var(--card-code-bg-color);
    border: 1px solid var(--card-border-color);
    border-radius: 6px;
    display: grid;
    gap: 12px;
    grid-template-columns: 90px minmax(180px, 1fr) auto;
    padding: 12px;

    select {
        background: var(--card-bg-color);
        border: 1px solid var(--card-border-color);
        border-radius: 4px;
        color: inherit;
        min-height: 36px;
        padding: 6px;
        width: 100%;
    }
`

const PackageDetails = styled.div`
    min-width: 0;

    strong,
    span {
        display: block;
    }

    span {
        color: var(--card-muted-fg-color);
        font-size: 12px;
        margin-top: 3px;
    }
`

const EditLink = styled(IntentLink)`
    border: 1px solid var(--card-border-color);
    border-radius: 4px;
    color: inherit;
    padding: 8px 12px;
    text-decoration: none;

    &:hover {
        background: var(--card-badge-default-bg-color);
    }
`

const Actions = styled.div`
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
`

const Button = styled.button`
    background: #2276fc;
    border: 0;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    min-height: 40px;
    padding: 10px 16px;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`

const PublishButton = styled(Button)`
    background: #15803d;
`

const SecondaryButton = styled(Button)`
    background: transparent;
    border: 1px solid var(--card-border-color);
    color: inherit;
`

const Message = styled.p`
    background: var(--card-code-bg-color);
    border-radius: 4px;
    margin: 16px 0 0;
    padding: 12px;
    white-space: pre-line;
`

const DraftList = styled.ul`
    display: grid;
    gap: 8px;
    list-style: none;
    margin: 12px 0 20px;
    padding: 0;

    li {
        align-items: start;
        display: flex;
        gap: 8px;
        justify-content: space-between;
    }

    span {
        color: var(--card-muted-fg-color);
        font-size: 12px;
        text-align: right;
    }
`

function publishedId(documentId: string) {
    return documentId.replace(/^drafts\./, '')
}

function preferDrafts(documents: PackageDocument[]) {
    const documentsById = new Map<string, PackageDocument>()
    for (const document of documents.sort(
        (left, right) => Number(left._id.startsWith('drafts.')) - Number(right._id.startsWith('drafts.'))
    )) {
        documentsById.set(publishedId(document._id), document)
    }
    return Array.from(documentsById.values())
}

function orderPackages(documents: PackageDocument[]) {
    return documents
        .filter((document) => document.status !== 'retired')
        .sort((left, right) => {
            const leftPosition = Number.isFinite(left.position) ? left.position! : Number.POSITIVE_INFINITY
            const rightPosition = Number.isFinite(right.position) ? right.position! : Number.POSITIVE_INFINITY
            const leftStaffOnly = left.status === 'active' ? 0 : 1
            const rightStaffOnly = right.status === 'active' ? 0 : 1
            return (
                leftPosition - rightPosition ||
                leftStaffOnly - rightStaffOnly ||
                (left.packageName ?? '').localeCompare(right.packageName ?? '')
            )
        })
}

function PackageDraftValidation({
    document,
    onChange,
}: {
    document: PackageDocument
    onChange: (documentId: string, validation: PackageValidation) => void
}) {
    const status = useValidationStatus(document._id, PACKAGE_TYPE, true)
    const errors = status.validation.filter((marker) => marker.level === 'error').map((marker) => marker.message)
    const errorsKey = errors.join('\n')

    useEffect(() => {
        onChange(document._id, {
            errors,
            isValidating: status.isValidating,
            revision: status.revision,
        })
    }, [document._id, errorsKey, onChange, status.isValidating, status.revision])

    if (status.isValidating) return <span>Checking…</span>
    if (errors.length > 0) return <span>{errors.length} validation error(s)</span>
    return <span>Ready to publish</span>
}

export const BirthdayPartyPackageManager: UserComponent = () => {
    const client = useClient({ apiVersion: API_VERSION })
    const [packages, setPackages] = useState<PackageDocument[]>([])
    const [drafts, setDrafts] = useState<PackageDocument[]>([])
    const [validationByDraft, setValidationByDraft] = useState<Record<string, PackageValidation>>({})
    const [isLoading, setIsLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    const loadPackages = useCallback(async () => {
        const documents = await client.fetch<PackageDocument[]>(PACKAGE_DOCUMENTS_QUERY, {}, { perspective: 'raw' })
        setPackages(orderPackages(preferDrafts(documents)))
        setDrafts(documents.filter((document) => document._id.startsWith('drafts.')))
        setValidationByDraft({})
        setIsLoading(false)
    }, [client])

    useEffect(() => {
        void loadPackages().catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : 'Unable to load packages.')
            setIsLoading(false)
        })
    }, [loadPackages])

    const orderHasChanges = packages.some((document, index) => document.position !== index + 1)
    const validationsReady = drafts.every((draft) => {
        const validation = validationByDraft[draft._id]
        return validation && !validation.isValidating && (!validation.revision || validation.revision === draft._rev)
    })
    const validationErrors = useMemo(
        () =>
            drafts.flatMap((draft) =>
                (validationByDraft[draft._id]?.errors ?? []).map(
                    (error) => `${draft.packageName ?? 'Untitled package'}: ${error}`
                )
            ),
        [drafts, validationByDraft]
    )

    const updateValidation = useCallback((documentId: string, validation: PackageValidation) => {
        setValidationByDraft((current) => ({ ...current, [documentId]: validation }))
    }, [])

    function movePackage(fromIndex: number, toIndex: number) {
        setPackages((current) => {
            const next = [...current]
            const [moved] = next.splice(fromIndex, 1)
            next.splice(toIndex, 0, moved)
            return next
        })
        setMessage('Order changed locally. Save the order to update the package drafts.')
    }

    async function saveOrder() {
        const changes = packages.flatMap((document, index) =>
            document.position === index + 1
                ? []
                : [
                      {
                          actionType: 'sanity.action.document.edit' as const,
                          draftId: `drafts.${publishedId(document._id)}`,
                          patch: { set: { position: index + 1 } },
                          publishedId: publishedId(document._id),
                      },
                  ]
        )
        if (changes.length === 0) {
            setMessage('The package order is already saved.')
            return
        }

        try {
            setBusy(true)
            setMessage(`Saving ${changes.length} package positions as drafts…`)
            await client.action(changes, { tag: 'birthday-party-packages.reorder' })
            await loadPackages()
            setMessage(`Saved ${changes.length} package positions. Review the drafts, then publish them together.`)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to save the package order.')
        } finally {
            setBusy(false)
        }
    }

    async function publishAllDrafts() {
        if (orderHasChanges) {
            setMessage('Save the package order before publishing.')
            return
        }
        if (!validationsReady || validationErrors.length > 0 || drafts.length === 0) return

        const confirmed = window.confirm(
            `Publish all ${drafts.length} Birthday Party package drafts together? This updates production content immediately.`
        )
        if (!confirmed) return

        try {
            setBusy(true)
            setMessage('Checking package drafts have not changed…')
            const latestDrafts = await client.fetch<PackageDocument[]>(
                `*[_type == "birthdayPartyPackage" && _id in path("drafts.**")]{_id,_rev,packageName}`,
                {},
                { perspective: 'raw' }
            )
            const expectedRevisions = new Map(drafts.map((draft) => [draft._id, draft._rev]))
            const draftsChanged =
                latestDrafts.length !== drafts.length ||
                latestDrafts.some((draft) => expectedRevisions.get(draft._id) !== draft._rev)
            if (draftsChanged) {
                await loadPackages()
                throw new Error('A package draft changed while publishing. Review the refreshed list and try again.')
            }

            setMessage(`Publishing ${drafts.length} package drafts…`)
            await client.action(
                drafts.flatMap((draft) => [
                    ...(draft.status === 'active' && !draft.hasFeatureList
                        ? [
                              {
                                  actionType: 'sanity.action.document.edit' as const,
                                  draftId: draft._id,
                                  patch: { set: { 'websitePage.features': [] } },
                                  publishedId: publishedId(draft._id),
                              },
                          ]
                        : []),
                    {
                        actionType: 'sanity.action.document.publish' as const,
                        draftId: draft._id,
                        publishedId: publishedId(draft._id),
                    },
                ]),
                { tag: 'birthday-party-packages.publish-all' }
            )
            await loadPackages()
            setMessage(`Published all ${drafts.length} package drafts together.`)
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to publish package drafts.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Page>
            <Panel>
                <h1>Reorder and publish packages</h1>
                <p>
                    Choose a position to move a package. Saving renumbers every affected package as drafts in one
                    operation, so you do not need to publish packages from the bottom up.
                </p>
                {isLoading ? <p>Loading packages…</p> : null}
                {!isLoading ? (
                    <PackageList>
                        {packages.map((document, index) => (
                            <PackageRow key={publishedId(document._id)}>
                                <label>
                                    <span>Position</span>
                                    <select
                                        aria-label={`Position for ${document.packageName ?? 'untitled package'}`}
                                        value={index + 1}
                                        disabled={busy}
                                        onChange={(event) => movePackage(index, Number(event.currentTarget.value) - 1)}
                                    >
                                        {packages.map((_, optionIndex) => (
                                            <option key={optionIndex} value={optionIndex + 1}>
                                                {optionIndex + 1}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <PackageDetails>
                                    <strong>{document.packageName ?? 'Untitled package'}</strong>
                                    <span>
                                        {document.status === 'active'
                                            ? 'Active catalogue package'
                                            : 'Staff-only package'}
                                        {document._id.startsWith('drafts.') ? ' · Has draft' : ''}
                                    </span>
                                </PackageDetails>
                                <EditLink intent="edit" params={{ id: publishedId(document._id), type: PACKAGE_TYPE }}>
                                    Edit
                                </EditLink>
                            </PackageRow>
                        ))}
                    </PackageList>
                ) : null}
                <Actions>
                    <Button disabled={busy || isLoading || !orderHasChanges} onClick={saveOrder}>
                        Save package order
                    </Button>
                    <SecondaryButton disabled={busy} onClick={() => void loadPackages()}>
                        Refresh
                    </SecondaryButton>
                </Actions>

                <h2>Package drafts ({drafts.length})</h2>
                {drafts.length > 0 ? (
                    <DraftList>
                        {drafts.map((draft) => (
                            <li key={`${draft._id}:${draft._rev}`}>
                                <EditLink intent="edit" params={{ id: publishedId(draft._id), type: PACKAGE_TYPE }}>
                                    {draft.packageName ?? 'Untitled package'}
                                </EditLink>
                                <PackageDraftValidation document={draft} onChange={updateValidation} />
                            </li>
                        ))}
                    </DraftList>
                ) : (
                    <p>There are no package drafts to publish.</p>
                )}
                {validationErrors.length > 0 ? (
                    <Message>
                        Fix these errors before publishing:
                        <br />
                        {validationErrors.join('\n')}
                    </Message>
                ) : null}
                <PublishButton
                    disabled={
                        busy ||
                        isLoading ||
                        orderHasChanges ||
                        drafts.length === 0 ||
                        !validationsReady ||
                        validationErrors.length > 0
                    }
                    onClick={publishAllDrafts}
                >
                    Publish all package drafts
                </PublishButton>
                {message ? <Message>{message}</Message> : null}
            </Panel>
        </Page>
    )
}
