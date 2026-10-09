import { Info } from 'lucide-react'

import { MAX_PARTY_FORM_FOOD_ADDITIONS } from '@fizz-kidz/core'

import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group'

import { required, type FormValues } from '../../state/form'
import { usePartyConfig, usePartyFormApi } from '../../state/party-form-store'
import { OptionRow } from '../common/option-row'
import { Note, Prose, Section, StepBody } from '../common/section'
import { FieldError } from '../common/text-fields'
import { AdditionPicker } from './addition-picker'

export function FoodStep() {
    const form = usePartyFormApi()
    const config = usePartyConfig()
    return (
        <StepBody step="food">
            <Section title="Party Food Package">
                <Prose>
                    <p>
                        The party food package includes party pies and sausage rolls, as well as a bowl of seasonal
                        fruit, rice crackers, corn chips, potato chips (crisps), chocolate wafers, cordial and water.
                    </p>
                    <p>
                        If you do not want to include party food, you are more than welcome to self-cater the party
                        yourself.
                    </p>
                </Prose>
                <h3 className="mb-3 font-semibold">Would you like to include the food package?</h3>
                <form.Field name="foodPackage" validators={{ onChange: required('Please choose a food option') }}>
                    {(field) => (
                        <>
                            <RadioGroup
                                aria-label="Party food package"
                                value={field.state.value}
                                onValueChange={(value) => field.handleChange(value as FormValues['foodPackage'])}
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
                <Prose>
                    <p>These items can be added on to your party menu.</p>
                    <p>If you have chosen to self cater the party, you can still add these items to your menu.</p>
                    <p>Maximum three additional items.</p>
                    <p>
                        Additional party food is for children only. You're very welcome to bring in any nut-free nibbles
                        for adults if you like!
                    </p>
                </Prose>
                <Note className="mb-5 flex gap-3">
                    <Info size={18} className="mt-0.5 shrink-0 text-party-pink" aria-hidden="true" />
                    <p>
                        <strong className="font-semibold">
                            Additional items are paid for at the end of the party.
                        </strong>{' '}
                        You won't be charged for them now.{' '}
                    </p>
                </Note>
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
                        <AdditionPicker
                            additions={config.additions}
                            value={field.state.value}
                            onChange={field.handleChange}
                        />
                    )}
                </form.Field>
            </Section>
        </StepBody>
    )
}
