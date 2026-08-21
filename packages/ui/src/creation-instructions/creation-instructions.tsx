import { PortableText, type PortableTextComponents } from '@portabletext/react'

import type {
    CreationInstructionExternalImage,
    CreationInstructionImage,
    CreationInstructionsContent,
} from '@fizz-kidz/core'

import './creation-instructions.css'

function InstructionImage({ value }: { value: CreationInstructionImage | CreationInstructionExternalImage }) {
    if (!value.url) return null
    return <img src={value.url} alt={value.alt || ''} />
}

const components: PortableTextComponents<CreationInstructionsContent[number]> = {
    block: {
        h2: ({ children }) => <h2>{children}</h2>,
        h3: ({ children }) => <h3>{children}</h3>,
        normal: ({ children }) => <p>{children}</p>,
        blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    },
    list: {
        bullet: ({ children }) => <ul>{children}</ul>,
        number: ({ children }) => <ol>{children}</ol>,
    },
    marks: {
        em: ({ children }) => <em>{children}</em>,
        link: ({ children, value }) => (
            <a href={value?.href} target="_blank" rel="noreferrer">
                {children}
            </a>
        ),
        strong: ({ children }) => <strong>{children}</strong>,
    },
    types: {
        divider: () => <hr />,
        externalImage: InstructionImage,
        image: InstructionImage,
    },
}

export function CreationInstructions({ value }: { value: CreationInstructionsContent }) {
    return (
        <div className="fizz-creation-instructions">
            <PortableText value={value} components={components} />
        </div>
    )
}
