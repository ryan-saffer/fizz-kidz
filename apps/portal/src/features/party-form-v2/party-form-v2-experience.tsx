import { ArrowRight, Check, PartyPopper, Pencil } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'

import {
    BRING_OWN_CAKE,
    CAKE_CANDLES_OPTIONS,
    CAKE_SERVED_OPTIONS,
    CAKE_SIZES,
    orderedQuantities,
    PRODUCTS,
    PROD_ADDITIONS,
    TAKE_HOME_BAG_PRICE,
} from '@fizz-kidz/core'

import { Button } from '@shared/components/ui/button'

import { TAKE_HOME_BAG_LABELS } from './party-form-v2-copy'
import { PRODUCT_PRICE } from './party-form-v2-pricing'

import type { FormValues } from './party-form-v2-form'
import type { PartyFormV2Config } from './party-form-v2-page'

export type PartyStep = { key: string; label: string; title: string; fields: (keyof FormValues)[] }

export function StepHeading({ step }: { step: PartyStep }) {
    const heading = useRef<HTMLHeadingElement>(null)
    useLayoutEffect(() => {
        heading.current?.focus({ preventScroll: true })
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [step.key])

    return (
        <header className="party-step-heading">
            <h1 ref={heading} tabIndex={-1}>
                {step.title}
            </h1>
        </header>
    )
}

export function PartyProgress({
    steps,
    current,
    onNavigate,
    disabled,
    lastReachable,
}: {
    steps: PartyStep[]
    current: number
    onNavigate: (index: number) => void
    disabled: boolean
    lastReachable: number
}) {
    return (
        <nav className="party-progress" aria-label="Party form progress">
            <div className="party-progress-mobile">
                <span>{steps[current].label}</span>
                <span>
                    Step {current + 1} of {steps.length}
                </span>
            </div>
            <ol>
                {steps.map((step, index) => (
                    <li key={step.key}>
                        <button
                            type="button"
                            aria-current={index === current ? 'step' : undefined}
                            disabled={disabled || index === current || (index > current && index > lastReachable)}
                            onClick={() => onNavigate(index)}
                        >
                            <span className="party-step-number" aria-hidden="true">
                                {index < current ? <Check size={14} aria-hidden="true" /> : index + 1}
                            </span>
                            {step.label}
                        </button>
                    </li>
                ))}
            </ol>
            <div className="party-progress-track">
                <div style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
            </div>
        </nav>
    )
}

export function PartyWelcome({ config, onStart }: { config: PartyFormV2Config; onStart: () => void }) {
    const images = config.packages.flatMap((item) => item.creations.find((creation) => creation.image) ?? [])
    const photos = [...new Map(images.map((item) => [item.key, item])).values()].slice(0, 3)
    return (
        <div className="party-welcome party-enter">
            <div className="party-welcome-copy">
                <h1>Fizz Kidz Party Details</h1>
                <p className="party-welcome-intro">
                    Hey {config.prefill.parentFirstName}, we can't wait for {config.prefill.childName}'s birthday party!
                </p>
                <div className="party-prose">
                    <p>
                        To make sure everything is organised for the special event please carefully go through this form
                        and feel free to email us any questions 🙂
                    </p>
                    <p>
                        Try to use the 'Next' and 'Back' buttons at the bottom of each page. Using your browsers back
                        and forward buttons may lose your previous answers!
                    </p>
                    <p>You can always start again by clicking on the link in the email.</p>
                </div>
                <Button size="lg" type="button" className="party-primary" onClick={onStart}>
                    Next <ArrowRight size={18} aria-hidden="true" />
                </Button>
            </div>
            <div className="party-welcome-art" aria-hidden="true">
                {photos.map((creation, index) => (
                    <div className={`party-photo party-photo-${index + 1}`} key={creation.key}>
                        <img src={creation.image!.url} alt="" width={360} height={270} />
                        <span>{creation.name}</span>
                    </div>
                ))}
                {!photos.length && <PartyPopper className="party-welcome-fallback" />}
            </div>
        </div>
    )
}

export function PartyReview({
    config,
    values,
    total,
    onEdit,
}: {
    config: PartyFormV2Config
    values: FormValues
    total: number
    onEdit: (step: string) => void
}) {
    const cake = config.canOrderCake && values.cakeSelection && values.cakeSelection !== BRING_OWN_CAKE
    return (
        <div className="party-review">
            <ReviewSection title="Your Details" onEdit={() => onEdit('details')}>
                <p>
                    {values.childName}, turning {values.childAge}
                </p>
                <p>{values.numberOfChildren} children</p>
                <p>
                    Parent: {values.parentFirstName} {values.parentLastName}
                </p>
            </ReviewSection>
            <ReviewSection title="Creation Selection" onEdit={() => onEdit('creations')}>
                <div className="party-review-creations">
                    {values.creations.map((selection) => {
                        const creation = config.packages
                            .find((item) => item.key === selection.packageKey)
                            ?.creations.find((item) => item.key === selection.creationKey)
                        return (
                            <div key={`${selection.packageKey}:${selection.creationKey}`}>
                                {creation?.image && <img src={creation.image.url} alt="" width={64} height={48} />}
                                <span>{creation?.name ?? selection.creationKey}</span>
                            </div>
                        )
                    })}
                </div>
            </ReviewSection>
            {config.type === 'studio' && (
                <ReviewSection title="Party Food" onEdit={() => onEdit('food')}>
                    <p>
                        {values.foodPackage === 'include' ? 'Include the food package' : 'I will self-cater the party'}
                    </p>
                    {values.additions.map((addition) => (
                        <p key={addition}>{PROD_ADDITIONS[addition].displayValueWithPrice}</p>
                    ))}
                </ReviewSection>
            )}
            {config.canOrderCake && (
                <ReviewSection title="Birthday Cake" onEdit={() => onEdit('cake')}>
                    {cake ? (
                        <>
                            <p>{values.cakeSelection}</p>
                            <p>
                                {values.cakeSize && CAKE_SIZES[values.cakeSize].label} ·{' '}
                                {values.cakeFlavours.join(' + ')}
                            </p>
                            <p>{values.cakeServed && CAKE_SERVED_OPTIONS[values.cakeServed].label}</p>
                            <p>{values.cakeCandles && CAKE_CANDLES_OPTIONS[values.cakeCandles].label}</p>
                            {values.cakeMessage && <p>Message: {values.cakeMessage}</p>}
                        </>
                    ) : (
                        !config.alreadyPurchased.cake && <p>{BRING_OWN_CAKE}</p>
                    )}
                    {config.alreadyPurchased.cake && (
                        <p className="party-muted">
                            You have already purchased: {config.alreadyPurchased.cake.selection}
                        </p>
                    )}
                </ReviewSection>
            )}
            <ReviewSection title="Take Home Goodies" onEdit={() => onEdit('goodies')}>
                {orderedQuantities(values.takeHomeBags).map(([key, quantity]) => (
                    <p key={key}>
                        {quantity} × {TAKE_HOME_BAG_LABELS[key]}
                    </p>
                ))}
                {orderedQuantities(values.products).map(([key, quantity]) => (
                    <p key={key}>
                        {quantity} × {PRODUCTS[key].displayValue}
                    </p>
                ))}
                {orderedQuantities(config.alreadyPurchased.takeHomeBags).map(([key, quantity]) => (
                    <p className="party-muted" key={key}>
                        You have already purchased: {quantity} × {TAKE_HOME_BAG_LABELS[key]}
                    </p>
                ))}
                {orderedQuantities(config.alreadyPurchased.products).map(([key, quantity]) => (
                    <p className="party-muted" key={key}>
                        You have already purchased: {quantity} × {PRODUCTS[key].displayValue}
                    </p>
                ))}
            </ReviewSection>
            <ReviewSection title={`Tell us about ${values.childName}!`} onEdit={() => onEdit('about')}>
                <p className="whitespace-pre-wrap">{values.funFacts}</p>
                {values.questions && (
                    <>
                        <h3 className="mt-3 font-semibold">Finally, do you have any questions?</h3>
                        <p className="whitespace-pre-wrap">{values.questions}</p>
                    </>
                )}
            </ReviewSection>
            <div className="party-payment-summary">
                <div>
                    <span>To pay today</span>
                    <strong>{money(total)}</strong>
                </div>
                {cake && (
                    <>
                        {values.cakeSize && (
                            <PaymentLine label="Ice-cream cake" amount={CAKE_SIZES[values.cakeSize].price} />
                        )}
                        {values.cakeServed && CAKE_SERVED_OPTIONS[values.cakeServed].price > 0 && (
                            <PaymentLine
                                label="Cake serving option"
                                amount={CAKE_SERVED_OPTIONS[values.cakeServed].price}
                            />
                        )}
                        {values.cakeCandles && CAKE_CANDLES_OPTIONS[values.cakeCandles].price > 0 && (
                            <PaymentLine label="Candles" amount={CAKE_CANDLES_OPTIONS[values.cakeCandles].price} />
                        )}
                    </>
                )}
                {orderedQuantities(values.takeHomeBags).map(([key, quantity]) => (
                    <PaymentLine
                        key={key}
                        label={`${quantity} × ${TAKE_HOME_BAG_LABELS[key]}`}
                        amount={quantity * TAKE_HOME_BAG_PRICE}
                    />
                ))}
                {orderedQuantities(values.products).map(([key, quantity]) => (
                    <PaymentLine
                        key={key}
                        label={`${quantity} × ${PRODUCTS[key].displayValue}`}
                        amount={quantity * PRODUCT_PRICE}
                    />
                ))}
                <p>The rest of your party payment will be made at the end of the party.</p>
            </div>
        </div>
    )
}

function money(amount: number) {
    return `$${amount.toFixed(2)}`
}
function PaymentLine({ label, amount }: { label: string; amount: number }) {
    return (
        <div className="party-payment-line">
            <span>{label}</span>
            <span>{money(amount)}</span>
        </div>
    )
}
function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
    return (
        <section className="party-review-section">
            <header>
                <h2>{title}</h2>
                <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                </button>
            </header>
            {children}
        </section>
    )
}
