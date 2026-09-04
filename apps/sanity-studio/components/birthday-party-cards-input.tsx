import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url'
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

type CardValue = {
    _key?: string
    alt?: string
    colour?: string
    image?: SanityImageSource
    label?: string[]
}

export function BirthdayPartyCardsInput(props: ArrayOfObjectsInputProps) {
    const client = useClient({ apiVersion: '2026-08-01' })
    const imageUrlBuilder = createImageUrlBuilder(client)
    const cards = Array.isArray(props.value) ? (props.value as CardValue[]) : []

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
                        {cards.map((card, index) => (
                            <Card key={card._key ?? index}>
                                {card.image ? (
                                    <img
                                        alt={card.alt ?? ''}
                                        src={imageUrlBuilder.image(card.image).width(320).auto('format').url()}
                                    />
                                ) : null}
                                <p style={{ color: CARD_COLOURS[card.colour ?? ''] ?? '#0f172a' }}>
                                    {card.label?.filter(Boolean).join(' / ') || 'Image-only card'}
                                </p>
                            </Card>
                        ))}
                    </CardGrid>
                ) : (
                    <p style={{ color: 'white', padding: '16px' }}>Add cards above to preview their order.</p>
                )}
            </Preview>
        </>
    )
}
