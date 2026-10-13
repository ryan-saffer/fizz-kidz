import { CakeSlice, Info } from 'lucide-react'

import { BRING_OWN_CAKE } from '@fizz-kidz/core'

import { Checkbox } from '@shared/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'

import BringOwnCakeImage from '../../assets/bring-own-cake.png'
import { required, requiredForCake } from '../../state/form'
import { usePartyConfig, usePartyFormApi } from '../../state/party-form-store'
import { formatPrice } from '../../utils/display'
import { ImageCard, imageCardControlClassName, imageCardGridClassName } from '../common/image-card'
import { OptionRow } from '../common/option-row'
import { Note, Prose, Section, StepBody } from '../common/section'
import { FieldError, TextField } from '../common/text-fields'

import type { CakeOption, PartyFormConfig } from '../../state/party-form-store'

const NUMBER_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five' }

/** Every cake option comes from the Square cake item, through `config.cakeOptions`. */
export function CakeStep() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const {
        sizes = [],
        designs = [],
        flavours = [],
        servingOptions = [],
        candleOptions = [],
    } = config.cakeOptions ?? {}
    const minFlavours = config.cakeOptions?.minFlavours ?? 1
    const maxFlavours = config.cakeOptions?.maxFlavours ?? 1
    // studio-stock cakes come in one size and fixed flavours (preset in the form), so those questions are skipped
    const fixedFlavours = config.cakeOptions?.fixedFlavours ?? null
    const askSize = sizes.length !== 1
    // studio-stock cakes (Geelong, Werribee) are made ahead, so there's one size and price, and no message
    const isStocked = config.cakeSource === 'studio-stock'
    const purchased = config.alreadyPurchased.cake

    // one cake per party: once ordered, it can't be changed or ordered again here
    if (purchased)
        return (
            <StepBody step="cake">
                <PurchasedCake
                    cake={purchased}
                    imageUrl={designs.find((design) => design.name === purchased.selection)?.imageUrl ?? null}
                />
            </StepBody>
        )

    return (
        <StepBody step="cake">
            <Section title="Would you like to order an ice-cream cake directly through us?">
                {isStocked && sizes[0] ? (
                    <>
                        <dl className="mb-5 grid gap-3 sm:grid-cols-3">
                            {getStockedCakeFacts(sizes[0], fixedFlavours ?? []).map((fact) => (
                                <div key={fact.label} className="rounded-2xl bg-party-tint px-4 py-3">
                                    <dt className="text-xs font-semibold uppercase tracking-wide text-party-muted">
                                        {fact.label}
                                    </dt>
                                    <dd className="m-0 text-lg font-semibold text-party-ink">{fact.value}</dd>
                                </div>
                            ))}
                        </dl>
                        <Prose>
                            <p>Your ice-cream cake will be ready for you at the studio when you arrive.</p>
                        </Prose>
                    </>
                ) : (
                    <Prose>
                        <p>Your ice-cream cake will be ready for you at the studio when you arrive.</p>
                        <p>You can even customise the cake with a message!</p>
                        <ul>
                            {sizes.map((size) => (
                                <li key={size.id}>
                                    {size.name} {formatPrice(size.priceCents / 100)}
                                </li>
                            ))}
                        </ul>
                    </Prose>
                )}
                <Note className="flex gap-3">
                    <Info size={18} className="mt-0.5 shrink-0 text-party-pink" aria-hidden="true" />
                    <div>
                        <p className="font-semibold">Payment</p>
                        <p>The payment for your ice-cream cake is processed when you submit this form.</p>
                        <p>The rest of your party payment will be made at the end of the party.</p>
                    </div>
                </Note>
            </Section>
            <Section title="Which ice-cream cake would you like?">
                <form.Field name="cakeSelection" validators={{ onChange: required('Please choose a cake option') }}>
                    {(field) => (
                        <>
                            <RadioGroup
                                aria-label="Cake design"
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value)}
                                className={imageCardGridClassName}
                            >
                                {[
                                    ...designs,
                                    { id: BRING_OWN_CAKE, name: BRING_OWN_CAKE, imageUrl: BringOwnCakeImage },
                                ].map((design) => {
                                    const soldOut = 'soldOut' in design && !!design.soldOut
                                    return (
                                        <ImageCard
                                            key={design.id}
                                            name={design.name}
                                            imageUrl={design.imageUrl}
                                            square
                                            disabled={soldOut}
                                            badge={soldOut ? 'Sold out' : undefined}
                                            control={
                                                <RadioGroupItem
                                                    value={design.name}
                                                    disabled={soldOut}
                                                    className={imageCardControlClassName}
                                                />
                                            }
                                        />
                                    )
                                })}
                            </RadioGroup>
                            <FieldError field={field} />
                        </>
                    )}
                </form.Field>

                <form.Subscribe selector={(state) => state.values.cakeSelection}>
                    {(cakeSelection) =>
                        cakeSelection && cakeSelection !== BRING_OWN_CAKE ? (
                            <div className="mt-6 flex flex-col gap-6">
                                {askSize ? (
                                    <CakeQuestion title="Which size would you like?">
                                        <form.Field
                                            name="cakeSize"
                                            validators={{
                                                onChangeListenTo: ['cakeSelection'],
                                                onChange: requiredForCake('Please choose a cake size', Boolean),
                                            }}
                                        >
                                            {(field) => (
                                                <>
                                                    <CakeOptionGroup
                                                        label="Cake size"
                                                        options={sizes}
                                                        value={field.state.value}
                                                        onChange={field.handleChange}
                                                    />
                                                    <FieldError field={field} />
                                                </>
                                            )}
                                        </form.Field>
                                    </CakeQuestion>
                                ) : null}
                                {fixedFlavours ? null : (
                                    <CakeQuestion
                                        title="What flavours would you like?"
                                        description={
                                            maxFlavours === 1
                                                ? 'Please select one flavour.'
                                                : `You can select up to ${NUMBER_WORDS[maxFlavours] ?? maxFlavours} flavours.`
                                        }
                                    >
                                        <form.Field
                                            name="cakeFlavours"
                                            validators={{
                                                onChangeListenTo: ['cakeSelection'],
                                                onChange: requiredForCake<string[]>(
                                                    minFlavours === 1
                                                        ? 'Please choose at least one flavour'
                                                        : `Please choose at least ${minFlavours} flavours`,
                                                    (value) => value.length >= minFlavours
                                                ),
                                            }}
                                        >
                                            {(field) => (
                                                <>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {flavours.map(({ name: flavour }) => {
                                                            const selected = field.state.value.includes(flavour)
                                                            const disabled =
                                                                !selected && field.state.value.length >= maxFlavours
                                                            return (
                                                                <OptionRow
                                                                    key={flavour}
                                                                    label={flavour}
                                                                    disabled={disabled}
                                                                >
                                                                    <Checkbox
                                                                        checked={selected}
                                                                        disabled={disabled}
                                                                        onCheckedChange={(checked) =>
                                                                            field.handleChange(
                                                                                checked
                                                                                    ? [...field.state.value, flavour]
                                                                                    : field.state.value.filter(
                                                                                          (name) => name !== flavour
                                                                                      )
                                                                            )
                                                                        }
                                                                    />
                                                                </OptionRow>
                                                            )
                                                        })}
                                                    </div>
                                                    <FieldError field={field} />
                                                </>
                                            )}
                                        </form.Field>
                                    </CakeQuestion>
                                )}
                                <CakeQuestion title="How would you like your ice-cream cake to be served?">
                                    <form.Field
                                        name="cakeServed"
                                        validators={{
                                            onChangeListenTo: ['cakeSelection'],
                                            onChange: requiredForCake('Please choose a serving option', Boolean),
                                        }}
                                    >
                                        {(field) => (
                                            <>
                                                <CakeOptionGroup
                                                    label="How to serve the cake"
                                                    options={servingOptions}
                                                    value={field.state.value}
                                                    onChange={field.handleChange}
                                                />
                                                <FieldError field={field} />
                                            </>
                                        )}
                                    </form.Field>
                                </CakeQuestion>

                                <CakeQuestion title="Would you like us to include candles?">
                                    <form.Field
                                        name="cakeCandles"
                                        validators={{
                                            onChangeListenTo: ['cakeSelection'],
                                            onChange: requiredForCake('Please choose a candle option', Boolean),
                                        }}
                                    >
                                        {(field) => (
                                            <>
                                                <CakeOptionGroup
                                                    label="Candles"
                                                    options={candleOptions}
                                                    value={field.state.value}
                                                    onChange={field.handleChange}
                                                />
                                                <FieldError field={field} />
                                            </>
                                        )}
                                    </form.Field>
                                </CakeQuestion>

                                {isStocked ? null : (
                                    <form.Field name="cakeMessage">
                                        {(field) => (
                                            <TextField
                                                field={field}
                                                label="Add a personalised message to be written on your cake!"
                                                description="This is optional. Maximum 30 characters."
                                                placeholder={'"Happy 5th Birthday Amy!"'}
                                                maxLength={30}
                                            />
                                        )}
                                    </form.Field>
                                )}
                            </div>
                        ) : null
                    }
                </form.Subscribe>
            </Section>
        </StepBody>
    )
}

