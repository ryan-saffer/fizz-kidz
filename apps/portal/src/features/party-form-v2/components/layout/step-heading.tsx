import { useLayoutEffect, useRef } from 'react'

export function StepHeading({ stepKey, title }: { stepKey: string; title: string }) {
    const heading = useRef<HTMLHeadingElement>(null)
    useLayoutEffect(() => {
        heading.current?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [stepKey])

    return (
        <header className="animate-party-enter pb-6 pt-[30px] motion-reduce:animate-none sm:pb-[30px] sm:pt-11">
            <h1
                ref={heading}
                tabIndex={-1}
                className="mb-4 mt-3 font-lilita text-[clamp(34px,4vw,46px)] font-normal leading-[1.13] tracking-[-0.015em] focus:outline-none"
            >
                {title}
            </h1>
        </header>
    )
}
