import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'

import {
    BRING_OWN_CAKE,
    CAKE_CANDLES_OPTIONS,
    CAKE_SERVED_OPTIONS,
    CAKE_SIZES,
    MAX_CAKE_FLAVOURS,
    MAX_PARTY_FORM_FOOD_ADDITIONS,
    NUMBER_OF_CHILDREN_MOBILE,
    NUMBER_OF_CHILDREN_STUDIO,
    ObjectEntries,
    ObjectKeys,
    orderedQuantities,
    PARTY_FORM_CAKES,
    PARTY_FORM_CAKE_FLAVOURS,
    PARTY_FORM_V2_ADDITIONS,
    PRODUCTS,
    PRODUCT_RRP,
    PRODUCT_DISCOUNT_PERCENT,
    PROD_ADDITIONS,
    TAKE_HOME_BAGS,
    TAKE_HOME_BAG_PRICE,
    type PartyFormV2,
} from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Input } from '@shared/components/ui/input'
import { Label } from '@shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'
import { Textarea } from '@shared/components/ui/textarea'
import { cn } from '@shared/lib/tailwind'

import { TAKE_HOME_BAG_LABELS } from './party-form-v2-copy'
import { CreationPicker } from './party-form-v2-creations'
import { PartyProgress, PartyReview, PartyWelcome, StepHeading, type PartyStep } from './party-form-v2-experience'
import { calculateTotal, formatPrice, PRODUCT_PRICE } from './party-form-v2-pricing'

import type { PartyFormV2Config } from './party-form-v2-page'

type CreationSelection = { packageKey: string; creationKey: string }

export type FormValues = {
    parentFirstName: string
    parentLastName: string
    childName: string
    childAge: string
    numberOfChildren: string
    creations: CreationSelection[]
    foodPackage: 'include' | 'self-cater' | ''
    additions: (typeof PARTY_FORM_V2_ADDITIONS)[number][]
    cakeSelection: string
    cakeSize: keyof typeof CAKE_SIZES | ''
    cakeFlavours: (typeof PARTY_FORM_CAKE_FLAVOURS)[number][]
    cakeServed: keyof typeof CAKE_SERVED_OPTIONS | ''
    cakeCandles: keyof typeof CAKE_CANDLES_OPTIONS | ''
    cakeMessage: string
    takeHomeBags: Record<keyof typeof TAKE_HOME_BAGS, number>
    products: Record<keyof typeof PRODUCTS, number>
    funFacts: string
    questions: string
}

function required(message: string) {
    return ({ value }: { value: string }) => (value.trim() ? undefined : message)
}

