import { useStore } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { STUDIOS, capitalise } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Label } from '@shared/components/ui/label'

import {
    getExistingBookingValues,
    getNewBookingValues,
    useCreatePartyBookingForm,
    type PartyBookingFormApi,
} from '../../state/party-booking-form'
import { usePartyBookingsStore, type PartyBookingDialogState } from '../../state/party-bookings-store'
import { AdditionsField } from './additions-field'
import { ChildrenFields } from './children-fields'
import { CreationField } from './creation-field'
import { DateField, FormSection, SelectField, TextAreaField, TextField, TimeField } from './fields'

const PARTY_TYPE_OPTIONS = [
    { value: 'studio', label: 'Studio' },
    { value: 'mobile', label: 'Mobile' },
] as const

const PARTY_LENGTH_OPTIONS = [
    { value: '1', label: '1 hour' },
    { value: '1.5', label: '1.5 hours' },
    { value: '2', label: '2 hours' },
] as const

const FOOD_OPTIONS = [
    { value: 'include', label: 'Includes food' },
    { value: 'self-cater', label: 'Self-catered' },
] as const

const STUDIO_OPTIONS = STUDIOS.map((studio) => ({ value: studio, label: capitalise(studio) }))

/** Creates a party booking, or edits one, depending on what the dialog is showing. */
export function PartyBookingForm({ dialog }: { dialog: PartyBookingDialogState }) {
    const save = usePartyBookingsStore((state) => state.save)
    const closeDialog = usePartyBookingsStore((state) => state.closeDialog)
    const form = useCreatePartyBookingForm({
        mode: dialog.mode,
        defaultValues:
            dialog.mode === 'create' ? getNewBookingValues(dialog.prefill) : getExistingBookingValues(dialog.booking),
        onSubmit: save,
    })

    return (
        <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
            }}
        >
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
                    <ParentFields form={form} includeZoho={dialog.mode === 'create'} />
                    {dialog.mode === 'create' ? <ChildrenFields form={form} /> : <ChildFields form={form} />}
                    <PartyFields form={form} editing={dialog.mode === 'edit'} />
                    {dialog.mode === 'edit' && <PartyDetailsFields form={form} />}
                    <FormSection title="Notes">
                        <form.Field name="notes">
                            {(field) => <TextAreaField field={field} label="Staff notes" />}
                        </form.Field>
                        {dialog.mode === 'create' && (
                            <form.Field name="sendConfirmationEmail">
                                {(field) => (
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            id={field.name}
                                            checked={field.state.value}
                                            onCheckedChange={(checked) => field.handleChange(checked === true)}
                                        />
                                        <Label htmlFor={field.name} className="font-normal">
                                            Send the parent a confirmation email
                                        </Label>
                                    </div>
                                )}
                            </form.Field>
                        )}
                    </FormSection>
                </div>
            </div>
            <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-end gap-2">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                        Cancel
                    </Button>
                    <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(isSubmitting) => (
                            <Button type="submit" variant="darkPurple" disabled={isSubmitting} className="min-w-32">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {dialog.mode === 'create' ? 'Book party' : 'Save changes'}
                            </Button>
                        )}
                    </form.Subscribe>
                </div>
            </div>
        </form>
    )
}

function ParentFields({ form, includeZoho }: { form: PartyBookingFormApi; includeZoho: boolean }) {
    return (
        <FormSection title="Parent">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <form.Field name="parentFirstName">
                    {(field) => <TextField field={field} label="First name" autoComplete="off" />}
                </form.Field>
                <form.Field name="parentLastName">
                    {(field) => <TextField field={field} label="Last name" autoComplete="off" />}
                </form.Field>
                <form.Field name="parentEmail">
                    {(field) => <TextField field={field} label="Email" type="email" autoComplete="off" />}
                </form.Field>
                <form.Field name="parentMobile">
                    {(field) => <TextField field={field} label="Mobile" type="tel" autoComplete="off" />}
                </form.Field>
                {includeZoho && (
                    <form.Field name="zohoDealId">
                        {(field) => (
                            <TextField
                                field={field}
                                label="Zoho deal ID"
                                description="Optional. Links the booking to an existing deal."
                                autoComplete="off"
                            />
                        )}
                    </form.Field>
                )}
            </div>
        </FormSection>
    )
}

