import { useSelector } from '@tanstack/react-form'
import { Pencil } from 'lucide-react'

import { BRING_OWN_CAKE, orderedQuantities, PRODUCTS, TAKE_HOME_BAGS } from '@fizz-kidz/core'

import { useIsCheckoutLocked, usePartyConfig, usePartyFormApi, usePartyFormStore } from '../../state/party-form-store'
import { formatPrice, takeHomeName } from '../../utils/display'

import type { PartyStepKey } from '../../state/steps'

/** A read-only summary of every answer, with a link back to each step. */
export function PartyReview() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const values = useSelector(form.store, (state) => state.values)
    const steps = usePartyFormStore((state) => state.steps)
    const onEdit = usePartyFormStore((state) => state.editStep)
    const locked = useIsCheckoutLocked()
    const has = (key: PartyStepKey) => steps.some((step) => step.key === key)
    const cake = values.cakeSelection && values.cakeSelection !== BRING_OWN_CAKE
    const bagName = (key: keyof typeof TAKE_HOME_BAGS) =>
        takeHomeName(config.takeHomeOptions?.takeHomeBags, key, TAKE_HOME_BAGS[key].displayValue)
    const productName = (key: keyof typeof PRODUCTS) =>
        takeHomeName(config.takeHomeOptions?.products, key, PRODUCTS[key].displayValue)
    return (
        <fieldset disabled={locked} aria-label="Review party details" className="grid min-w-0 gap-4">
            {has('details') && (
                <ReviewSection title="Your Details" onEdit={() => onEdit('details')}>
                    <p>
                        {values.childName}, turning {values.childAge}
                    </p>
                    <p>{values.numberOfChildren} children</p>
                    <p>
                        Parent: {values.parentFirstName} {values.parentLastName}
                    </p>
                </ReviewSection>
            )}
            {has('creations') && (
                <ReviewSection title="Creation Selection" onEdit={() => onEdit('creations')}>
                    <div className="flex flex-wrap gap-x-6 gap-y-4">
                        {values.creations.map((selection) => {
                            const creation = config.packages
                                .find((item) => item.key === selection.packageKey)
                                ?.creations.find((item) => item.key === selection.creationKey)
                            return (
                                <div
                                    className="flex items-center gap-2.5"
                                    key={`${selection.packageKey}:${selection.creationKey}`}
                                >
                                    {creation?.image && (
                                        <img
                                            className="h-12 w-16 rounded-lg object-cover"
                                            src={creation.image.url}
                                            alt=""
                                            width={64}
                                            height={48}
                                        />
                                    )}
                                    <span>{creation?.name ?? selection.creationKey}</span>
                                </div>
                            )
                        })}
                    </div>
                </ReviewSection>
            )}
            {has('food') && (
                <ReviewSection title="Party Food" onEdit={() => onEdit('food')}>
                    <p>
                        {values.foodPackage === 'include' ? 'Include the food package' : 'I will self-cater the party'}
                    </p>
                    {values.additions.map((key) => {
                        const addition = config.additions.find((item) => item.key === key)
                        return (
                            <p key={key}>
                                {addition?.name ?? key}
                                {addition?.priceCents != null && ` - ${formatPrice(addition.priceCents / 100)}`}
                            </p>
                        )
                    })}
                    <PurchasedNote>Paid at the end of the party.</PurchasedNote>
                </ReviewSection>
            )}
            {has('cake') && (
                <ReviewSection title="Birthday Cake" onEdit={() => onEdit('cake')}>
                    {cake ? (
                        <>
                            <p>{values.cakeSelection}</p>
                            <p>
                                {values.cakeSize} · {values.cakeFlavours.join(' + ')}
                            </p>
                            <p>{values.cakeServed}</p>
                            <p>{values.cakeCandles}</p>
                            {values.cakeMessage && <p>Message: {values.cakeMessage}</p>}
                        </>
                    ) : (
                        !config.alreadyPurchased.cake && <p>{BRING_OWN_CAKE}</p>
                    )}
                    {config.alreadyPurchased.cake && (
                        <PurchasedNote>
                            You have already purchased: {config.alreadyPurchased.cake.selection}
                        </PurchasedNote>
                    )}
                </ReviewSection>
            )}
            <ReviewSection title="Take Home Goodies" onEdit={() => onEdit('goodies')}>
                {orderedQuantities(values.takeHomeBags).map(([key, quantity]) => (
                    <p key={key}>
                        {quantity} × {bagName(key)}
                    </p>
                ))}
                {orderedQuantities(values.products).map(([key, quantity]) => (
                    <p key={key}>
                        {quantity} × {productName(key)}
                    </p>
                ))}
                {orderedQuantities(config.alreadyPurchased.takeHomeBags).map(([key, quantity]) => (
                    <PurchasedNote key={key}>
                        You have already purchased: {quantity} × {bagName(key)}
                    </PurchasedNote>
                ))}
                {orderedQuantities(config.alreadyPurchased.products).map(([key, quantity]) => (
                    <PurchasedNote key={key}>
                        You have already purchased: {quantity} × {productName(key)}
                    </PurchasedNote>
                ))}
            </ReviewSection>
            {has('about') && (
                <ReviewSection title={`Tell us about ${values.childName}!`} onEdit={() => onEdit('about')}>
                    <p className="whitespace-pre-wrap">{values.funFacts}</p>
                    {values.questions && (
                        <>
                            <h3 className="mt-3 font-semibold">Finally, do you have any questions?</h3>
                            <p className="whitespace-pre-wrap">{values.questions}</p>
                        </>
                    )}
                </ReviewSection>
            )}
        </fieldset>
    )
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-party-line bg-white p-5 text-sm [overflow-wrap:anywhere] sm:px-[26px] sm:py-[22px]">
            <header className="mb-2.5 flex items-center justify-between gap-4">
                <h2 className="font-lilita text-[21px] font-normal">{title}</h2>
                <button
                    type="button"
                    className="flex items-center gap-[5px] py-2 pl-2 text-xs text-party-pink"
                    onClick={onEdit}
                    aria-label={`Edit ${title.toLowerCase()}`}
                >
                    <Pencil size={13} aria-hidden="true" /> Edit
                </button>
            </header>
            {children}
        </section>
    )
}

function PurchasedNote({ children }: { children: React.ReactNode }) {
    return <p className="text-[13px] text-party-muted">{children}</p>
}
