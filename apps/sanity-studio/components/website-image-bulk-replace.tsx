import { useEffect, useRef, useState } from 'react'
import { useClient } from 'sanity'
import styled from 'styled-components'

import { WEBSITE_IMAGE_CATEGORIES } from '../website-image-categories'

import type { UserComponent } from 'sanity/structure'

type WebsiteImageSlot = {
    _id: string
    filename: string
    imageUrl: string
    title: string
}

type StagedWebsiteImage = {
    bulkReplacementId: string
    imageUrl: string
    publishedId: string
}

const Page = styled.main`
    box-sizing: border-box;
    margin: 0 auto;
    max-width: 1200px;
    padding: 32px;
`

const Panel = styled.section`
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 24px;
`

const Controls = styled.div`
    align-items: end;
    display: grid;
    gap: 16px;
    grid-template-columns: minmax(220px, 1fr) minmax(280px, 2fr);
    margin: 24px 0;

    label {
        display: grid;
        font-size: 13px;
        font-weight: 600;
        gap: 8px;
    }

    input,
    select {
        border: 1px solid #9ca3af;
        border-radius: 4px;
        box-sizing: border-box;
        min-height: 40px;
        padding: 8px;
        width: 100%;
    }
`

const Summary = styled.div`
    background: #f8fafc;
    border-radius: 6px;
    display: grid;
    gap: 8px;
    margin-bottom: 24px;
    padding: 16px;

    p {
        margin: 0;
    }
`

const ReplaceButton = styled.button`
    background: #2276fc;
    border: 0;
    border-radius: 4px;
    color: white;
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    margin-bottom: 24px;
    padding: 12px 18px;

    &:disabled {
        cursor: not-allowed;
        opacity: 0.5;
    }
`

const PublishButton = styled(ReplaceButton)`
    background: #15803d;
    margin-left: 12px;
`

const Grid = styled.div`
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
`

const ImageCard = styled.article`
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;

    img {
        aspect-ratio: 1;
        display: block;
        object-fit: cover;
        width: 100%;
    }

    p {
        font-size: 12px;
        margin: 0;
        padding: 10px;
    }
`

function normalizeFilename(filename: string) {
    return filename.trim().toLowerCase()
}

