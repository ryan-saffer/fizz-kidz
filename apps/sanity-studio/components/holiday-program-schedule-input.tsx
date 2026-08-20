import { createImageUrlBuilder } from '@sanity/image-url'
import { type ArrayOfObjectsInputProps, useClient, useFormValue } from 'sanity'
import styled from 'styled-components'

import type { HolidayProgramScheduleSession, HolidayProgramScheduleWeek } from '@fizz-kidz/core'
import { HolidayProgramSchedule } from '@fizz-kidz/ui'
import '@fizz-kidz/ui/brand-fonts.css'

import '../styles/tailwind.css'

const Preview = styled.section`
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 2px rgb(15 23 42 / 6%);
    margin-top: 24px;
    overflow: hidden;

    @media (min-width: 1440px) {
        left: 50%;
        position: relative;
        transform: translateX(-50%);
        width: 1000px;
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

const PreviewViewport = styled.div`
    overflow-x: auto;
    padding: 0 24px 40px;
`

const PreviewBody = styled.div`
    margin: 0 auto;
    max-width: 1380px;
    min-width: 900px;
`

type ScheduleDocumentValue = Partial<HolidayProgramScheduleWeek> & {
    programs?: HolidayProgramScheduleSession[]
}

export function HolidayProgramScheduleInput(props: ArrayOfObjectsInputProps) {
    const client = useClient({ apiVersion: '2026-08-01' })
    const imageUrlBuilder = createImageUrlBuilder(client)
    const document = useFormValue([]) as ScheduleDocumentValue
    const programs = Array.isArray(props.value) ? (props.value as HolidayProgramScheduleSession[]) : []
    const resolvedPrograms = programs.map((program) => {
        if (program.image?.url || !program.image?.asset?._ref) return program

        return {
            ...program,
            image: {
                ...program.image,
                url: imageUrlBuilder.image(program.image).width(1034).height(727).fit('crop').auto('format').url(),
            },
        }
    })
    const previewPrograms = resolvedPrograms.filter(
        (program) =>
            typeof program.date === 'string' &&
            !Number.isNaN(new Date(`${program.date}T00:00:00`).getTime()) &&
            (program.slot === 'morning' || program.slot === 'afternoon') &&
            typeof program.title === 'string' &&
            Array.isArray(program.creations) &&
            typeof program.colour === 'string' &&
            Boolean(program.image)
    )
    const week: HolidayProgramScheduleWeek = {
        _id: document._id ?? 'preview',
        order: document.order ?? 0,
        programs: previewPrograms,
        title: document.title ?? 'Untitled week',
    }

    return (
        <>
            {props.renderDefault(props)}
            <Preview>
                <PreviewHeader>
                    <h3>Website preview</h3>
                    <p>This uses the same component, Tailwind theme, fonts, and assets as the public Website.</p>
                </PreviewHeader>
                {programs.length > 0 ? (
                    <PreviewViewport>
                        <PreviewBody>
                            <HolidayProgramSchedule
                                bookingUrl="https://bookings.fizzkidz.com.au/programs?id=11036399"
                                weeks={[week]}
                            />
                        </PreviewBody>
                    </PreviewViewport>
                ) : (
                    <p style={{ color: '#64748b', padding: '16px' }}>Add programs above to see the Website preview.</p>
                )}
            </Preview>
        </>
    )
}
