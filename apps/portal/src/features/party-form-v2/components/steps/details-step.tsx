import { Info, ShoppingBasket, UtensilsCrossed } from 'lucide-react'

import { NUMBER_OF_CHILDREN_MOBILE, NUMBER_OF_CHILDREN_STUDIO } from '@fizz-kidz/core'

import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select'

import { required, type FormValues } from '../../state/form'
import { usePartyConfig, usePartyFormApi } from '../../state/party-form-store'
import { OptionRow } from '../common/option-row'
import { Prose, Section, StepBody } from '../common/section'
import { FieldError, TextField } from '../common/text-fields'

export function DetailsStep() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    const isStudio = config.type === 'studio'
    return (
        <StepBody step="details">
            <Section title="Your Details">
                <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field
                        name="parentFirstName"
                        validators={{ onChange: required('Your first name is required') }}
                    >
                        {(field) => <TextField field={field} label="Your First Name" autoComplete="given-name" />}
                    </form.Field>
                    <form.Field name="parentLastName" validators={{ onChange: required('Your last name is required') }}>
                        {(field) => <TextField field={field} label="Your Last Name" autoComplete="family-name" />}
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
                        {(foodPackage) => <FoodPackageSummary value={foodPackage} />}
                    </form.Subscribe>
                    <p className="mt-3.5 flex items-center gap-[7px] text-[13px] text-party-muted">
                        <Info size={15} className="shrink-0" aria-hidden="true" />
                        You can change this later in the form.
                    </p>
                </Section>
            )}

            <Section title="How many children will be at the party?">
                <Prose>
                    {isStudio ? (
                        <>
                            <p>
                                Please let us know the approximate number of children that will be attending, so we can
                                make sure everything is ready for your child's party.
                            </p>
                            <p>You will only be charged for the exact number that attend on the day above 12.</p>
                        </>
                    ) : (
                        <>
                            <p>
                                We will bring a few extra just in case, and you will only be charged for the number that
                                attend on the day
                            </p>
                            <p>(Minimum 12) 🙂</p>
                        </>
                    )}
                </Prose>
                <form.Field
                    name="numberOfChildren"
                    validators={{ onChange: required('Please select the number of children') }}
                >
                    {(field) => (
                        <>
                            {isStudio ? (
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
                            ) : (
                                <Select value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
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
                            )}
                            <FieldError field={field} />
                        </>
                    )}
                </form.Field>
            </Section>
        </StepBody>
    )
}

const FOOD_PACKAGE_SUMMARY = {
    include: {
        title: 'Food package included',
        description: 'Party pies, sausage rolls, fruit, chips and cordial, all taken care of.',
        icon: UtensilsCrossed,
    },
    'self-cater': {
        title: 'Self-catering',
        description: 'You will bring along your own party food for the kids.',
        icon: ShoppingBasket,
    },
} as const

/** The booked food choice, shown for reference. It can only be changed on the food step. */
function FoodPackageSummary({ value }: { value: FormValues['foodPackage'] }) {
    const { title, description, icon: Icon } = FOOD_PACKAGE_SUMMARY[value === 'include' ? 'include' : 'self-cater']
    return (
        <div className="flex items-center gap-3.5 rounded-2xl border border-party-line bg-party-tint p-4 sm:gap-4 sm:px-5 sm:py-[18px]">
            <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] bg-party-pink text-white">
                <Icon size={22} aria-hidden="true" />
            </span>
            <div>
                <p className="font-semibold">{title}</p>
                <p className="text-[13px] leading-normal text-party-muted">{description}</p>
            </div>
        </div>
    )
}
