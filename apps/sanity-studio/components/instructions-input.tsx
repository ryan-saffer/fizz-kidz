import { useEffect, useRef } from 'react'
import styled from 'styled-components'

import type { CreationInstructionsContent } from '@fizz-kidz/core'

import { CreationInstructionsPreview } from './creation-instructions-preview'

import type { ArrayOfObjectsInputProps } from 'sanity'

const Layout = styled.div`
    display: grid;
    gap: 24px;

    @media (min-width: 1440px) {
        align-items: start;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        left: 50%;
        position: relative;
        transform: translateX(-50%);
        width: 1100px;
    }
`

const Editor = styled.div`
    min-width: 0;

    [data-testid='pt-editor'][data-fullscreen='false'] {
        height: max(32rem, calc(100vh - 12rem));
    }
`

const Preview = styled.section`
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    margin-top: 24px;
    overflow: hidden;

    @media (min-width: 1440px) {
        margin-top: 0;
        position: sticky;
        top: 16px;
    }
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
    max-height: calc(100vh - 160px);
    overflow-y: auto;
    padding: 16px;
`

export function InstructionsInput(props: ArrayOfObjectsInputProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const previewRef = useRef<HTMLDivElement>(null)
    const value = Array.isArray(props.value) ? (props.value as CreationInstructionsContent) : []

    useEffect(() => {
        const editor = editorRef.current
        if (!editor) return

        let animationFrame = 0
        const syncPreviewScroll = (event: Event) => {
            if (!window.matchMedia('(min-width: 1440px)').matches) return

            const scrollContainer = event.target
            const preview = previewRef.current
            if (!(scrollContainer instanceof HTMLElement) || !preview) return

            const editorRoot = editor.querySelector<HTMLElement>("[data-testid='pt-editor']")
            const editorScrollRange = scrollContainer.scrollHeight - scrollContainer.clientHeight
            if (!editorRoot?.contains(scrollContainer) || editorScrollRange <= 0) return

            cancelAnimationFrame(animationFrame)
            animationFrame = requestAnimationFrame(() => {
                const previewScrollRange = preview.scrollHeight - preview.clientHeight
                preview.scrollTop = (scrollContainer.scrollTop / editorScrollRange) * previewScrollRange
            })
        }

        editor.addEventListener('scroll', syncPreviewScroll, true)
        return () => {
            cancelAnimationFrame(animationFrame)
            editor.removeEventListener('scroll', syncPreviewScroll, true)
        }
    }, [])

    return (
        <Layout>
            <Editor ref={editorRef}>{props.renderDefault({ ...props, initialActive: true })}</Editor>
            <Preview>
                <PreviewHeader>
                    <h3>Portal preview</h3>
                    <p>This updates as you edit and follows the editor scroll on wide screens.</p>
                </PreviewHeader>
                <PreviewBody ref={previewRef}>
                    {value.length > 0 ? (
                        <CreationInstructionsPreview value={value} />
                    ) : (
                        <p>Add instructions above to see the Portal preview.</p>
                    )}
                </PreviewBody>
            </Preview>
        </Layout>
    )
}