/** The fixed facts about a studio-stock cake, eg. Flavour: Chocolate & vanilla, Serves: 15-25, Price: $119. */
function getStockedCakeFacts(size: CakeOption, flavours: string[]) {
    // Square names sizes like 'Medium (15-25 serves)'
    const serves = size.name.match(/\(([^)]*?)\s*serves?\)/i)?.[1]
    const flavour = flavours.map((name, idx) => (idx === 0 ? name : name.toLowerCase())).join(' & ')
    return [
        ...(flavour ? [{ label: 'Flavour', value: flavour }] : []),
        ...(serves ? [{ label: 'Serves', value: serves }] : []),
        { label: 'Price', value: formatPrice(size.priceCents / 100) },
    ]
}

function CakeQuestion({
    title,
    description,
    children,
}: {
    title: string
    description?: string
    children: React.ReactNode
}) {
    return (
        <div>
            <h3 className={description ? 'mb-1 font-semibold' : 'mb-2 font-semibold'}>{title}</h3>
            {description && <p className="mb-2 text-sm text-party-muted">{description}</p>}
            {children}
        </div>
    )
}

function CakeOptionGroup({
    label,
    options,
    value,
    onChange,
}: {
    label: string
    options: CakeOption[]
    value: string
    onChange: (value: string) => void
}) {
    return (
        <RadioGroup aria-label={label} value={value} onValueChange={onChange} className="gap-2">
            {options.map((option) => (
                <OptionRow
                    key={option.id}
                    label={option.name}
                    price={option.priceCents ? formatPrice(option.priceCents / 100) : undefined}
                >
                    <RadioGroupItem value={option.name} />
                </OptionRow>
            ))}
        </RadioGroup>
    )
}

