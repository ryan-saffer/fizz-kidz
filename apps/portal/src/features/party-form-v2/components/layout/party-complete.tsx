import {
    CalendarHeart,
    ClipboardList,
    Gift,
    Mail,
    MessageCircleQuestion,
    PartyPopper,
    Receipt,
    type LucideIcon,
} from 'lucide-react'

import type { PartyFormV2Mode } from '@fizz-kidz/core'

import { cn } from '@shared/lib/tailwind'

import { PrimaryButton } from '../common/primary-button'

const CONFETTI = [
    'left-[8%] top-6 h-3 w-3 rounded-full bg-[#02D7F7]',
    'left-[20%] top-24 h-2 w-5 rotate-[30deg] rounded-full bg-[#f7d878]',
    'left-[14%] top-28 h-2.5 w-2.5 rotate-45 bg-party-pink',
    'right-[10%] top-8 h-2 w-5 -rotate-[25deg] rounded-full bg-party-pink',
    'right-[20%] top-28 h-3 w-3 rounded-full bg-[#9ccf3b]',
    'right-[13%] top-24 h-2.5 w-2.5 rotate-12 bg-[#02D7F7]',
    'left-[30%] top-2 h-2 w-2 rounded-full bg-[#9ccf3b]',
    'right-[32%] top-3 h-2.5 w-2.5 rotate-45 bg-[#f7d878]',
]

/** Shown once the party details are saved (and anything ordered today is paid). */
export function PartyComplete({
    mode,
    parentFirstName,
    childName,
    receiptUrl,
}: {
    mode: PartyFormV2Mode
    parentFirstName: string
    childName: string
    receiptUrl: string | null
}) {
    const paid = Boolean(receiptUrl)
    return (
        <div className="relative mx-auto max-w-[640px] animate-party-enter pb-10 pt-6 text-center motion-reduce:animate-none sm:pt-10">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32">
                {CONFETTI.map((piece) => (
                    <span key={piece} className={cn('absolute', piece)} />
                ))}
            </div>

            <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-full bg-party-pink text-white shadow-[0_12px_32px_#a92c8340] ring-8 ring-[#f6e7f2]">
                <PartyPopper size={44} aria-hidden="true" />
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-party-pink">
                {mode === 'cake' ? 'Order received' : 'Party details received'}
            </p>
            <h1 className="mt-2 font-lilita text-[40px] font-normal leading-[1.08] sm:text-[52px]">
                {mode === 'cake' ? `Your order is in, ${parentFirstName}!` : `You're all set, ${parentFirstName}!`}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[17px] text-party-muted">
                We can't wait to celebrate {childName}'s birthday with you.
            </p>

            <section className="mt-9 rounded-[20px] border border-party-line bg-white/85 p-6 text-left sm:p-7">
                <h2 className="font-lilita text-[23px] font-normal">What happens next</h2>
                <ul className="mt-4 grid gap-4">
                    <NextStep icon={Mail}>We've emailed you a confirmation of everything you chose.</NextStep>
                    {paid && (
                        <>
                            <NextStep icon={Receipt}>Your payment went through, and your receipt is below.</NextStep>
                            <NextStep icon={Gift}>
                                Anything you ordered today, like your cake or take-home goodies, will be ready on the
                                day.
                            </NextStep>
                        </>
                    )}
                    {mode === 'cake' && (
                        <NextStep icon={ClipboardList}>
                            We'll send you the party form closer to the day for the rest of the party details.
                        </NextStep>
                    )}
                    <NextStep icon={CalendarHeart}>
                        The rest of your party is paid for at the end of the party.
                    </NextStep>
                    <NextStep icon={MessageCircleQuestion}>
                        Any questions? Email us at{' '}
                        <a
                            className="font-medium text-party-pink underline underline-offset-2"
                            href="mailto:bookings@fizzkidz.com.au"
                        >
                            bookings@fizzkidz.com.au
                        </a>
                        .
                    </NextStep>
                </ul>
            </section>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                {receiptUrl && (
                    <PrimaryButton asChild>
                        <a href={receiptUrl} target="_blank" rel="noreferrer">
                            <Receipt size={18} aria-hidden="true" /> View payment receipt
                        </a>
                    </PrimaryButton>
                )}
                <a
                    className="inline-flex min-h-[50px] items-center rounded-full border-[1.5px] border-party-pink px-6 text-sm font-semibold text-party-pink transition-colors hover:bg-party-pink hover:text-white"
                    href="https://www.fizzkidz.com.au"
                >
                    Visit the Fizz Kidz website
                </a>
            </div>
        </div>
    )
}

function NextStep({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-party-lilac text-party-pink">
                <Icon size={18} aria-hidden="true" />
            </span>
            <span className="pt-1.5 text-party-ink">{children}</span>
        </li>
    )
}
