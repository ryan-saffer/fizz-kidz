import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'
import { useEffect, useMemo, useState } from 'react'
import { type ArrayOfObjectsInputProps, useClient } from 'sanity'
import styled from 'styled-components'

const CARD_COLOURS: Record<string, string> = {
    blue: '#47D2F5',
    green: '#4EE16C',
    pink: '#F24DA2',
    purple: '#8F44E1',
    red: '#FF3130',
    white: '#FFFFFF',
    yellow: '#F6BA33',
}

const Preview = styled.section`
    background: #111827;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    margin-top: 24px;
    overflow: hidden;
`

const PreviewHeader = styled.header`
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 12px 16px;

    h3 {
        color: #0f172a;
        font-size: 14px;
        margin: 0;
    }

    p {
        color: #64748b;
        font-size: 12px;
        margin: 4px 0 0;
    }
`

const CardGrid = styled.div`
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    padding: 24px;
`

const Card = styled.article`
    align-items: center;
    background: white;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    min-height: 180px;
    padding: 12px;

    img {
        aspect-ratio: 1;
        height: 140px;
        object-fit: contain;
        width: 100%;
    }

    p {
        font-size: 18px;
        font-weight: 700;
        margin: 8px 0 0;
        text-align: center;
    }
`

const BookingChannels = styled.span`
    color: #64748b;
    font-size: 12px;
    margin-top: 4px;
`

type CreationPreview = {
    _id: string
    image?: SanityImageSource
    name?: string
}

type CardValue = {
    _key?: string
    alt?: string
    bookingChannels?: string[]
    bookingOrder?: number
    colour?: string
    creation?: { _ref?: string }
    hideLabel?: boolean
    image?: SanityImageSource
    label?: string[]
    offering?: { _ref?: string }
}

function publishedId(documentId: string) {
    return documentId.replace(/^drafts\./, '')
}

export function BirthdayPartyCardsInput(props: ArrayOfObjectsInputProps) {
    const client = useClient({ apiVersion: '2026-08-01' })
    const imageUrlBuilder = createImageUrlBuilder(client)
    const cards = Array.isArray(props.value) ? (props.value as CardValue[]) : []
    const creationIdsKey = useMemo(() => {
        const currentCards = Array.isArray(props.value) ? (props.value as CardValue[]) : []
        return Array.from(
            new Set(
                currentCards.flatMap((card) => {
                    const reference = card.creation?._ref ?? card.offering?._ref
                    return reference ? [publishedId(reference)] : []
                })
            )
        )
            .sort()
            .join(',')
    }, [props.value])
    const [creationsById, setCreationsById] = useState<Map<string, CreationPreview>>(new Map())

    useEffect(() => {
        let cancelled = false
        const creationIds = creationIdsKey ? creationIdsKey.split(',') : []

        if (creationIds.length === 0) {
            setCreationsById(new Map())
            return
        }

        const ids = creationIds.flatMap((id) => [id, `drafts.${id}`])
        void client
            .fetch<CreationPreview[]>(
                `*[_type == "birthdayPartyCreationOffering" && _id in $ids]{_id, image, name}`,
                { ids },
                { perspective: 'raw' }
            )
            .then((creations) => {
                if (cancelled) return

                const next = new Map<string, CreationPreview>()
                for (const creation of creations.sort(
                    (left, right) => Number(left._id.startsWith('drafts.')) - Number(right._id.startsWith('drafts.'))
                )) {
                    next.set(publishedId(creation._id), creation)
                }
                setCreationsById(next)
            })

        return () => {
            cancelled = true
        }
    }, [client, creationIdsKey])

    return (
        <>
            {props.renderDefault(props)}
            <Preview>
                <PreviewHeader>
                    <h3>Website card-order preview</h3>
                    <p>This preview follows the card order above. The public Website applies its responsive layout.</p>
                </PreviewHeader>
                {cards.length > 0 ? (
                    <CardGrid>
                        {cards.map((card, index) => {
                            const reference = card.creation?._ref ?? card.offering?._ref
                            const creation = reference ? creationsById.get(publishedId(reference)) : undefined
                            const image = card.image ?? creation?.image
                            const label = card.hideLabel
                                ? 'Image-only card'
                                : card.label?.filter(Boolean).join(' / ') || creation?.name || 'Untitled card'

                            return (
                                <Card key={card._key ?? index}>
                                    {image ? (
                                        <img
                                            alt={card.alt ?? creation?.name ?? ''}
                                            src={imageUrlBuilder.image(image).width(320).auto('format').url()}
                                        />
                                    ) : null}
                                    <p style={{ color: CARD_COLOURS[card.colour ?? ''] ?? '#0f172a' }}>{label}</p>
                                    <BookingChannels>
                                        {card.bookingChannels?.length
                                            ? `Booking choice ${card.bookingOrder ?? '?'}: ${card.bookingChannels.join(' + ')}`
                                            : 'Additional display card'}
                                    </BookingChannels>
                                </Card>
                            )
                        })}
                    </CardGrid>
                ) : (
                    <p style={{ color: 'white', padding: '16px' }}>Add cards above to preview their order.</p>
                )}
            </Preview>
        </>
    )
}
