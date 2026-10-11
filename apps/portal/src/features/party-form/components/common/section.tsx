import { cn } from '@shared/lib/tailwind'

import { useIsCurrentStep } from '../../state/party-form-store'

import type { PartyStepKey } from '../../state/steps'

/** A white card grouping the questions on a step. */
export function Section({
    title,
    className,
    children,
    ...props
}: { title?: string } & React.ComponentProps<'section'>) {
    return (
        <section
            className={cn(
                'rounded-2xl border border-party-line bg-white/85 px-[18px] py-[21px] sm:rounded-[20px] sm:p-7',
                className
            )}
            {...props}
        >
            {title && <h2 className="font-lilita text-[21px] font-normal leading-[1.3] sm:text-[23px]">{title}</h2>}
            <div className={cn(title && 'mt-4')}>{children}</div>
        </section>
    )
}

/** Muted explanatory paragraphs above a question. */
export function Prose({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div
            className={cn(
                'mb-6 grid gap-4 leading-[1.75] text-party-muted [&_h2]:text-party-ink [&_ul]:list-disc [&_ul]:pl-6',
                className
            )}
        >
            {children}
        </div>
    )
}

export function Note({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div
            className={cn(
                'rounded-[14px] bg-party-lilac px-[18px] py-4 text-[13px] leading-[1.7] text-[#5c466c] sm:px-[22px] sm:py-[18px] sm:text-sm',
                className
            )}
        >
            {children}
        </div>
    )
}

export function AlreadyPurchased({ children }: { children: React.ReactNode }) {
    return (
        <Note className="mb-5">
            <p className="mb-1 font-semibold">You have already purchased:</p>
            {children}
        </Note>
    )
}

/** A step's questions. Inactive steps stay mounted but hidden so their values and validators persist. */
export function StepBody({ step, children }: { step: PartyStepKey; children: React.ReactNode }) {
    const current = useIsCurrentStep(step)
    return (
        <div
            hidden={!current}
            className="flex animate-party-enter flex-col gap-[26px] motion-reduce:animate-none [&[hidden]]:hidden"
        >
            {children}
        </div>
    )
}
