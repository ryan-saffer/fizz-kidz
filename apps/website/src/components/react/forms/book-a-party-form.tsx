import { zodResolver } from '@hookform/resolvers/zod'
import { CircleCheckBig, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import {
    PartyFormLocationOptions,
    PartyThemeOptions,
    PartyWebsiteFormSchema,
    ReferenceOptions,
    type WebsiteForm,
} from '@fizz-kidz/core'

import { Button } from '../ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Input } from '../ui/input'
import { SelectContent, SelectForm, SelectItem, SelectValue } from '../ui/select'
import { Toaster } from '../ui/sonner'
import { Textarea } from '../ui/textarea'

import { submitWebsiteForm } from '@/utils/website-forms'

function BookAPartyForm() {
    const form = useForm<WebsiteForm['party']>({
        resolver: zodResolver(PartyWebsiteFormSchema),
        defaultValues: {
            name: '',
            email: '',
            contactNumber: '',
            location: undefined,
            suburb: '',
            preferredDateAndTime: '',
            enquiry: '',
            reference: undefined,
            referenceOther: '',
        },
    })

    const [loading, setLoading] = useState(false)
    async function onSubmit(values: WebsiteForm['party']) {
        if (loading) return
        setLoading(true)

        try {
            await submitWebsiteForm('party', values)

            window.dataLayer = window.dataLayer || []
            window.dataLayer.push({
                event: 'lead_submit',
                studio: values.location,
            })
        } catch (err) {
            console.error({ err })
            toast.error(
                "There was an error submitting the form. Please send us an email at 'bookings@fizzkidz.com.au'."
            )
            return
        } finally {
            setLoading(false)
        }

        form.reset({ location: undefined, suburb: '' })
        toast.success(
            <div className="flex gap-4">
                <CircleCheckBig className="mt-1 h-4 w-4" />
                <div>
                    <p className="font-semibold">Enquiry recieved!</p>
                    <p>We aim to get back to every enquiry within the same business day. 😄</p>
                </div>
            </div>,
            {
                duration: 15_000,
            }
        )
    }

    return (
        <Form {...form}>
            <Toaster richColors closeButton />
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" aria-busy={loading}>
                <fieldset disabled={loading} className="contents">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your name *</FormLabel>
                                <FormControl>
                                    <Input
                                        className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your email *</FormLabel>
                                <FormControl>
                                    <Input
                                        className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="contactNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your best contact number *</FormLabel>
                                <FormControl>
                                    <Input
                                        className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <SelectForm
                                    label="Where would you like the party?"
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    value={field.value}
                                >
                                    <SelectValue />
                                    <SelectContent>
                                        {PartyFormLocationOptions.map(({ value, label }) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </SelectForm>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {form.watch('location') === 'at-home' && (
                        <FormField
                            control={form.control}
                            name="suburb"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Which suburb do you live in? *</FormLabel>
                                    <FormControl>
                                        <Input
                                            className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <FormField
                        control={form.control}
                        name="preferredDateAndTime"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Preferred date and time *</FormLabel>
                                <FormControl>
                                    <Input
                                        className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="partyTheme"
                        render={({ field }) => (
                            <FormItem>
                                <SelectForm
                                    label="Which party theme are you interested in?"
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    value={field.value}
                                >
                                    <SelectValue />
                                    <SelectContent>
                                        {PartyThemeOptions.map(({ value, label }) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </SelectForm>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="enquiry"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Your enquiry *</FormLabel>
                                <FormControl>
                                    <Textarea
                                        className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                        rows={5}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="reference"
                        render={({ field }) => (
                            <FormItem>
                                <SelectForm
                                    label="How did you hear about us?"
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <SelectValue />
                                    <SelectContent>
                                        {ReferenceOptions.map(({ value, label }) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </SelectForm>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {form.watch('reference') === 'other' && (
                        <FormField
                            control={form.control}
                            name="referenceOther"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ooh interesting! Please share 🙏</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            className="rounded-xl border-violet-500 focus-visible:outline-purple-700"
                                            rows={2}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                    <Button
                        className="!mt-8 w-full rounded-full bg-[#9044E2] hover:bg-[#a56ae6] focus-visible:outline-purple-500"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Submit'}
                    </Button>
                </fieldset>
            </form>
        </Form>
    )
}

export default BookAPartyForm
