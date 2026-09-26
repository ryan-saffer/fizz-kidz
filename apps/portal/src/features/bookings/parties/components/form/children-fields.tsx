import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@shared/components/ui/button'

import { emptyChild, getAgeTurning, type PartyBookingFormApi } from '../../state/party-booking-form'
import { DateField, FormSection, TextField } from './fields'

/** Each birthday child on a new booking. Picking a birthday fills in the age they're turning. */
export function ChildrenFields({ form }: { form: PartyBookingFormApi }) {
    return (
        <form.Field name="children" mode="array">
            {(children) => (
                <FormSection
                    title={children.state.value.length > 1 ? 'Birthday children' : 'Birthday child'}
                    action={
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => children.pushValue(emptyChild())}
                        >
                            <Plus className="mr-1 h-4 w-4" />
                            Add child
                        </Button>
                    }
                >
                    {children.state.value.map((_, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-[1fr_1fr_7rem_auto]"
                        >
                            <form.Field name={`children[${index}].name`}>
                                {(field) => <TextField field={field} label="Name" autoComplete="off" />}
                            </form.Field>
                            <form.Field
                                name={`children[${index}].birthday`}
                                listeners={{
                                    onChange: ({ value }) =>
                                        form.setFieldValue(`children[${index}].age`, getAgeTurning(value)),
                                }}
                            >
                                {(field) => <DateField field={field} label="Birthday" birthday />}
                            </form.Field>
                            <form.Field name={`children[${index}].age`}>
                                {(field) => <TextField field={field} label="Turning" inputMode="numeric" />}
                            </form.Field>
                            <div className="flex items-end">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Remove child ${index + 1}`}
                                    disabled={children.state.value.length === 1}
                                    onClick={() => children.removeValue(index)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </FormSection>
            )}
        </form.Field>
    )
}