function ChildFields({ form }: { form: PartyBookingFormApi }) {
    return (
        <FormSection title="Birthday child">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
                <form.Field name="childName">
                    {(field) => (
                        <TextField
                            field={field}
                            label="Name"
                            description="Separate multiple children with commas."
                            autoComplete="off"
                        />
                    )}
                </form.Field>
                <form.Field name="childAge">{(field) => <TextField field={field} label="Turning" />}</form.Field>
            </div>
        </FormSection>
    )
}

function PartyFields({ form, editing }: { form: PartyBookingFormApi; editing: boolean }) {
    const type = useStore(form.store, (state) => state.values.type)

    return (
        <FormSection title="Party">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* the calendar event lives with the studio and type, so they're fixed once booked */}
                <form.Field
                    name="type"
                    listeners={{
                        onChange: () => {
                            form.setFieldValue('address', '')
                            form.setFieldValue('foodPackage', '')
                        },
                    }}
                >
                    {(field) => (
                        <SelectField field={field} label="Type" options={PARTY_TYPE_OPTIONS} disabled={editing} />
                    )}
                </form.Field>
                <form.Field name="location">
                    {(field) => (
                        <SelectField field={field} label="Studio" options={STUDIO_OPTIONS} disabled={editing} />
                    )}
                </form.Field>
                <form.Field name="partyLength">
                    {(field) => (
                        <SelectField
                            field={field}
                            label="Length"
                            options={PARTY_LENGTH_OPTIONS}
                            className="col-span-2 sm:col-span-2"
                        />
                    )}
                </form.Field>
                <form.Field name="date">
                    {(field) => <DateField field={field} label="Date" className="col-span-2" />}
                </form.Field>
                <form.Field name="time">
                    {(field) => <TimeField field={field} label="Start time" className="col-span-2" />}
                </form.Field>
                {type === 'mobile' && (
                    <form.Field name="address">
                        {(field) => (
                            <TextField field={field} label="Party address" className="col-span-2 sm:col-span-4" />
                        )}
                    </form.Field>
                )}
                {type === 'studio' && (
                    <form.Field name="foodPackage">
                        {(field) => (
                            <SelectField
                                field={field}
                                label="Food package"
                                options={FOOD_OPTIONS}
                                className="col-span-2"
                            />
                        )}
                    </form.Field>
                )}
                {editing && (
                    <form.Field name="numberOfChildren">
                        {(field) => (
                            <TextField
                                field={field}
                                label="Number of children"
                                inputMode="numeric"
                                className="col-span-2"
                            />
                        )}
                    </form.Field>
                )}
            </div>
        </FormSection>
    )
}

/** What the parent tells us in their party form: creations, food additions, questions and fun facts. */
function PartyDetailsFields({ form }: { form: PartyBookingFormApi }) {
    const trpc = useTRPC()
    const catalogue = useQuery(trpc.creations.getBirthdayPartyBookingCatalogue.queryOptions())
    const type = useStore(form.store, (state) => state.values.type)

    return (
        <>
            <FormSection title="Creations">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {([0, 1, 2] as const).map((index) => (
                        <form.Field key={index} name={`creations[${index}]`}>
                            {(field) => (
                                <CreationField
                                    field={field}
                                    label={`Creation ${index + 1}`}
                                    catalogue={catalogue.data}
                                    status={catalogue.status}
                                    channel={type || 'studio'}
                                />
                            )}
                        </form.Field>
                    ))}
                </div>
            </FormSection>
            {type === 'studio' && (
                <FormSection title="Food additions">
                    <form.Field name="additions">{(field) => <AdditionsField field={field} />}</form.Field>
                </FormSection>
            )}
            <FormSection title="From the parent">
                <form.Field name="questions">
                    {(field) => <TextAreaField field={field} label="Questions" rows={4} />}
                </form.Field>
                <form.Field name="funFacts">
                    {(field) => <TextAreaField field={field} label="Fun facts" rows={4} />}
                </form.Field>
            </FormSection>
        </>
    )
}
