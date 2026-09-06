import { useEffect, useState } from 'react'
import { useClient } from 'sanity'
import { IntentLink } from 'sanity/router'
import styled from 'styled-components'

const API_VERSION = '2026-08-01'

const Backlinks = styled.section`
    border: 1px solid var(--card-border-color);
    border-radius: 6px;
    margin-top: 24px;
    padding: 20px;

    h2 {
        font-size: 16px;
        margin: 0;
    }

    p {
        color: var(--card-muted-fg-color);
        font-size: 13px;
        line-height: 1.5;
        margin: 8px 0 0;
    }

    ul {
        display: grid;
        gap: 8px;
        list-style: none;
        margin: 16px 0 0;
        padding: 0;
    }
`

const Backlink = styled(IntentLink)`
    background: var(--card-code-bg-color);
    border-radius: 4px;
    color: inherit;
    display: block;
    padding: 12px;
    text-decoration: none;

    &:hover {
        background: var(--card-badge-default-bg-color);
    }

    strong {
        display: block;
        font-size: 14px;
    }

    span {
        color: var(--card-muted-fg-color);
        display: block;
        font-size: 12px;
        margin-top: 4px;
    }
`

type BacklinkDocument = {
    _id: string
    key?: string
    sortOrder?: number
    status?: string
    title?: string
}

type ReferenceBacklinksProps = {
    description: string
    documentId?: string
    emptyMessage: string
    errorMessage: string
    fallbackLabel: string
    heading: string
    query: string
    targetType: string
}

export function publishedId(documentId: string) {
    return documentId.replace(/^drafts\./, '')
}

function preferDrafts(documents: BacklinkDocument[]) {
    const byId = new Map<string, BacklinkDocument>()

    for (const document of documents.sort(
        (left, right) => Number(left._id.startsWith('drafts.')) - Number(right._id.startsWith('drafts.'))
    )) {
        byId.set(publishedId(document._id), document)
    }

    return Array.from(byId.values()).sort((left, right) => {
        const leftOrder = Number.isFinite(left.sortOrder) ? left.sortOrder! : Number.POSITIVE_INFINITY
        const rightOrder = Number.isFinite(right.sortOrder) ? right.sortOrder! : Number.POSITIVE_INFINITY
        return leftOrder - rightOrder || (left.title ?? '').localeCompare(right.title ?? '')
    })
}

export function ReferenceBacklinks({
    description,
    documentId,
    emptyMessage,
    errorMessage,
    fallbackLabel,
    heading,
    query,
    targetType,
}: ReferenceBacklinksProps) {
    const client = useClient({ apiVersion: API_VERSION })
    const targetId = documentId ? publishedId(documentId) : undefined
    const [documents, setDocuments] = useState<BacklinkDocument[]>([])
    const [isLoading, setIsLoading] = useState(Boolean(targetId))
    const [hasError, setHasError] = useState(false)

    useEffect(() => {
        if (!targetId) {
            setDocuments([])
            setIsLoading(false)
            return
        }

        let cancelled = false
        const params = { draftId: `drafts.${targetId}`, publishedId: targetId }
        const loadDocuments = () => {
            void client
                .fetch<BacklinkDocument[]>(query, params, { perspective: 'raw' })
                .then((results) => {
                    if (cancelled) return
                    setDocuments(preferDrafts(results))
                    setHasError(false)
                    setIsLoading(false)
                })
                .catch(() => {
                    if (cancelled) return
                    setHasError(true)
                    setIsLoading(false)
                })
        }

        loadDocuments()
        const subscription = client.listen(query, params, { includeResult: false }).subscribe({
            next: loadDocuments,
            error: () => {
                if (!cancelled) setHasError(true)
            },
        })

        return () => {
            cancelled = true
            subscription.unsubscribe()
        }
    }, [client, query, targetId])

    return (
        <Backlinks>
            <h2>
                {heading}
                {documents.length > 0 ? ` (${documents.length})` : ''}
            </h2>
            <p>{description}</p>
            {isLoading ? <p>Loading…</p> : null}
            {hasError ? <p>{errorMessage}</p> : null}
            {!isLoading && !hasError && documents.length === 0 ? <p>{emptyMessage}</p> : null}
            {documents.length > 0 ? (
                <ul>
                    {documents.map((document) => (
                        <li key={publishedId(document._id)}>
                            <Backlink intent="edit" params={{ id: publishedId(document._id), type: targetType }}>
                                <strong>{document.title || `Untitled ${fallbackLabel.toLocaleLowerCase()}`}</strong>
                                <span>
                                    {[document.key, document.status === 'retired' ? 'Retired' : undefined]
                                        .filter(Boolean)
                                        .join(' · ') || fallbackLabel}
                                </span>
                            </Backlink>
                        </li>
                    ))}
                </ul>
            ) : null}
        </Backlinks>
    )
}