function PurchasedCake({
    cake,
    imageUrl,
}: {
    cake: NonNullable<PartyFormConfig['alreadyPurchased']['cake']>
    imageUrl: string | null
}) {
    const details = [
        ['Size', cake.size],
        ['Flavours', cake.flavours.join(', ')],
        ['How to serve', cake.served],
        ['Candles', cake.candles],
        ['Message', cake.message || 'No message'],
    ]
    return (
        <Section title="Your cake is ordered">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="grid aspect-square w-full shrink-0 place-items-center overflow-hidden rounded-2xl bg-party-placeholder text-[#b6a1c3] sm:w-44">
                    {imageUrl ? (
                        <img className="h-full w-full object-cover" src={imageUrl} alt="" />
                    ) : (
                        <CakeSlice size={40} aria-hidden="true" />
                    )}
                </div>
                <div className="flex-1">
                    <p className="text-lg font-semibold">{cake.selection}</p>
                    <dl className="mt-2 grid gap-1.5 text-sm">
                        {details.map(([label, value]) => (
                            <div key={label} className="flex gap-2">
                                <dt className="w-28 shrink-0 text-party-muted">{label}</dt>
                                <dd>{value}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
            <Note className="mt-5">
                Only one cake can be ordered per party. If you need to change it, email us at{' '}
                <a
                    className="font-medium text-party-pink underline underline-offset-2"
                    href="mailto:bookings@fizzkidz.com.au"
                >
                    bookings@fizzkidz.com.au
                </a>
                .
            </Note>
        </Section>
    )
}
