import { ArrowRight, PartyPopper } from 'lucide-react'

import { cn } from '@shared/lib/tailwind'

import { usePartyConfig, usePartyFormStore } from '../../state/party-form-store'
import { PrimaryButton } from '../common/primary-button'
import { Prose } from '../common/section'

const PHOTO_POSITIONS = [
    'left-[3%] top-3.5 -rotate-[9deg] sm:left-0 sm:top-[5px]',
    'right-[3%] top-[60px] rotate-[9deg] sm:-right-[5px] sm:top-[150px]',
    'hidden left-0 top-[290px] -rotate-[5deg] sm:block',
]

export function PartyWelcome() {
    const config = usePartyConfig()
    const mode = usePartyFormStore((state) => state.mode)
    const start = usePartyFormStore((state) => state.start)
    const images = config.packages.flatMap((item) => item.creations.find((creation) => creation.image) ?? [])
    const photos = [...new Map(images.map((item) => [item.key, item])).values()].slice(0, 3)
    // studios that can't take cake orders (see `canOrderCake`) get a goodies-only cake form
    const order = config.cakeOptions ? 'birthday cake and take-home goodies' : 'take-home goodies'
    return (
        <div className="mx-auto mb-2.5 mt-[22px] grid max-w-[1040px] animate-party-enter items-center gap-[15px] motion-reduce:animate-none sm:mb-[50px] sm:mt-[25px] sm:min-h-[600px] sm:grid-cols-[1.1fr_1fr] sm:gap-5 md:gap-[65px]">
            <div>
                <h1 className="my-5 max-w-[380px] font-lilita text-[49px] font-normal leading-[1.06] tracking-[-0.025em] [overflow-wrap:anywhere] sm:mb-[25px] sm:max-w-none sm:text-[clamp(46px,5.5vw,70px)]">
                    {mode === 'cake'
                        ? config.cakeOptions
                            ? 'Birthday Cake & Goodies'
                            : 'Take-Home Goodies'
                        : 'Fizz Kidz Party Details'}
                </h1>
                <p className="max-w-[420px] text-[15px] text-party-muted sm:text-[17px]">
                    {mode === 'cake'
                        ? `Hey ${config.prefill.parentFirstName}, get ${config.prefill.childName}'s ${order} sorted ahead of the party!`
                        : `Hey ${config.prefill.parentFirstName}, we can't wait for ${config.prefill.childName}'s birthday party!`}
                </p>
                <Prose className="mt-6">
                    {mode === 'cake' ? (
                        <>
                            <p>
                                Order{' '}
                                {config.cakeOptions && !config.alreadyPurchased.cake ? 'an ice-cream cake and ' : ''}
                                take-home goodies now, and we'll have everything ready for you on the day.
                            </p>
                            <p>
                                We'll send you the party form closer to the day for the rest of the party details. You
                                can add more goodies then too.
                            </p>
                        </>
                    ) : (
                        <>
                            <p>
                                To make sure everything is organised for the special event please carefully go through
                                this form and feel free to email us any questions 🙂
                            </p>
                            <p>
                                Try to use the 'Next' and 'Back' buttons at the bottom of each page. Using your browsers
                                back and forward buttons may lose your previous answers!
                            </p>
                            <p>You can always start again by clicking on the link in the email.</p>
                        </>
                    )}
                </Prose>
                <PrimaryButton type="button" onClick={start}>
                    Next <ArrowRight size={18} aria-hidden="true" />
                </PrimaryButton>
            </div>
            <div
                className="relative mt-[15px] h-[240px] before:absolute before:inset-x-0 before:inset-y-2.5 before:-rotate-[8deg] before:rounded-[49%_51%_60%_40%] before:bg-[#e9def3] sm:mt-0 sm:h-[520px] sm:scale-[0.85] sm:before:inset-x-[-10px] sm:before:bottom-[30px] sm:before:top-10 md:scale-100"
                aria-hidden="true"
            >
                {photos.map((creation, index) => (
                    <div
                        className={cn(
                            'absolute w-[44%] max-w-[185px] rounded-[5px] bg-white p-[7px] shadow-[0_12px_35px_#3925441a] sm:w-[210px] sm:max-w-none sm:px-2.5 sm:pb-[13px] sm:pt-2.5 md:w-[235px]',
                            PHOTO_POSITIONS[index]
                        )}
                        key={creation.key}
                    >
                        <img
                            className="aspect-[4/3] w-full rounded-sm object-cover"
                            src={creation.image!.url}
                            alt=""
                            width={360}
                            height={270}
                        />
                        <span className="mt-[7px] block text-center font-lilita text-[13px] sm:mt-2.5 sm:text-[17px]">
                            {creation.name}
                        </span>
                    </div>
                ))}
                {!photos.length && (
                    <PartyPopper className="absolute left-1/4 top-[30%] h-[180px] w-[180px] text-party-pink" />
                )}
            </div>
        </div>
    )
}
