import styled from 'styled-components'

import type { CreationInstructionsContent } from '@fizz-kidz/core'

import { CreationInstructionsPreview } from './creation-instructions-preview'

import type { ArrayOfObjectsInputProps } from 'sanity'

const Preview = styled.section`
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
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

const PreviewBody = styled.div`
    padding: 16px;
`

export function InstructionsInput(props: ArrayOfObjectsInputProps) {
    const value = Array.isArray(props.value) ? (props.value as CreationInstructionsContent) : []

    return (
        <>
            {props.renderDefault(props)}
            <Preview>
                <PreviewHeader>
                    <h3>Portal preview</h3>
                    <p>This updates as you edit and matches the current Portal instruction styling.</p>
                </PreviewHeader>
                <PreviewBody>
                    {value.length > 0 ? (
                        <CreationInstructionsPreview value={value} />
                    ) : (
                        <p>Add instructions above to see the Portal preview.</p>
                    )}
                </PreviewBody>
            </Preview>
        </>
    )
}