export const WebsiteImageBulkReplace: UserComponent = () => {
    const client = useClient({ apiVersion: '2026-08-01' })
    const fileInput = useRef<HTMLInputElement>(null)
    const [category, setCategory] = useState<string>('Creations')
    const [files, setFiles] = useState<File[]>([])
    const [slots, setSlots] = useState<WebsiteImageSlot[]>([])
    const [stagedImages, setStagedImages] = useState<StagedWebsiteImage[]>([])
    const [status, setStatus] = useState('')
    const [busy, setBusy] = useState(false)

    async function loadStagedImages() {
        const drafts = await client.fetch<Array<{ _id: string; bulkReplacementId: string; imageUrl: string }>>(
            `*[_type == "websiteImage" && _id in path("drafts.**") && defined(image.bulkReplacementId)] {
            _id,
            "bulkReplacementId": image.bulkReplacementId,
            "imageUrl": image.asset->url
        }`,
            {},
            { perspective: 'raw' }
        )
        const publishedIds = drafts.map(({ _id }) => _id.slice('drafts.'.length))
        const published = await client.fetch<Array<{ _id: string; bulkReplacementId?: string }>>(
            `*[_id in $publishedIds] { _id, "bulkReplacementId": image.bulkReplacementId }`,
            { publishedIds },
            { perspective: 'raw' }
        )
        const publishedBatchIds = new Map(published.map((image) => [image._id, image.bulkReplacementId]))

        return drafts
            .map(({ _id, ...draft }) => ({ ...draft, publishedId: _id.slice('drafts.'.length) }))
            .filter((draft) => publishedBatchIds.get(draft.publishedId) !== draft.bulkReplacementId)
    }

    useEffect(() => {
        let cancelled = false
        setFiles([])
        setSlots([])
        setStatus('Loading images...')
        Promise.all([
            client.fetch<WebsiteImageSlot[]>(
                `*[_type == "websiteImage" && !(_id in path("drafts.**")) && category == $category]
                    | order(title asc) {
                    _id,
                    "filename": image.asset->originalFilename,
                    title,
                    "imageUrl": image.asset->url
                }`,
                { category },
                { perspective: 'raw' }
            ),
            loadStagedImages(),
        ])
            .then(([images, staged]) => {
                if (cancelled) return
                setSlots(images)
                setStagedImages(staged)
                setStatus('')
            })
            .catch((error: unknown) => {
                if (cancelled) return
                setStatus(error instanceof Error ? error.message : 'Unable to load images')
            })
        return () => {
            cancelled = true
        }
    }, [category, client])

    const slotsByFilename = new Map<string, WebsiteImageSlot[]>()
    slots.forEach((slot) => {
        const filename = normalizeFilename(slot.filename)
        slotsByFilename.set(filename, [...(slotsByFilename.get(filename) ?? []), slot])
    })
    const filesByFilename = new Map<string, File[]>()
    files.forEach((file) => {
        const filename = normalizeFilename(file.name)
        filesByFilename.set(filename, [...(filesByFilename.get(filename) ?? []), file])
    })

    const matches = [...filesByFilename].flatMap(([filename, matchingFiles]) => {
        const matchingSlots = slotsByFilename.get(filename) ?? []
        return matchingFiles.length === 1 && matchingSlots.length === 1
            ? [{ file: matchingFiles[0], slot: matchingSlots[0] }]
            : []
    })
    const ambiguousFilenames = [...new Set([...filesByFilename.keys(), ...slotsByFilename.keys()])].filter(
        (filename) =>
            (filesByFilename.get(filename)?.length ?? 0) > 1 || (slotsByFilename.get(filename)?.length ?? 0) > 1
    )
    const unmatchedFiles = [...filesByFilename.keys()].filter((filename) => !slotsByFilename.has(filename))
    const missingSlots = [...slotsByFilename.keys()].filter((filename) => !filesByFilename.has(filename))
    const stagedByPublishedId = new Map(stagedImages.map((image) => [image.publishedId, image]))

    async function replaceImages() {
        const confirmed = window.confirm(
            `Stage ${matches.length} ${category} image replacements? The Website will not change until you publish the staged images.`
        )
        if (!confirmed) return

        try {
            setBusy(true)
            setStatus('Checking for unpublished image edits...')
            const draftIds = await client.fetch<string[]>(
                '*[_id in $draftIds]._id',
                {
                    draftIds: matches.map(({ slot }) => `drafts.${slot._id}`),
                },
                { perspective: 'raw' }
            )
            const conflictingDrafts = draftIds.filter(
                (draftId) => !stagedByPublishedId.has(draftId.slice('drafts.'.length))
            )
            if (conflictingDrafts.length > 0) {
                throw new Error(
                    `${conflictingDrafts.length} matched images already have manual drafts. Publish or discard those drafts first.`
                )
            }

            setStatus(`Uploading 0 of ${matches.length}...`)
            const uploaded: Array<{ assetId: string; imageUrl: string; slotId: string }> = []
            for (let index = 0; index < matches.length; index += 3) {
                const batch = matches.slice(index, index + 3)
                const assets = await Promise.all(
                    batch.map(async ({ file, slot }) => {
                        const asset = await client.assets.upload('image', file, { filename: file.name })
                        return { assetId: asset._id, imageUrl: asset.url, slotId: slot._id }
                    })
                )
                uploaded.push(...assets)
                setStatus(`Uploading ${Math.min(index + batch.length, matches.length)} of ${matches.length}...`)
            }

            const bulkReplacementId = crypto.randomUUID()
            await client.action(
                uploaded.map(({ assetId, slotId }) => ({
                    actionType: 'sanity.action.document.edit' as const,
                    publishedId: slotId,
                    draftId: `drafts.${slotId}`,
                    patch: {
                        set: {
                            image: {
                                _type: 'image',
                                asset: { _ref: assetId, _type: 'reference' },
                                bulkReplacementId,
                            },
                        },
                    },
                }))
            )
            setStagedImages(await loadStagedImages())
            setFiles([])
            if (fileInput.current) fileInput.current.value = ''
            setStatus(`Staged ${uploaded.length} images. Review them below, then publish when ready.`)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to stage images')
        } finally {
            setBusy(false)
        }
    }

    async function publishStagedImages() {
        try {
            setBusy(true)
            setStatus('Checking staged images...')
            const currentStagedImages = await loadStagedImages()
            setStagedImages(currentStagedImages)
            if (currentStagedImages.length === 0) {
                setStatus('There are no staged images to publish.')
                return
            }

            const confirmed = window.confirm(
                `Publish all ${currentStagedImages.length} staged Website image replacements? This updates production content immediately.`
            )
            if (!confirmed) {
                setStatus('Staged images were not published.')
                return
            }

            setStatus(`Publishing ${currentStagedImages.length} staged images...`)
            await client.action(
                currentStagedImages.map(({ publishedId }) => ({
                    actionType: 'sanity.action.document.publish' as const,
                    publishedId,
                    draftId: `drafts.${publishedId}`,
                }))
            )
            const publishedUrls = new Map(currentStagedImages.map((image) => [image.publishedId, image.imageUrl]))
            setSlots((current) =>
                current.map((slot) => ({ ...slot, imageUrl: publishedUrls.get(slot._id) ?? slot.imageUrl }))
            )
            setStagedImages([])
            setStatus(`Published ${currentStagedImages.length} Website images successfully.`)
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to publish staged images')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Page>
            <Panel>
                <h1>Bulk replace Website images</h1>
                <p>
                    Select a category and choose multiple files. Files are matched to stable image slots by their
                    original filename. Replacements are staged as drafts until you publish them together.
                </p>
                <Controls>
                    <label>
                        Folder
                        <select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
                            {WEBSITE_IMAGE_CATEGORIES.map((value) => (
                                <option key={value}>{value}</option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Replacement files
                        <input
                            key={category}
                            ref={fileInput}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
                        />
                    </label>
                </Controls>
                {files.length > 0 && (
                    <Summary>
                        <p>{matches.length} files matched and ready to replace.</p>
                        <p>{unmatchedFiles.length} selected files do not match a slot.</p>
                        <p>{missingSlots.length} folder slots have no selected replacement.</p>
                        <p>{ambiguousFilenames.length} filenames are ambiguous and will not be replaced.</p>
                        {unmatchedFiles.length > 0 && <p>Unmatched: {unmatchedFiles.join(', ')}</p>}
                        {ambiguousFilenames.length > 0 && <p>Ambiguous: {ambiguousFilenames.join(', ')}</p>}
                    </Summary>
                )}
                <ReplaceButton disabled={matches.length === 0 || busy} onClick={replaceImages}>
                    Stage {matches.length} matched images
                </ReplaceButton>
                <PublishButton disabled={stagedImages.length === 0 || busy} onClick={publishStagedImages}>
                    Publish {stagedImages.length} staged images
                </PublishButton>
                {status && <p>{status}</p>}
                <Grid>
                    {slots.map((slot) => {
                        const stagedImage = stagedByPublishedId.get(slot._id)
                        return (
                            <ImageCard key={slot._id}>
                                <img
                                    src={`${stagedImage?.imageUrl ?? slot.imageUrl}?w=300&h=300&fit=crop&auto=format`}
                                    alt=""
                                />
                                <p>
                                    {slot.title}
                                    {stagedImage && ' (staged)'}
                                </p>
                            </ImageCard>
                        )
                    })}
                </Grid>
            </Panel>
        </Page>
    )
}
