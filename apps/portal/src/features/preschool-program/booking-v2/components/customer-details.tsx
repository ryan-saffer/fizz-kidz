import { DateCalendar } from '@mui/x-date-pickers'
import { format } from 'date-fns'
import { ref as firebaseRef, uploadBytesResumable } from 'firebase/storage'
import { CalendarIcon, ChevronLeft, CircleX, Plus } from 'lucide-react'
import { Fragment, useRef, useState } from 'react'
import { useFieldArray, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { PRESCHOOL_PROGRAM_POLICY } from '@fizz-kidz/core'

import useFirebase from '@integrations/firebase/use-firebase'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@shared/components/ui/alert-dialog'
import { Button } from '@shared/components/ui/button'
import { Checkbox } from '@shared/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@shared/components/ui/form'
import { Input } from '@shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover'
import { Progress } from '@shared/components/ui/progress'
import { Separator } from '@shared/components/ui/separator'
import { Textarea } from '@shared/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip'
import { cn } from '@shared/lib/tailwind'

import { useCart } from '../state/cart-store'
import { useBookingForm, type PreschoolProgramV2BookingForm } from '../state/form-schema'
import { useFormStage } from '../state/form-stage-store'
import { PreschoolProgramCancellationPolicy } from './cancellation-policy'
import { PreschoolProgramTermsAndConditions } from './terms-and-conditions'

import type { DateTime } from 'luxon'

export function CustomerDetails() {
    const form = useBookingForm()
    const { formStage, nextStage, previousStage } = useFormStage()
    const selectedClasses = useCart((store) => store.selectedClasses)
    const setChildCount = useCart((store) => store.setChildCount)
    const watchedChildren = useWatch({ control: form.control, name: 'children' }) ?? []
    const [showNotEnoughSpotsDialog, setShowNotEnoughSpotsDialog] = useState(false)
    const [openCalendars, setOpenCalendars] = useState<Record<string, boolean>>({})
    const [showTermsAndConditions, setShowTermsAndConditions] = useState(false)
    const [showCancellationPolicy, setShowCancellationPolicy] = useState(false)

    const {
        fields: children,
        append,
        remove,
    } = useFieldArray({
        control: form.control,
        name: 'children',
    })

    function appendChild() {
        const nextChildCount = form.getValues().children.length + 1
        const foundFullClass = Object.values(selectedClasses).some((klass) => klass.slotsAvailable < nextChildCount)

        if (foundFullClass) {
            setShowNotEnoughSpotsDialog(true)
            return
        }

        append(
            {
                firstName: '',
                lastName: '',
                dob: undefined as unknown as Date,
                hasAllergies: null,
                allergies: undefined,
                isAnaphylactic: null,
                anaphylaxisPlan: undefined,
                additionalInfo: undefined,
            },
            { shouldFocus: true }
        )
        setChildCount(nextChildCount)
    }

    function removeChild(idx: number) {
        const nextChildCount = Math.max(1, form.getValues().children.length - 1)
        remove(idx)
        setChildCount(nextChildCount)
    }

    if (formStage !== 'form') return null

    return (
        <form className="mt-4 flex flex-col gap-4" onSubmit={form.handleSubmit(nextStage)}>
            <Button variant="outline" size="sm" type="button" onClick={previousStage} className="self-start">
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to sessions
            </Button>

            <SectionBreak title="Parent Details" />
            <FormField
                control={form.control}
                name="parentFirstName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Parent First Name</FormLabel>
                        <FormControl>
                            <Input {...field} autoFocus />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="parentLastName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Parent Last Name</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="parentEmailAddress"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Parent Email</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="parentPhone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Parent Phone Number</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <SectionBreak title={`${children.length > 1 ? 'Children' : 'Child'} Details`} />
            {children.map((child, idx) => {
                const watchedChild = watchedChildren[idx] ?? form.getValues(`children.${idx}`)
                const childName = watchedChild?.firstName || 'this child'

                return (
                    <Fragment key={child.id}>
                        {children.length > 1 ? (
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium">Child {idx + 1}</h3>
                                <TooltipProvider delayDuration={150}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                type="button"
                                                onClick={() => removeChild(idx)}
                                            >
                                                <CircleX className="h-4 w-4" color="#E16A92" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Remove child</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        ) : null}
                        <FormField
                            control={form.control}
                            name={`children.${idx}.firstName` as const}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Child First Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`children.${idx}.lastName` as const}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Child Last Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name={`children.${idx}.dob` as const}
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date of Birth</FormLabel>
                                    <Popover
                                        open={openCalendars[child.id]}
                                        onOpenChange={(open) =>
                                            setOpenCalendars((prev) => ({ ...prev, [child.id]: open }))
                                        }
                                    >
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        'w-[240px] pl-3 text-left font-normal',
                                                        !field.value && 'text-muted-foreground'
                                                    )}
                                                >
                                                    {field.value ? (
                                                        format(field.value, 'PPP')
                                                    ) : (
                                                        <span>Pick a date</span>
                                                    )}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <DateCalendar
                                                openTo="year"
                                                onChange={(date: DateTime | null, state) => {
                                                    if (date && state === 'finish') {
                                                        field.onChange(date.toJSDate())
                                                        setOpenCalendars((prev) => ({ ...prev, [child.id]: false }))
                                                    }
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <YesNoField
                            name={`children.${idx}.hasAllergies` as const}
                            label={`Does ${childName} have any allergies?`}
                            onNo={() => {
                                form.setValue(`children.${idx}.allergies`, undefined)
                                form.setValue(`children.${idx}.isAnaphylactic`, null)
                                form.setValue(`children.${idx}.anaphylaxisPlan`, undefined)
                            }}
                        />
                        {watchedChild?.hasAllergies ? (
                            <>
                                <FormField
                                    control={form.control}
                                    name={`children.${idx}.allergies` as const}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Please enter {childName}'s allergies here</FormLabel>
                                            <FormControl>
                                                <Textarea {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <YesNoField
                                    name={`children.${idx}.isAnaphylactic` as const}
                                    label={`Is ${childName} anaphylactic?`}
                                    onNo={() => form.setValue(`children.${idx}.anaphylaxisPlan`, undefined)}
                                />
                            </>
                        ) : null}
                        {watchedChild?.isAnaphylactic ? (
                            <FormField
                                control={form.control}
                                name={`children.${idx}.anaphylaxisPlan` as const}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Please upload {childName}'s anaphylaxis plan</FormLabel>
                                        <FormControl>
                                            <AnaphylaxisPlanUpload
                                                value={field.value}
                                                onChange={field.onChange}
                                                childIndex={idx}
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground">
                                            PDF only. Maximum file size is 5MB.
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ) : null}
                        <FormField
                            control={form.control}
                            name={`children.${idx}.additionalInfo` as const}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Is there additional information you would like us to know about {childName}?
                                    </FormLabel>
                                    <FormControl>
                                        <Textarea {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </Fragment>
                )
            })}
            <Button
                className="border-2 border-dashed bg-slate-50"
                type="button"
                variant="outline"
                onClick={appendChild}
            >
                {form.getValues('children').length === 0 ? 'Add child' : 'Add another child'}
                <Plus className="ml-2 h-4 w-4" />
            </Button>

            <SectionBreak title="Emergency Contact" />
            <p className="text-sm text-slate-600">This person will be contacted if we cannot get hold of you.</p>
            <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Emergency Contact Name</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="emergencyContactRelation"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Emergency Contact Relation</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="emergencyContactNumber"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Emergency Contact Number</FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Separator />
            <FormField
                control={form.control}
                name="termsAndConditions"
                render={({ field }) => (
                    <FormItem>
                        <div className="flex items-start space-x-3">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1">
                                <FormLabel className="cursor-pointer">
                                    I have read and agree to the{' '}
                                    <button
                                        type="button"
                                        className="text-primary hover:underline"
                                        onClick={() => setShowCancellationPolicy(true)}
                                    >
                                        Cancellation and rescheduling policy
                                    </button>{' '}
                                    and the{' '}
                                    <button
                                        type="button"
                                        className="text-primary hover:underline"
                                        onClick={() => setShowTermsAndConditions(true)}
                                    >
                                        Terms and Conditions
                                    </button>
                                    .
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </div>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="joinMailingList"
                render={({ field }) => (
                    <FormItem>
                        <div className="flex items-start space-x-3">
                            <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="cursor-pointer">
                                Keep me informed about the latest Fizz Kidz programs and offers.
                            </FormLabel>
                        </div>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <Button type="submit" className="font-semibold">
                Continue to payment
            </Button>
            <Dialog open={showTermsAndConditions} onOpenChange={setShowTermsAndConditions}>
                <DialogContent className="twp max-h-[80vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Terms and Conditions</DialogTitle>
                    </DialogHeader>
                    <PreschoolProgramTermsAndConditions />
                </DialogContent>
            </Dialog>
            <Dialog open={showCancellationPolicy} onOpenChange={setShowCancellationPolicy}>
                <DialogContent className="twp max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{PRESCHOOL_PROGRAM_POLICY.title}</DialogTitle>
                    </DialogHeader>
                    <PreschoolProgramCancellationPolicy />
                </DialogContent>
            </Dialog>
            <AlertDialog open={showNotEnoughSpotsDialog} onOpenChange={setShowNotEnoughSpotsDialog}>
                <AlertDialogContent className="twp">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Not enough spots available</AlertDialogTitle>
                        <AlertDialogDescription>
                            One or more of the sessions you selected does not have enough spots for another child. You
                            can change your selected sessions by going back to the session selection step.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction>Got it</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </form>
    )
}

function YesNoField({
    name,
    label,
    onNo,
}: {
    name: `children.${number}.hasAllergies` | `children.${number}.isAnaphylactic`
    label: string
    onNo?: () => void
}) {
    const form = useBookingForm()

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={field.value === true ? 'default' : 'outline'}
                            onClick={() => field.onChange(true)}
                        >
                            Yes
                        </Button>
                        <Button
                            type="button"
                            variant={field.value === false ? 'default' : 'outline'}
                            onClick={() => {
                                field.onChange(false)
                                onNo?.()
                            }}
                        >
                            No
                        </Button>
                    </div>
                    <FormMessage />
                </FormItem>
            )}
        />
    )
}

function AnaphylaxisPlanUpload({
    value,
    onChange,
    childIndex,
}: {
    value: PreschoolProgramV2BookingForm['children'][number]['anaphylaxisPlan']
    onChange: (value: PreschoolProgramV2BookingForm['children'][number]['anaphylaxisPlan']) => void
    childIndex: number
}) {
    const firebase = useFirebase()
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    /** Validates an uploaded anaphylaxis plan as a PDF within the configured size limit. */
    function isValidFile(file: File) {
        if (file.type !== 'application/pdf') {
            toast.error('File must be a PDF')
            return false
        }

        if (file.size >= 5_000_000) {
            toast.error('Anaphylaxis plan must be smaller than 5MB')
            return false
        }

        return true
    }

    function clearInput() {
        if (inputRef.current) inputRef.current.value = ''
    }

    function upload(file: File) {
        if (!isValidFile(file)) {
            clearInput()
            return
        }

        setUploading(true)
        setUploadProgress(0)

        const storagePath = `anaphylaxisPlans/preschool-v2-child-${childIndex + 1}-${crypto.randomUUID()}-${file.name}`
        const storageRef = firebaseRef(firebase.storage, storagePath)
        const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf' })

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
            },
            (error) => {
                console.error('error uploading anaphylaxis plan', error)
                setUploading(false)
                clearInput()
                toast.error('Error occurred during upload')
            },
            () => {
                setUploading(false)
                onChange({ fileName: file.name, storagePath })
            }
        )
    }

    return (
        <div className="flex flex-col gap-2">
            <Input
                ref={inputRef}
                type="file"
                accept=".pdf"
                disabled={uploading}
                onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) upload(file)
                }}
            />
            {uploading ? <Progress value={uploadProgress} /> : null}
            {value ? (
                <div className="flex items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-sm">
                    <span className="truncate">{value.fileName}</span>
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                            onChange(undefined)
                            clearInput()
                        }}
                    >
                        Remove
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

function SectionBreak({ title }: { title: string }) {
    return (
        <div className="flex items-center">
            <Separator className="mr-4 w-fit grow" />
            <h3 className="text-lg font-medium">{title}</h3>
            <Separator className="ml-4 w-fit grow" />
        </div>
    )
}