export function PartyFormV2Form({ config }: { config: PartyFormV2Config }) {
    const trpc = useTRPC()
    const [submitError, setSubmitError] = useState(false)
    const [currentStep, setCurrentStep] = useState(-1)
    const [stepError, setStepError] = useState(false)
    const [isAdvancing, setIsAdvancing] = useState(false)
    const errorRef = useRef<HTMLDivElement>(null)

    const submitMutation = useMutation(trpc.parties.submitPartyFormV2.mutationOptions())

    const isStudio = config.type === 'studio'
    const steps: PartyStep[] = [
        {
            key: 'details',
            label: 'Your party',
            title: "First, let's confirm we have everything right.",
            fields: ['parentFirstName', 'parentLastName', 'childName', 'childAge', 'numberOfChildren'],
        },
        {
            key: 'creations',
            label: 'Creations',
            title: 'Creation Selection',
            fields: ['creations'],
        },
        ...(isStudio
            ? [
                  {
                      key: 'food',
                      label: 'Party food',
                      title: 'Party Food',
                      fields: ['foodPackage', 'additions'] as (keyof FormValues)[],
                  },
              ]
            : []),
        ...(config.canOrderCake
            ? [
                  {
                      key: 'cake',
                      label: 'Cake',
                      title: 'Birthday Cake',
                      fields: [
                          'cakeSelection',
                          'cakeSize',
                          'cakeFlavours',
                          'cakeServed',
                          'cakeCandles',
                      ] as (keyof FormValues)[],
                  },
              ]
            : []),
        {
            key: 'goodies',
            label: 'Goodies',
            title: 'Take Home Goodies',
            fields: [],
        },
        {
            key: 'about',
            label: 'About them',
            title: `Tell us about ${config.prefill.childName}!`,
            fields: [],
        },
        {
            key: 'review',
            label: 'Review',
            title: 'Review',
            fields: [],
        },
    ]
    const step = steps[currentStep]
    const isReview = step?.key === 'review'

    function navigate(index: number) {
        setStepError(false)
        setSubmitError(false)
        setCurrentStep(index)
    }

    const form = useForm({
        defaultValues: {
            parentFirstName: config.prefill.parentFirstName,
            parentLastName: config.prefill.parentLastName,
            childName: config.prefill.childName,
            childAge: config.prefill.childAge,
            numberOfChildren: '',
            creations: [],
            foodPackage: isStudio ? (config.prefill.includesFood ? 'include' : 'self-cater') : '',
            additions: [],
            cakeSelection: '',
            cakeSize: '',
            cakeFlavours: [],
            cakeServed: '',
            cakeCandles: '',
            cakeMessage: '',
            takeHomeBags: { lollyBags: 0, lollyToyMixBags: 0 },
            products: { bathBombKit: 0, soapMakingKit: 0, stringSlimeKit: 0, superSlimeKit: 0 },
            funFacts: '',
            questions: '',
        } as FormValues,
        onSubmitInvalid: ({ formApi }) => {
            const invalidStep = steps.findIndex((item) =>
                item.fields.some((name) => formApi.getFieldMeta(name)?.errors.length)
            )
            if (invalidStep >= 0) setCurrentStep(invalidStep)
            setStepError(true)
        },
        onSubmit: async ({ value }) => {
            setSubmitError(false)

            const creations = new Map<string, string[]>()
            for (const selection of value.creations) {
                creations.set(selection.packageKey, [
                    ...(creations.get(selection.packageKey) ?? []),
                    selection.creationKey,
                ])
            }

            const orderedCake = config.canOrderCake && value.cakeSelection && value.cakeSelection !== BRING_OWN_CAKE

            const payload: PartyFormV2 = {
                bookingId: config.bookingId,
                parentFirstName: value.parentFirstName.trim(),
                parentLastName: value.parentLastName.trim(),
                childName: value.childName.trim(),
                childAge: value.childAge.trim(),
                numberOfChildren: value.numberOfChildren,
                creations: [...creations.entries()].map(([packageKey, creationKeys]) => ({
                    packageKey,
                    creationKeys,
                })),
                ...(isStudio && { foodPackage: value.foodPackage === 'include' ? 'include' : 'self-cater' }),
                additions: isStudio ? value.additions : [],
                ...(orderedCake && {
                    cake: {
                        selection: value.cakeSelection as (typeof PARTY_FORM_CAKES)[number],
                        size: value.cakeSize as keyof typeof CAKE_SIZES,
                        flavours: value.cakeFlavours,
                        served: value.cakeServed as keyof typeof CAKE_SERVED_OPTIONS,
                        candles: value.cakeCandles as keyof typeof CAKE_CANDLES_OPTIONS,
                        ...(value.cakeMessage.trim() && { message: value.cakeMessage.trim() }),
                    },
                }),
                takeHomeBags: Object.fromEntries(
                    Object.entries(value.takeHomeBags).filter(([, quantity]) => quantity > 0)
                ),
                products: Object.fromEntries(Object.entries(value.products).filter(([, quantity]) => quantity > 0)),
                ...(value.funFacts.trim() && { funFacts: value.funFacts.trim() }),
                ...(value.questions.trim() && { questions: value.questions.trim() }),
            }

            try {
                const result = await submitMutation.mutateAsync(payload)
                if (result.action === 'payment') {
                    window.location.assign(result.paymentUrl)
                } else {
                    window.location.assign(result.redirectUrl)
                }
            } catch {
                setSubmitError(true)
            }
        },
    })

    function activeFields(item: PartyStep, values: FormValues) {
        return item.key === 'cake' && values.cakeSelection === BRING_OWN_CAKE
            ? (['cakeSelection'] as const)
            : item.fields
    }

    function isStepComplete(item: PartyStep, values: FormValues) {
        return activeFields(item, values).every((name) => {
            if (form.getFieldMeta(name)?.errors.length) return false
            if (name === 'creations') return values.creations.length === config.creationsRequired
            if (name === 'additions') return values.additions.length <= MAX_PARTY_FORM_FOOD_ADDITIONS
            if (name === 'cakeFlavours')
                return values.cakeFlavours.length > 0 && values.cakeFlavours.length <= MAX_CAKE_FLAVOURS
            const value = values[name]
            return typeof value === 'string' && value.trim().length > 0
        })
    }

    async function advance(target = currentStep + 1) {
        if (isAdvancing) return
        setIsAdvancing(true)
        try {
            const preceding = steps.slice(0, target)
            await Promise.all(
                preceding
                    .flatMap((item) => [...activeFields(item, form.state.values)])
                    .map((name) => form.validateField(name, 'submit'))
            )
            const invalidStep = preceding.findIndex((item) => !isStepComplete(item, form.state.values))
            if (invalidStep >= 0) {
                setCurrentStep(invalidStep)
                setStepError(true)
                requestAnimationFrame(() => errorRef.current?.focus())
                return
            }
            navigate(target)
        } finally {
            setIsAdvancing(false)
        }
    }

    if (currentStep === -1) return <PartyWelcome config={config} onStart={() => navigate(0)} />

    return (
        <>
            <form.Subscribe selector={(state) => [state.values, state.fieldMeta, state.isSubmitting] as const}>
                {([values, , isSubmitting]) => {
                    const firstIncomplete = steps.findIndex((item) => !isStepComplete(item, values))
                    return (
                        <PartyProgress
                            steps={steps}
                            current={currentStep}
                            onNavigate={(index) => (index < currentStep ? navigate(index) : void advance(index))}
                            lastReachable={firstIncomplete === -1 ? steps.length - 1 : firstIncomplete}
                            disabled={isSubmitting || isAdvancing}
                        />
                    )
                }}
            </form.Subscribe>
            <form
                className="party-form"
                onSubmit={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (isReview) void form.handleSubmit()
                    else void advance()
                }}
            >
                <div className="party-enter" key={step.key}>
                    <form.Subscribe selector={(state) => state.values.childName}>
                        {(childName) => (
                            <StepHeading
                                step={step.key === 'about' ? { ...step, title: `Tell us about ${childName}!` } : step}
                            />
                        )}
                    </form.Subscribe>
                </div>
                {stepError && (
                    <div className="party-step-error" role="alert" tabIndex={-1} ref={errorRef}>
                        Please fill out all of the questions correctly.
                    </div>
                )}
                <div hidden={step.key !== 'details'} className="party-step-body">
                    {/* Your details */}
                    <Section title="Your Details">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <form.Field
                                name="parentFirstName"
                                validators={{ onChange: required('Your first name is required') }}
                            >
                                {(field) => (
                                    <TextField field={field} label="Your First Name" autoComplete="given-name" />
                                )}
                            </form.Field>
                            <form.Field
                                name="parentLastName"
                                validators={{ onChange: required('Your last name is required') }}
                            >
                                {(field) => (
                                    <TextField field={field} label="Your Last Name" autoComplete="family-name" />
                                )}
                            </form.Field>
                        </div>
                    </Section>
                    <form.Subscribe selector={(state) => state.values.childName}>
                        {(childName) => (
                            <Section title={`${childName}'s details`}>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <form.Field
                                        name="childName"
                                        validators={{ onChange: required("The birthday child's name is required") }}
                                    >
                                        {(field) => (
                                            <TextField
                                                field={field}
                                                label="Birthday Child's Name"
                                                description="There is no need to include a last name here 😊"
                                            />
                                        )}
                                    </form.Field>
                                    <form.Field
                                        name="childAge"
                                        validators={{ onChange: required("The birthday child's age is required") }}
                                    >
                                        {(field) => <TextField field={field} label="Birthday Child's Age" />}
                                    </form.Field>
                                </div>
                            </Section>
                        )}
                    </form.Subscribe>

                    {isStudio && (
                        <Section title="Food package">
                            <form.Subscribe selector={(state) => state.values.foodPackage}>
                                {(foodPackage) => (
                                    <p>
                                        {foodPackage === 'include'
                                            ? 'You have chosen to include the food package.'
                                            : 'You have chosen to self-cater the party.'}
                                    </p>
                                )}
                            </form.Subscribe>
                            <p className="mt-3">ℹ️ You can change this selection later in the form.</p>
                        </Section>
                    )}

                    {/* Number of children */}
                    <Section title="How many children will be at the party?">
                        <div className="party-prose">
                            {isStudio ? (
                                <>
                                    <p>
                                        Please let us know the approximate number of children that will be attending, so
                                        we can make sure everything is ready for your child's party.
                                    </p>
                                    <p>
                                        You will only be charged for the exact number that attend on the day above 12.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>
                                        We will bring a few extra just in case, and you will only be charged for the
                                        number that attend on the day
                                    </p>
                                    <p>(Minimum 12) 🙂</p>
                                </>
                            )}
                        </div>
                        <form.Field
                            name="numberOfChildren"
                            validators={{ onChange: required('Please select the number of children') }}
                        >
                            {(field) =>
                                isStudio ? (
                                    <>
                                        <RadioGroup
                                            value={field.state.value}
                                            aria-label="Number of children"
                                            onValueChange={(value) => field.handleChange(value)}
                                            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                                        >
                                            {NUMBER_OF_CHILDREN_STUDIO.map((option) => (
                                                <OptionRow key={option} label={option}>
                                                    <RadioGroupItem value={option} />
                                                </OptionRow>
                                            ))}
                                        </RadioGroup>
                                        <FieldError field={field} />
                                    </>
                                ) : (
                                    <>
                                        <Select
                                            value={field.state.value}
                                            onValueChange={(value) => field.handleChange(value)}
                                        >
                                            <SelectTrigger className="w-40" aria-label="Number of children">
                                                <SelectValue placeholder="Select" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {NUMBER_OF_CHILDREN_MOBILE.map((option) => (
                                                    <SelectItem key={option} value={option}>
                                                        {option}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FieldError field={field} />
                                    </>
                                )
                            }
                        </form.Field>
                    </Section>
                </div>

                {/* Creations */}
                <div hidden={step.key !== 'creations'} className="party-step-body">
                    <form.Field
                        name="creations"
                        validators={{
                            onChange: ({ value }) =>
                                value.length === config.creationsRequired
                                    ? undefined
                                    : `You have selected ${value.length} creation. Please select exactly ${config.creationsRequired} to continue.`,
                        }}
                    >
                        {(field) => (
                            <>
                                <CreationPicker
                                    config={config}
                                    showError={stepError && step.key === 'creations'}
                                    value={field.state.value}
                                    onChange={field.handleChange}
                                />
                            </>
                        )}
                    </form.Field>
                </div>

                {/* Food package (studio only) */}
                {isStudio && (
                    <div hidden={step.key !== 'food'} className="party-step-body">
                        <Section title="Party Food Package">
                            <div className="party-prose">
                                <p>
                                    The party food package includes party pies and sausage rolls, as well as a bowl of
                                    seasonal fruit, rice crackers, corn chips, potato chips (crisps), chocolate wafers,
                                    cordial and water.
                                </p>
                                <p>
                                    If you do not want to include party food, you are more than welcome to self-cater
                                    the party yourself.
                                </p>
                            </div>
                            <h3 className="mb-3 font-semibold">Would you like to include the food package?</h3>
                            <form.Field
                                name="foodPackage"
                                validators={{ onChange: required('Please choose a food option') }}
                            >
                                {(field) => (
                                    <>
                                        <RadioGroup
                                            aria-label="Party food package"
                                            value={field.state.value}
                                            onValueChange={(value) =>
                                                field.handleChange(value as FormValues['foodPackage'])
                                            }
                                            className="gap-2"
                                        >
                                            <OptionRow label="Include the food package">
                                                <RadioGroupItem value="include" />
                                            </OptionRow>
                                            <OptionRow label="I will self-cater the party">
                                                <RadioGroupItem value="self-cater" />
                                            </OptionRow>
                                        </RadioGroup>
                                        <FieldError field={field} />
                                    </>
                                )}
                            </form.Field>
                        </Section>
                        <Section title="Additional Items">
                            <div className="party-prose">
                                <p>These items can be added on to your party menu.</p>
                                <p>
                                    If you have chosen to self cater the party, you can still add these items to your
                                    menu.
                                </p>
                                <p>Maximum three additional items.</p>
                                <p>
                                    Additional party food is for children only. You're very welcome to bring in any
                                    nut-free nibbles for adults if you like!
                                </p>
                            </div>
                            <h3 className="mb-3 font-semibold">A serving serves approximately 16 children.</h3>
                            <form.Field
                                name="additions"
                                validators={{
                                    onChange: ({ value }) =>
                                        value.length > MAX_PARTY_FORM_FOOD_ADDITIONS
                                            ? 'Please choose no more than three food additions'
                                            : undefined,
                                }}
                            >
                                {(field) => (
                                    <div className="grid gap-2">
                                        {PARTY_FORM_V2_ADDITIONS.map((addition) => (
                                            <OptionRow
                                                key={addition}
                                                label={PROD_ADDITIONS[addition].displayValueWithPrice}
                                                disabled={
                                                    !field.state.value.includes(addition) &&
                                                    field.state.value.length >= MAX_PARTY_FORM_FOOD_ADDITIONS
                                                }
                                            >
                                                <Checkbox
                                                    checked={field.state.value.includes(addition)}
                                                    disabled={
                                                        !field.state.value.includes(addition) &&
                                                        field.state.value.length >= MAX_PARTY_FORM_FOOD_ADDITIONS
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        field.handleChange(
                                                            checked
                                                                ? [...field.state.value, addition]
                                                                : field.state.value.filter((it) => it !== addition)
                                                        )
                                                    }
                                                />
                                            </OptionRow>
                                        ))}
                                    </div>
                                )}
                            </form.Field>
                        </Section>
                    </div>
                )}

                {/* Cake */}
                {config.canOrderCake && (
                    <div hidden={step.key !== 'cake'} className="party-step-body">
                        <Section title="Would you like to order an ice-cream cake directly through us?">
                            <div className="party-prose">
                                <p>Your ice-cream cake will be ready for you at the studio when you arrive.</p>
                                <p>You can even customise the cake with a message!</p>
                                <ul>
                                    <li>Small Ice Cream Cake (12-15 serves) $89.00</li>
                                    <li>Medium Ice Cream Cake (15-25 serves) $119.00</li>
                                    <li>Large Ice Cream Cake (25-35 serves) $149.00</li>
                                </ul>
                            </div>
                            <h3 className="mb-3 font-lilita text-xl">Payment</h3>
                            <div className="party-prose">
                                <p>The payment for your ice-cream cake is processed when you submit this form.</p>
                                <p>The rest of your party payment will be made at the end of the party.</p>
                            </div>
                        </Section>
                        <Section title="Which ice-cream cake would you like?">
                            {config.alreadyPurchased.cake && (
                                <AlreadyPurchased>
                                    <p>{config.alreadyPurchased.cake.selection}</p>
                                    <p>Size: {config.alreadyPurchased.cake.size}</p>
                                    <p>Flavours: {config.alreadyPurchased.cake.flavours.join(', ')}</p>
                                    <p>How to serve: {config.alreadyPurchased.cake.served}</p>
                                    <p>Candles: {config.alreadyPurchased.cake.candles}</p>
                                    <p>Message: {config.alreadyPurchased.cake.message || 'No message'}</p>
                                </AlreadyPurchased>
                            )}
                            <form.Field
                                name="cakeSelection"
                                validators={{ onChange: required('Please choose a cake option') }}
                            >
                                {(field) => (
                                    <>
                                        <RadioGroup
                                            aria-label="Cake design"
                                            value={field.state.value}
                                            onValueChange={(value) => field.handleChange(value)}
                                            className="grid gap-2 sm:grid-cols-2"
                                        >
                                            {[...PARTY_FORM_CAKES, BRING_OWN_CAKE].map((cake) => (
                                                <OptionRow key={cake} label={cake}>
                                                    <RadioGroupItem value={cake} />
                                                </OptionRow>
                                            ))}
                                        </RadioGroup>
                                        <FieldError field={field} />
                                    </>
                                )}
                            </form.Field>

                            <form.Subscribe selector={(state) => state.values.cakeSelection}>
                                {(cakeSelection) =>
                                    cakeSelection && cakeSelection !== BRING_OWN_CAKE ? (
                                        <div className="mt-6 flex flex-col gap-6">
                                            <div>
                                                <h3 className="mb-2 font-semibold">Which size would you like?</h3>
                                                <form.Field
                                                    name="cakeSize"
                                                    validators={{
                                                        onChangeListenTo: ['cakeSelection'],
                                                        onChange: ({ value, fieldApi }) => {
                                                            const cake = fieldApi.form.getFieldValue('cakeSelection')
                                                            if (cake && cake !== BRING_OWN_CAKE && !value) {
                                                                return 'Please choose a cake size'
                                                            }
                                                            return undefined
                                                        },
                                                    }}
                                                >
                                                    {(field) => (
                                                        <>
                                                            <RadioGroup
                                                                aria-label="Cake size"
                                                                value={field.state.value}
                                                                onValueChange={(value) =>
                                                                    field.handleChange(value as FormValues['cakeSize'])
                                                                }
                                                                className="gap-2"
                                                            >
                                                                {ObjectEntries(CAKE_SIZES).map(([size, option]) => (
                                                                    <OptionRow
                                                                        key={size}
                                                                        label={option.label}
                                                                        price={formatPrice(option.price)}
                                                                    >
                                                                        <RadioGroupItem value={size} />
                                                                    </OptionRow>
                                                                ))}
                                                            </RadioGroup>
                                                            <FieldError field={field} />
                                                        </>
                                                    )}
                                                </form.Field>
                                            </div>

                                            <div>
                                                <h3 className="mb-1 font-semibold">What flavours would you like?</h3>
                                                <p className="mb-2 text-sm text-gray-500">
                                                    You can select up to two flavours.
                                                </p>
                                                <form.Field
                                                    name="cakeFlavours"
                                                    validators={{
                                                        onChangeListenTo: ['cakeSelection'],
                                                        onChange: ({ value, fieldApi }) => {
                                                            const cake = fieldApi.form.getFieldValue('cakeSelection')
                                                            if (cake && cake !== BRING_OWN_CAKE && value.length === 0) {
                                                                return 'Please choose at least one flavour'
                                                            }
                                                            return undefined
                                                        },
                                                    }}
                                                >
                                                    {(field) => (
                                                        <>
                                                            <div className="grid gap-2 sm:grid-cols-2">
                                                                {PARTY_FORM_CAKE_FLAVOURS.map((flavour) => {
                                                                    const selected = field.state.value.includes(flavour)
                                                                    const limitReached =
                                                                        field.state.value.length >= MAX_CAKE_FLAVOURS
                                                                    return (
                                                                        <OptionRow
                                                                            key={flavour}
                                                                            label={flavour}
                                                                            disabled={!selected && limitReached}
                                                                        >
                                                                            <Checkbox
                                                                                checked={selected}
                                                                                disabled={!selected && limitReached}
                                                                                onCheckedChange={(checked) =>
                                                                                    field.handleChange(
                                                                                        checked
                                                                                            ? [
                                                                                                  ...field.state.value,
                                                                                                  flavour,
                                                                                              ]
                                                                                            : field.state.value.filter(
                                                                                                  (it) => it !== flavour
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
                                            </div>

                                            <div>
                                                <h3 className="mb-2 font-semibold">
                                                    How would you like you ice-cream cake to be served?
                                                </h3>
                                                <form.Field
                                                    name="cakeServed"
                                                    validators={{
                                                        onChangeListenTo: ['cakeSelection'],
                                                        onChange: ({ value, fieldApi }) => {
                                                            const cake = fieldApi.form.getFieldValue('cakeSelection')
                                                            if (cake && cake !== BRING_OWN_CAKE && !value) {
                                                                return 'Please choose a serving option'
                                                            }
                                                            return undefined
                                                        },
                                                    }}
                                                >
                                                    {(field) => (
                                                        <>
                                                            <RadioGroup
                                                                aria-label="How to serve the cake"
                                                                value={field.state.value}
                                                                onValueChange={(value) =>
                                                                    field.handleChange(
                                                                        value as FormValues['cakeServed']
                                                                    )
                                                                }
                                                                className="gap-2"
                                                            >
                                                                {ObjectEntries(CAKE_SERVED_OPTIONS).map(
                                                                    ([served, option]) => (
                                                                        <OptionRow
                                                                            key={served}
                                                                            label={option.label}
                                                                            price={
                                                                                option.price
                                                                                    ? formatPrice(option.price)
                                                                                    : undefined
                                                                            }
                                                                        >
                                                                            <RadioGroupItem value={served} />
                                                                        </OptionRow>
                                                                    )
                                                                )}
                                                            </RadioGroup>
                                                            <FieldError field={field} />
                                                        </>
                                                    )}
                                                </form.Field>
                                            </div>

                                            <div>
                                                <h3 className="mb-2 font-semibold">
                                                    Would you like us to include candles?
                                                </h3>
                                                <form.Field
                                                    name="cakeCandles"
                                                    validators={{
                                                        onChangeListenTo: ['cakeSelection'],
                                                        onChange: ({ value, fieldApi }) => {
                                                            const cake = fieldApi.form.getFieldValue('cakeSelection')
                                                            if (cake && cake !== BRING_OWN_CAKE && !value) {
                                                                return 'Please choose a candle option'
                                                            }
                                                            return undefined
                                                        },
                                                    }}
                                                >
                                                    {(field) => (
                                                        <>
                                                            <RadioGroup
                                                                aria-label="Candles"
                                                                value={field.state.value}
                                                                onValueChange={(value) =>
                                                                    field.handleChange(
                                                                        value as FormValues['cakeCandles']
                                                                    )
                                                                }
                                                                className="gap-2"
                                                            >
                                                                {ObjectEntries(CAKE_CANDLES_OPTIONS).map(
                                                                    ([candles, option]) => (
                                                                        <OptionRow
                                                                            key={candles}
                                                                            label={option.label}
                                                                            price={
                                                                                option.price
                                                                                    ? formatPrice(option.price)
                                                                                    : undefined
                                                                            }
                                                                        >
                                                                            <RadioGroupItem value={candles} />
                                                                        </OptionRow>
                                                                    )
                                                                )}
                                                            </RadioGroup>
                                                            <FieldError field={field} />
                                                        </>
                                                    )}
                                                </form.Field>
                                            </div>

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
                                        </div>
                                    ) : null
                                }
                            </form.Subscribe>
                        </Section>
                    </div>
                )}

                {/* Take home bags */}
                <div hidden={step.key !== 'goodies'} className="party-step-body">
                    <div className="party-prose">
                        <h2 className="font-lilita text-2xl">We are all about making your life easy!</h2>
                        <p>
                            Add an awesome take-home gift for your child's friends, and we will have it ready for you on
                            the day!
                        </p>
                    </div>
                    <Section title="Lolly Bags & Toy Bags">
                        {hasPurchasedItems(config.alreadyPurchased.takeHomeBags, config.alreadyPurchased.products) && (
                            <AlreadyPurchased>
                                {orderedQuantities(config.alreadyPurchased.takeHomeBags).map(([key, quantity]) => (
                                    <p key={key}>{`${quantity} ${TAKE_HOME_BAG_LABELS[key]}`}</p>
                                ))}
                                {orderedQuantities(config.alreadyPurchased.products).map(([key, quantity]) => (
                                    <p key={key}>{`${quantity} ${PRODUCTS[key].displayValue}s`}</p>
                                ))}
                            </AlreadyPurchased>
                        )}
                        <div className="flex flex-col gap-3">
                            {ObjectKeys(TAKE_HOME_BAGS).map((bag) => (
                                <form.Field key={bag} name={`takeHomeBags.${bag}`}>
                                    {(field) => (
                                        <QuantityRow
                                            label={TAKE_HOME_BAG_LABELS[bag]}
                                            price={`${formatPrice(TAKE_HOME_BAG_PRICE)} each`}
                                            value={field.state.value}
                                            onChange={(quantity) => field.handleChange(quantity)}
                                        />
                                    )}
                                </form.Field>
                            ))}
                        </div>
                    </Section>

                    <Section title={`Fizz Kidz Take-Home Gifts - ${PRODUCT_DISCOUNT_PERCENT}% off!`}>
                        <div className="party-prose">
                            <p>
                                As a Fizz VIP, enjoy {PRODUCT_DISCOUNT_PERCENT}% off our Fizz Kidz product range. (RRP:{' '}
                                {formatPrice(PRODUCT_RRP)}).
                            </p>
                            <p>Perfect for unique take home gifts for your childs friends.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                            {ObjectKeys(PRODUCTS).map((product) => (
                                <form.Field key={product} name={`products.${product}`}>
                                    {(field) => (
                                        <QuantityRow
                                            label={PRODUCTS[product].displayValue}
                                            price={`${formatPrice(PRODUCT_PRICE)} each`}
                                            value={field.state.value}
                                            onChange={(quantity) => field.handleChange(quantity)}
                                        />
                                    )}
                                </form.Field>
                            ))}
                        </div>
                    </Section>
                </div>

                {/* Fun facts + questions */}
                <div hidden={step.key !== 'about'} className="party-step-body">
                    <form.Subscribe selector={(state) => state.values.childName}>
                        {(childName) => (
                            <div className="party-prose">
                                <p>
                                    We aim to personalise our parties as much as we can. If there is anything specific
                                    you would like us to know about {childName}, please write it here.
                                </p>
                                <p>
                                    For example, does {childName} have a favourite song or TV show? Play a specific
                                    sport, dance or sing?
                                </p>
                                <p>Feel free to also list any songs you would like us to play during the party!</p>
                            </div>
                        )}
                    </form.Subscribe>
                    <div className="party-section">
                        <div className="flex flex-col gap-4">
                            <form.Field name="funFacts">
                                {(field) => <TextAreaField field={field} label="Fun Facts" />}
                            </form.Field>
                        </div>
                    </div>
                    <Section title="Finally, do you have any questions?">
                        <form.Field name="questions">
                            {(field) => (
                                <TextAreaField
                                    field={field}
                                    label="Your chance to ask us anything you still want to know!"
                                />
                            )}
                        </form.Field>
                    </Section>
                </div>

                {isReview && (
                    <form.Subscribe selector={(state) => [state.values, state.isSubmitting] as const}>
                        {([values, isSubmitting]) => (
                            <fieldset disabled={isSubmitting} aria-label="Review party details" className="min-w-0">
                                <PartyReview
                                    config={config}
                                    values={values}
                                    total={calculateTotal(values, config.canOrderCake)}
                                    onEdit={(key) => navigate(steps.findIndex((item) => item.key === key))}
                                />
                            </fieldset>
                        )}
                    </form.Subscribe>
                )}

                {submitError && (
                    <Alert variant="destructive" role="alert">
                        <AlertTitle>Something went wrong</AlertTitle>
                        <AlertDescription>
                            Something went wrong while trying to submit. Please try again.
                        </AlertDescription>
                    </Alert>
                )}

                <form.Subscribe selector={(state) => [state.values, state.isSubmitting] as const}>
                    {([values, isSubmitting]) => {
                        const total = calculateTotal(values, config.canOrderCake)
                        return (
                            <footer className="party-navigation">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => navigate(currentStep - 1)}
                                    disabled={isSubmitting || isAdvancing}
                                >
                                    <ArrowLeft size={16} aria-hidden="true" /> Back
                                </Button>
                                <div className="party-navigation-next">
                                    {total > 0 && (
                                        <span className="party-navigation-total">
                                            To pay today <strong>{formatPrice(total)}</strong>
                                        </span>
                                    )}
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="party-primary"
                                        disabled={isSubmitting || isAdvancing}
                                    >
                                        {isSubmitting ? 'Submitting...' : !isReview ? 'Next' : 'Submit'}
                                        {!isSubmitting && <ArrowRight size={17} aria-hidden="true" />}
                                    </Button>
                                </div>
                            </footer>
                        )
                    }}
                </form.Subscribe>
            </form>
        </>
    )
}

function hasPurchasedItems(...records: Partial<Record<string, number>>[]) {
    return records.some((record) => Object.values(record).some((quantity) => (quantity ?? 0) > 0))
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="party-section">
            <h2 className="font-lilita text-xl">{title}</h2>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
            <div className="mt-4">{children}</div>
        </section>
    )
}

function AlreadyPurchased({ children }: { children: React.ReactNode }) {
    return (
        <div className="party-note mb-5">
            <p className="mb-1 font-semibold">You have already purchased:</p>
            {children}
        </div>
    )
}

function OptionRow({
    label,
    price,
    disabled,
    children,
}: {
    label: string
    price?: string
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <Label
            className={cn('party-option', {
                'party-option-disabled': disabled,
            })}
        >
            {children}
            <span className="flex-1">{label}</span>
            {price && <span className="text-sm text-gray-500">{price}</span>}
        </Label>
    )
}

function QuantityRow({
    label,
    price,
    value,
    onChange,
}: {
    label: string
    price: string
    value: number
    onChange: (value: number) => void
}) {
    return (
        <div className="party-quantity-row">
            <div className="flex-1">
                <p>{label}</p>
                <p className="text-sm text-gray-500">{price}</p>
            </div>
            <div className="party-quantity-control" role="group" aria-label={`${label} quantity`}>
                <button
                    type="button"
                    aria-label={`Remove one ${label}`}
                    disabled={value === 0}
                    onClick={() => onChange(value - 1)}
                >
                    <Minus size={16} aria-hidden="true" />
                </button>
                <output aria-live="polite" aria-label={`${label} quantity`}>
                    {value}
                </output>
                <button
                    type="button"
                    aria-label={`Add one ${label}`}
                    disabled={value === 30}
                    onClick={() => onChange(value + 1)}
                >
                    <Plus size={16} aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}

type AnyStringField = {
    name: string
    state: { value: string; meta: { errors: unknown[]; isTouched: boolean } }
    handleChange: (value: string) => void
    handleBlur: () => void
}

function TextField({
    field,
    label,
    description,
    maxLength,
    autoComplete,
    placeholder,
}: {
    field: AnyStringField
    label: string
    description?: string
    maxLength?: number
    autoComplete?: string
    placeholder?: string
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={field.name}>{label}</Label>
            <Input
                id={field.name}
                name={field.name}
                autoComplete={autoComplete}
                placeholder={placeholder}
                aria-invalid={field.state.meta.errors.length > 0}
                aria-describedby={
                    [description && `${field.name}-hint`, field.state.meta.errors.length > 0 && `${field.name}-error`]
                        .filter(Boolean)
                        .join(' ') || undefined
                }
                value={field.state.value}
                maxLength={maxLength}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
            {description && (
                <p id={`${field.name}-hint`} className="text-sm text-gray-500">
                    {description}
                </p>
            )}
            <FieldError field={field} />
        </div>
    )
}

function TextAreaField({ field, label, description }: { field: AnyStringField; label: string; description?: string }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={field.name}>{label}</Label>
            {description && (
                <p id={`${field.name}-hint`} className="text-sm text-gray-500">
                    {description}
                </p>
            )}
            <Textarea
                id={field.name}
                name={field.name}
                rows={5}
                aria-describedby={description ? `${field.name}-hint` : undefined}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
            />
            <FieldError field={field} />
        </div>
    )
}

function FieldError({ field }: { field: { name?: string; state: { meta: { errors: unknown[] } } } }) {
    const error = field.state.meta.errors[0]
    if (!error) return null
    return (
        <p
            id={field.name ? `${field.name}-error` : undefined}
            role="alert"
            className="mt-1 text-sm font-medium text-red-600"
        >
            {String(error)}
        </p>
    )
}
