import { createImageUrlBuilder } from '@sanity/image-url'
import { useClient } from 'sanity'

import type { CreationInstructionImage, CreationInstructionsContent } from '@fizz-kidz/core'
import { CreationInstructions } from '@fizz-kidz/ui'

export function CreationInstructionsPreview({ value }: { value: CreationInstructionsContent }) {
    const client = useClient({ apiVersion: '2026-08-01' })
    const imageUrlBuilder = createImageUrlBuilder(client)
    const resolvedValue = value.map((block) => {
        if (block._type !== 'image') return block

        const image = block as CreationInstructionImage
        if (image.url || !image.asset?._ref) return image

        return {
            ...image,
            url: imageUrlBuilder.image(image).width(500).fit('max').auto('format').url(),
        } satisfies CreationInstructionImage
    })

    return <CreationInstructions value={resolvedValue} />
}
