import { getTakeHomeMinimum, orderedQuantities, PRODUCTS, TAKE_HOME_BAGS } from '@fizz-kidz/core'

import { usePartyConfig, usePartyFormApi } from '../../state/party-form-store'
import { formatPrice, takeHomeName } from '../../utils/display'
import { imageCardGridClassName } from '../common/image-card'
import { QuantityCard } from '../common/quantity-card'
import { AlreadyPurchased, Note, Prose, Section, StepBody } from '../common/section'

import type { PartyFormV2Config } from '../../state/party-form-store'

/** Take-home bags and kits, with names, photos and prices from Square. */
export function GoodiesStep() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const options = config.takeHomeOptions
    const { takeHomeBags: purchasedBags, products: purchasedProducts } = config.alreadyPurchased
    // earlier orders show on their card; anything no longer offered is listed on its own
    const unlistedBags = orderedQuantities(purchasedBags).filter(
        ([key]) => !options?.takeHomeBags.some((option) => option.key === key)
    )
    const unlistedProducts = orderedQuantities(purchasedProducts).filter(
        ([key]) => !options?.products.some((option) => option.key === key)
    )
    const discount = options ? getProductDiscount(options.products) : null

    return (
        <StepBody step="goodies">
            <Prose className="mb-0">
                <h2 className="font-lilita text-2xl">We are all about making your life easy!</h2>
                <p>
                    Add an awesome take-home gift for your child's friends, and we will have it ready for you on the
                    day!
                </p>
            </Prose>
            {unlistedBags.length + unlistedProducts.length > 0 && (
                <AlreadyPurchased>
                    {unlistedBags.map(([key, quantity]) => (
                        <p key={key}>
                            {quantity} × {takeHomeName(options?.takeHomeBags, key, TAKE_HOME_BAGS[key].displayValue)}
                        </p>
                    ))}
                    {unlistedProducts.map(([key, quantity]) => (
                        <p key={key}>
                            {quantity} × {takeHomeName(options?.products, key, PRODUCTS[key].displayValue)}
                        </p>
                    ))}
                </AlreadyPurchased>
            )}
            {!options ? (
                <Note>
                    Take-home goodies can't be added online right now. Let us know what you'd like in the questions at
                    the end of the form.
                </Note>
            ) : (
                <>
                    {options.takeHomeBags.length > 0 && (
                        <Section title="Lolly Bags & Toy Bags">
                            <div className={imageCardGridClassName}>
                                {options.takeHomeBags.map((bag) => (
                                    <form.Field key={bag.key} name={`takeHomeBags.${bag.key}`}>
                                        {(field) => (
                                            <QuantityCard
                                                alreadyOrdered={purchasedBags[bag.key] ?? 0}
                                                name={bag.name}
                                                imageUrl={bag.imageUrl}
                                                price={`${formatPrice(bag.priceCents / 100)} each`}
                                                minimum={getTakeHomeMinimum(purchasedBags[bag.key])}
                                                value={field.state.value}
                                                onChange={(quantity) => field.handleChange(quantity)}
                                            />
                                        )}
                                    </form.Field>
                                ))}
                            </div>
                            <MinimumNote
                                minimum={options.minimumQuantity}
                                toppingUp={options.takeHomeBags.some((bag) => purchasedBags[bag.key])}
                            />
                        </Section>
                    )}
                    {options.products.length > 0 && (
                        <Section
                            title={
                                discount
                                    ? `Fizz Kidz Take-Home Gifts - ${discount.percent}% off!`
                                    : 'Fizz Kidz Take-Home Gifts'
                            }
                        >
                            <Prose>
                                {discount && (
                                    <p>
                                        As a Fizz VIP, enjoy {discount.percent}% off our Fizz Kidz product range. (RRP:{' '}
                                        {formatPrice(discount.regularPriceCents / 100)}).
                                    </p>
                                )}
                                <p>Perfect for unique take home gifts for your childs friends.</p>
                            </Prose>
                            <div className={imageCardGridClassName}>
                                {options.products.map((product) => (
                                    <form.Field key={product.key} name={`products.${product.key}`}>
                                        {(field) => (
                                            <QuantityCard
                                                alreadyOrdered={purchasedProducts[product.key] ?? 0}
                                                name={product.name}
                                                description={product.description}
                                                imageUrl={product.imageUrl}
                                                price={`${formatPrice(product.priceCents / 100)} each`}
                                                minimum={getTakeHomeMinimum(purchasedProducts[product.key])}
                                                value={field.state.value}
                                                onChange={(quantity) => field.handleChange(quantity)}
                                            />
                                        )}
                                    </form.Field>
                                ))}
                            </div>
                            <MinimumNote
                                minimum={options.minimumQuantity}
                                toppingUp={options.products.some((product) => purchasedProducts[product.key])}
                            />
                        </Section>
                    )}
                </>
            )}
        </StepBody>
    )
}

function MinimumNote({ minimum, toppingUp }: { minimum: number; toppingUp: boolean }) {
    return (
        <p className="mt-3 text-[13px] text-party-muted">
            Minimum order of {minimum} for each item.
            {toppingUp && " You can add any number to something you've already ordered."}
        </p>
    )
}

type TakeHomeOptions = NonNullable<PartyFormV2Config['takeHomeOptions']>

/** The kits' shared discount off their catalogue price at the minimum quantity, if they all have the same one. */
function getProductDiscount(products: TakeHomeOptions['products']) {
    const [first] = products
    if (!first || first.priceCents >= first.regularPriceCents) return null
    const same = products.every(
        (product) => product.priceCents === first.priceCents && product.regularPriceCents === first.regularPriceCents
    )
    if (!same) return null
    return {
        percent: Math.round((1 - first.priceCents / first.regularPriceCents) * 100),
        regularPriceCents: first.regularPriceCents,
    }
}
