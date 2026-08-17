import 'typeface-roboto'
import {
    Box,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputLabel,
    ListSubheader,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { DatePicker, TimePicker } from '@mui/x-date-pickers'
import { useMutation } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import React, { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import {
    ACTIVE_CREATIONS,
    CREATION_PACKAGE_DISPLAY_NAMES,
    CREATION_PACKAGES,
    CREATIONS,
    FormBookingFields,
    ObjectKeys,
    PARTY_LOST_REASONS,
    PRODUCTS,
    PROD_ADDITIONS,
    STUDIOS,
    TAKE_HOME_BAGS,
    capitalise,
    getInvitationEntryUrl,
    getInvitationShareUrl,
    isObjKey,
} from '@fizz-kidz/core'
import type { FirestoreBooking, FormBooking, PartyLostReason, WithId } from '@fizz-kidz/core'

import { useDateNavigation } from '@features/bookings/date-navigation/date-navigation.hooks'
import EditFormButtons from '@features/bookings/shared/edit-form-buttons'
import { useTRPC } from '@integrations/trpc'
import { useConfirm } from '@shared/components/dialogs/confirmation/use-confirmation-dialog'
import WithConfirmationDialog from '@shared/components/dialogs/legacy/ConfirmationDialog'
import type { ConfirmationDialogProps } from '@shared/components/dialogs/legacy/ConfirmationDialog'
import WithErrorDialog from '@shared/components/dialogs/legacy/ErrorDialog'
import type { ErrorDialogProps } from '@shared/components/dialogs/legacy/ErrorDialog'

import { mapFirestoreBookingToFormValues, mapFormToBooking } from '../utilities'
import { validateFormOnChange, validateFormOnSubmit } from '../validation'

import type { ExistingBookingFormFields } from './types'
import type { ChangeEvent } from 'react'

const PREFIX = 'index'

const classes = {
    disabled: `${PREFIX}-disabled`,
}

const Root = styled('div')({
    [`& .${classes.disabled}`]: {
        '& .Mui-disabled': {
            WebkitTextFillColor: 'rgba(0, 0, 0, 0.87)',
        },
    },
})

interface ExistingBookingFormProps extends ConfirmationDialogProps, ErrorDialogProps {
    booking: WithId<FirestoreBooking>
}

const InnerExistingBookingForm: React.FC<ExistingBookingFormProps> = ({
    booking,
    displayError,
    showConfirmationDialog,
}) => {
    const trpc = useTRPC()
    const confirm = useConfirm()
    const mappedBooking = useMemo(() => mapFirestoreBookingToFormValues(booking), [booking])
    const [draftFormValues, setDraftFormValues] = useState<ExistingBookingFormFields | null>(null)

    const updateBookingMutation = useMutation(trpc.parties.updatePartyBooking.mutationOptions())
    const deleteBookingMutation = useMutation(trpc.parties.deletePartyBooking.mutationOptions())
    const getPartyFormUrl = useMutation(trpc.parties.getPartyFormUrl.mutationOptions())
    const getCakeFormUrl = useMutation(trpc.parties.getCakeFormUrl.mutationOptions())
    const resendPartyBookingConfirmationEmail = useMutation(
        trpc.parties.resendPartyBookingConfirmationEmail.mutationOptions()
    )

    const { setDate } = useDateNavigation()

    const [editing, setEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const formValues = draftFormValues ?? mappedBooking

    const displayAddress = formValues.type.value === 'mobile'
    const displayDateTimeLocation = editing
    const displayDateTimeLocationHeading = displayDateTimeLocation || displayAddress
    const displayNumberOfChildren = formValues.numberOfChildren.value || editing
    const displayNotes = formValues.notes.value || editing
    const displayCreation1 = formValues.creation1.value || editing
    const displayCreation2 = formValues.creation2.value || editing
    const displayCreation3 = formValues.creation3.value || editing
    const displayCreationHeading = displayCreation1 || displayCreation2 || displayCreation3
    // const displayMenu = formValues.menu?.value || editing
    const displayCake = !!booking.cake
    const displayQuestions = formValues.questions.value || editing
    const displayFunFacts = formValues.funFacts.value || editing
    const displayQuestionsCommentsFunFactsHeading = displayQuestions || displayFunFacts
    let additionSelected = false
    for (const addition of ObjectKeys(PROD_ADDITIONS)) {
        if (formValues[addition].value) {
            additionSelected = true
        }
    }
    const displayAdditions = additionSelected || editing
    const displayTakeHomeBags = ObjectKeys(booking.takeHomeBags || {}).length > 0
    const displayProducts = ObjectKeys(booking.products || {}).length > 0

    const handleEdit = () => {
        setDraftFormValues(cloneFormValues(mappedBooking))
        setEditing(true)
    }

    const cancelEdit = () => {
        setDraftFormValues(null)
        setEditing(false)
    }

    const handleFormChange = (e: any) => {
        if (isObjKey(e.target.name, formValues)) {
            updateFormValues(e.target.name, e.target.value)
        }
    }

    const handleFormDateChange = (date: DateTime) => {
        updateFormValues('date', date.toJSDate())
    }

    const handleFormTimeChange = (date: DateTime) => {
        updateFormValues('time', date.toJSDate())
    }

    const handleFormCheckboxChange = (e: ChangeEvent<any>) => {
        if (isObjKey(e.target.name, formValues)) {
            updateFormValues(e.target.name, e.target.checked)
        }
    }

    const getCreationMenuItems = useCallback((selectedCreation: string | undefined) => {
        type CreationPackage = keyof typeof CREATION_PACKAGES
        const creationPackageEntries = Object.entries(CREATION_PACKAGES) as [
            CreationPackage,
            (typeof CREATION_PACKAGES)[CreationPackage],
        ][]

        const activeCreationMenuItems = creationPackageEntries.flatMap(([packageKey, creations]) => [
            <ListSubheader key={packageKey}>{CREATION_PACKAGE_DISPLAY_NAMES[packageKey]}</ListSubheader>,
            ...Object.entries(creations)
                .sort(([, a], [, b]) => a.localeCompare(b))
                .map(([creation, displayValue]) => (
                    <MenuItem key={`${packageKey}-${creation}`} value={creation}>
                        {displayValue}
                    </MenuItem>
                )),
        ])

        const legacyCreationMenuItems: React.ReactNode[] = []

        if (
            selectedCreation &&
            isObjKey(selectedCreation, CREATIONS) &&
            !isObjKey(selectedCreation, ACTIVE_CREATIONS)
        ) {
            legacyCreationMenuItems.push(
                <ListSubheader key="previously-selected">Previously Selected</ListSubheader>,
                <MenuItem key={selectedCreation} value={selectedCreation}>
                    {CREATIONS[selectedCreation]}
                </MenuItem>
            )
        }

        return [
            <MenuItem key={''} value={''}>
                <em>None</em>
            </MenuItem>,
            ...legacyCreationMenuItems,
            ...activeCreationMenuItems,
        ]
    }, [])

    function updateFormValues<K extends keyof FormBooking>(field: K, value: FormBooking[K]) {
        if (value !== null) {
            let formCopy = cloneFormValues(draftFormValues ?? mappedBooking)
            const prop = formCopy[field]
            if (prop) prop.value = value
            formCopy = validateFormOnChange(formCopy, field, value) as ExistingBookingFormFields

            // clear the value and errors of the address field if it is no longer required
            if (field === FormBookingFields.location && value !== 'mobile') {
                formCopy.address.value = ''
                formCopy.address.error = false
            }

            setDraftFormValues(formCopy)
        }
    }

    const handleSubmit = async () => {
        let tmpFormValues = cloneFormValues(formValues)
        tmpFormValues = validateFormOnSubmit(tmpFormValues) as ExistingBookingFormFields
        // if there is an error (fields are empty), update the values and return
        if (tmpFormValues) {
            setDraftFormValues(tmpFormValues)
            return
        }

        // everything looks good, lets write to firebase and create calendar/send confirmation email

        // merge booking object with form values - this ensures values not inform arent deleted such as eventId
        setLoading(true)
        const bookingCopy = { ...booking }
        const mergedBooking = { ...bookingCopy, ...mapFormToBooking(formValues) }

        try {
            await updateBookingMutation.mutateAsync({ bookingId: booking.id, booking: mergedBooking })
            setLoading(false)
            setEditing(false)
            setDate(DateTime.fromJSDate(formValues.date.value))
            toast.success('Party updated.')
        } catch (err) {
            console.error(err)
            setLoading(false)
            displayError('Unable to update the booking. Please try again.\nError details: ' + err)
        }
    }

    const handleDeleteBooking = async (lostReason: PartyLostReason, confirmationResult?: string) => {
        setLoading(true)
        try {
            await deleteBookingMutation.mutateAsync({
                bookingId: booking.id,
                eventId: booking.eventId!,
                location: booking.location,
                type: booking.type,
                lostReason,
                lostReasonOtherDetails: confirmationResult,
            })
            setLoading(false)
            setEditing(false)
            setDate(DateTime.fromJSDate(formValues.date.value)) //  triggers firestore subscription to run again
            toast.success('Booking deleted.')
        } catch (err) {
            console.error(err)
            setLoading(false)
            displayError('Unable to delete the booking. Please try again.\nError details: ' + err)
        }
    }

    return (
        <Root>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Typography variant="h6">Parent details</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.parentFirstName, booking.id)}
                        name={FormBookingFields.parentFirstName}
                        label="Parent first name"
                        fullWidth
                        size="small"
                        variant="outlined"
                        autoComplete="off"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.parentFirstName].value}
                        error={formValues[FormBookingFields.parentFirstName].error}
                        helperText={
                            formValues[FormBookingFields.parentFirstName].error
                                ? formValues[FormBookingFields.parentFirstName].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.parentLastName, booking.id)}
                        name={FormBookingFields.parentLastName}
                        label="Parent last name"
                        fullWidth
                        size="small"
                        variant="outlined"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.parentLastName].value}
                        error={formValues[FormBookingFields.parentLastName].error}
                        helperText={
                            formValues[FormBookingFields.parentLastName].error
                                ? formValues[FormBookingFields.parentLastName].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.parentEmail, booking.id)}
                        name={FormBookingFields.parentEmail}
                        label="Parent email"
                        fullWidth
                        size="small"
                        variant="outlined"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.parentEmail].value}
                        error={formValues[FormBookingFields.parentEmail].error}
                        helperText={
                            formValues[FormBookingFields.parentEmail].error
                                ? formValues[FormBookingFields.parentEmail].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.parentMobile, booking.id)}
                        name={FormBookingFields.parentMobile}
                        label="Parent mobile"
                        fullWidth
                        size="small"
                        variant="outlined"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.parentMobile].value}
                        error={formValues[FormBookingFields.parentMobile].error}
                        helperText={
                            formValues[FormBookingFields.parentMobile].error
                                ? formValues[FormBookingFields.parentMobile].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12}>
                    <Typography variant="h6">Child details</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.childName, booking.id)}
                        name={FormBookingFields.childName}
                        label="Child name"
                        fullWidth
                        size="small"
                        variant="outlined"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.childName].value}
                        error={formValues[FormBookingFields.childName].error}
                        helperText={
                            formValues[FormBookingFields.childName].error
                                ? formValues[FormBookingFields.childName].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id={createUniqueId(FormBookingFields.childAge, booking.id)}
                        name={FormBookingFields.childAge}
                        label="Child age"
                        fullWidth
                        size="small"
                        variant="outlined"
                        disabled={!editing}
                        classes={{ root: classes.disabled }}
                        value={formValues[FormBookingFields.childAge].value}
                        error={formValues[FormBookingFields.childAge].error}
                        helperText={
                            formValues[FormBookingFields.childAge].error
                                ? formValues[FormBookingFields.childAge].errorText
                                : ''
                        }
                        onChange={handleFormChange}
                    />
                </Grid>
                {displayDateTimeLocationHeading && (
                    <Grid item xs={12}>
                        <Typography variant="h6">Date, time & location</Typography>
                    </Grid>
                )}
                {displayDateTimeLocation && (
                    <>
                        <Grid item xs={6} sm={3}>
                            <DatePicker
                                value={DateTime.fromJSDate(formValues[FormBookingFields.date].value)}
                                slotProps={{ textField: { sx: { input: { height: 7 } }, fullWidth: true } }}
                                disabled={!editing}
                                onChange={(date) => handleFormDateChange(date!)}
                                format="dd/LL/yy"
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <TimePicker
                                value={DateTime.fromJSDate(formValues[FormBookingFields.time].value)}
                                sx={{ width: 2 }}
                                slotProps={{ textField: { sx: { input: { height: 7 } }, fullWidth: true } }}
                                onChange={(date) => handleFormTimeChange(date!)}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <FormControl fullWidth size="small" classes={{ root: classes.disabled }}>
                                <InputLabel>Location</InputLabel>
                                <Select
                                    name={FormBookingFields.location}
                                    id={FormBookingFields.location}
                                    label="location"
                                    value={formValues[FormBookingFields.location].value || ''}
                                    disabled={true}
                                    error={formValues[FormBookingFields.location].error}
                                    onChange={handleFormChange}
                                >
                                    {STUDIOS.map((studio) => (
                                        <MenuItem key={studio} value={studio}>
                                            {capitalise(studio)}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {formValues.location.error ? (
                                    <FormHelperText error={true}>
                                        {formValues[FormBookingFields.location].errorText}
                                    </FormHelperText>
                                ) : null}
                            </FormControl>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <FormControl fullWidth size="small" classes={{ root: classes.disabled }}>
                                <InputLabel>Party length</InputLabel>
                                <Select
                                    name={FormBookingFields.partyLength}
                                    id={FormBookingFields.partyLength}
                                    label="party length"
                                    value={formValues[FormBookingFields.partyLength].value || ''}
                                    disabled={!editing}
                                    error={formValues[FormBookingFields.partyLength].error}
                                    onChange={handleFormChange}
                                >
                                    <MenuItem value={'1'}>1 hour</MenuItem>
                                    <MenuItem value={'1.5'}>1.5 hours</MenuItem>
                                    <MenuItem value={'2'}>2 hours</MenuItem>
                                </Select>
                                {formValues.partyLength.error && (
                                    <FormHelperText error={true}>
                                        {formValues[FormBookingFields.partyLength].errorText}
                                    </FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                    </>
                )}
                {displayAddress && (
                    <Grid item xs={12}>
                        <TextField
                            id={createUniqueId(FormBookingFields.address, booking.id)}
                            name={FormBookingFields.address}
                            label="Address"
                            fullWidth
                            size="small"
                            variant="outlined"
                            disabled={!editing}
                            classes={{ root: classes.disabled }}
                            value={formValues[FormBookingFields.address].value}
                            error={formValues[FormBookingFields.address].error}
                            helperText={
                                formValues[FormBookingFields.address].error
                                    ? formValues[FormBookingFields.address].errorText
                                    : ''
                            }
                            onChange={handleFormChange}
                        />
                    </Grid>
                )}
                {displayNumberOfChildren && (
                    <>
                        <Grid item xs={12}>
                            <Typography variant="h6">Number of children</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                id={createUniqueId(FormBookingFields.numberOfChildren, booking.id)}
                                name={FormBookingFields.numberOfChildren}
                                label="Number of children"
                                fullWidth
                                size="small"
                                variant="outlined"
                                disabled={!editing}
                                classes={{ root: classes.disabled }}
                                value={formValues[FormBookingFields.numberOfChildren].value}
                                error={formValues[FormBookingFields.numberOfChildren].error}
                                helperText={
                                    formValues[FormBookingFields.numberOfChildren].error
                                        ? formValues[FormBookingFields.numberOfChildren].errorText
                                        : ''
                                }
                                onChange={handleFormChange}
                            />
                        </Grid>
                    </>
                )}
                {displayNotes && (
                    <>
                        <Grid item xs={12}>
                            <Typography variant="h6">Notes</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                id={createUniqueId(FormBookingFields.notes, booking.id)}
                                name={FormBookingFields.notes}
                                label="Notes"
                                fullWidth
                                size="small"
                                variant={editing || formValues[FormBookingFields.notes].value ? 'outlined' : 'filled'}
                                multiline
                                rows={3}
                                disabled={!editing}
                                classes={{ root: classes.disabled }}
                                value={formValues[FormBookingFields.notes].value}
                                error={formValues[FormBookingFields.notes].error}
                                onChange={handleFormChange}
                            />
                        </Grid>
                    </>
                )}
                {displayCreationHeading && (
                    <Grid item xs={12}>
                        <Typography variant="h6">Creations</Typography>
                    </Grid>
                )}
                {displayCreation1 && (
                    <Grid item xs={12} sm={4}>
                        <FormControl
                            fullWidth
                            size="small"
                            classes={{ root: classes.disabled }}
                            variant={formValues[FormBookingFields.creation1].value ? 'standard' : 'filled'}
                        >
                            <InputLabel>First Creation</InputLabel>
                            <Select
                                name={FormBookingFields.creation1}
                                id={createUniqueId(FormBookingFields.creation1, booking.id)}
                                label="first creation"
                                value={formValues[FormBookingFields.creation1].value || ''}
                                disabled={!editing}
                                error={formValues[FormBookingFields.creation1].error}
                                onChange={handleFormChange}
                            >
                                {getCreationMenuItems(formValues[FormBookingFields.creation1].value)}
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                {displayCreation2 && (
                    <Grid item xs={12} sm={4}>
                        <FormControl
                            fullWidth
                            size="small"
                            classes={{ root: classes.disabled }}
                            variant={formValues[FormBookingFields.creation2].value ? 'standard' : 'filled'}
                        >
                            <InputLabel>Second Creation</InputLabel>
                            <Select
                                name={FormBookingFields.creation2}
                                id={createUniqueId(FormBookingFields.creation2, booking.id)}
                                label="Second Creation"
                                value={formValues[FormBookingFields.creation2].value || ''}
                                disabled={!editing}
                                error={formValues[FormBookingFields.creation2].error}
                                onChange={handleFormChange}
                            >
                                {getCreationMenuItems(formValues[FormBookingFields.creation2].value)}
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                {displayCreation3 && (
                    <Grid item xs={12} sm={4}>
                        <FormControl
                            fullWidth
                            size="small"
                            classes={{ root: classes.disabled }}
                            variant={formValues[FormBookingFields.creation3].value ? 'standard' : 'filled'}
                        >
                            <InputLabel>Third Creation</InputLabel>
                            <Select
                                name={FormBookingFields.creation3}
                                id={createUniqueId(FormBookingFields.creation3, booking.id)}
                                label="third creation"
                                value={formValues[FormBookingFields.creation3].value || ''}
                                disabled={!editing}
                                error={formValues[FormBookingFields.creation3].error}
                                onChange={handleFormChange}
                            >
                                {getCreationMenuItems(formValues[FormBookingFields.creation3].value)}
                            </Select>
                        </FormControl>
                    </Grid>
                )}
                {/* {displayMenu && (
                    <>
                        <Grid item xs={12}>
                            <Typography variant="h6">Food Menu</Typography>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <FormControl
                                fullWidth
                                size="small"
                                classes={{ root: classes.disabled }}
                                variant={formValues[FormBookingFields.menu].value ? 'standard' : 'filled'}
                            >
                                <InputLabel>Menu</InputLabel>
                                <Select
                                    name={FormBookingFields.menu}
                                    id={createUniqueId(FormBookingFields.menu, booking.id)}
                                    label="food menu"
                                    value={formValues[FormBookingFields.menu].value || ''}
                                    disabled={!editing}
                                    error={formValues[FormBookingFields.menu].error}
                                    onChange={handleFormChange}
                                >
                                    <MenuItem key="standard" value="standard">
                                        Standard
                                    </MenuItem>
                                    <MenuItem key="vegan" value="vegan">
                                        Vegan
                                    </MenuItem>
                                    <MenuItem key="glutenFree" value="glutenFree">
                                        Gluten Free
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </>
                )} */}
                <Grid item xs={12}>
                    <Typography variant="h6">Food Package</Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small" classes={{ root: classes.disabled }} variant="standard">
                        <InputLabel>Food package</InputLabel>
                        <Select
                            name={FormBookingFields.includesFood}
                            id={createUniqueId(FormBookingFields.includesFood, booking.id)}
                            label="food package"
                            value={formValues[FormBookingFields.includesFood].value}
                            disabled={!editing}
                            error={formValues[FormBookingFields.includesFood].error}
                            onChange={handleFormChange}
                        >
                            <MenuItem value={true as any}>Includes food</MenuItem>
                            <MenuItem value={false as any}>Self catered</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                {displayAdditions && (
                    <>
                        <Grid item xs={12}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="h6">Additions</Typography>
                                <Chip
                                    label="NOT PAID"
                                    size="small"
                                    sx={{
                                        backgroundColor: '#e05353',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        border: 'none',
                                        '& .MuiChip-label': {
                                            px: 1.5,
                                        },
                                    }}
                                />
                            </Box>
                        </Grid>
                        {ObjectKeys(PROD_ADDITIONS).map((addition) => (
                            <Grid item xs={6} sm={3} key={addition}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            id={createUniqueId(FormBookingFields[addition], booking.id)}
                                            color="secondary"
                                            name={FormBookingFields[addition]}
                                            checked={formValues[FormBookingFields[addition]].value ?? false}
                                            value={formValues[FormBookingFields[addition]].value}
                                            disabled={!editing}
                                            onChange={handleFormCheckboxChange}
                                        />
                                    }
                                    label={PROD_ADDITIONS[addition].displayValue}
                                    classes={{ root: classes.disabled }}
                                />
                            </Grid>
                        ))}
                    </>
                )}
                {displayCake && (
                    <>
                        <Grid item xs={12}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="h6">Cake</Typography>
                                <Chip
                                    label="PAID"
                                    size="small"
                                    sx={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        border: 'none',
                                        '& .MuiChip-label': {
                                            px: 1.5,
                                        },
                                    }}
                                />
                            </Box>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                id={createUniqueId('cake', booking.id)}
                                name={'cake'}
                                label="Cake"
                                fullWidth
                                size="small"
                                variant="filled"
                                disabled={true}
                                classes={{ root: classes.disabled }}
                                value={booking.cake?.selection}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                id={createUniqueId('cakeSize', booking.id)}
                                name={'cakeSize'}
                                label="Cake Size"
                                fullWidth
                                size="small"
                                variant="filled"
                                disabled={true}
                                classes={{ root: classes.disabled }}
                                value={booking.cake?.size}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                id={createUniqueId('cakeFlavours', booking.id)}
                                name={'cakeFlavours'}
                                label="Cake Flavours"
                                fullWidth
                                size="small"
                                variant="filled"
                                disabled={true}
                                classes={{ root: classes.disabled }}
                                value={booking.cake?.flavours.join(', ')}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                id={createUniqueId('cakeServed', booking.id)}
                                name={'cakeServed'}
                                label="How to serve"
                                fullWidth
                                size="small"
                                variant="filled"
                                disabled={true}
                                classes={{ root: classes.disabled }}
                                value={booking.cake?.served}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                id={createUniqueId('cakeCandles', booking.id)}
                                name={'cakeCandles'}
                                label="Candles"
                                fullWidth
                                size="small"
                                variant="filled"
                                disabled={true}
                                classes={{ root: classes.disabled }}
                                value={booking.cake?.candles}
                            />
                        </Grid>
                        {booking.cake?.message && (
                            <Grid item xs={6}>
                                <TextField
                                    id={createUniqueId('cakeMessage', booking.id)}
                                    name="cakeMessage"
                                    label="Cake Message"
                                    fullWidth
                                    size="small"
                                    variant="filled"
                                    disabled={true}
                                    classes={{ root: classes.disabled }}
                                    value={booking.cake.message}
                                />
                            </Grid>
                        )}
                    </>
                )}
                {/* Take Home Bags Section */}
                {displayTakeHomeBags && (
                    <>
                        <Grid item xs={12}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="h6">Take Home Bags</Typography>
                                <Chip
                                    label="PAID"
                                    size="small"
                                    sx={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        border: 'none',
                                        '& .MuiChip-label': {
                                            px: 1.5,
                                        },
                                    }}
                                />
                            </Box>
                        </Grid>
                        {ObjectKeys(TAKE_HOME_BAGS).map((bagType) => {
                            const value = booking.takeHomeBags?.[bagType]
                            if (!value) return null

                            return (
                                <Grid item xs={6} key={bagType}>
                                    <TextField
                                        id={createUniqueId(`takeHomeBags.${bagType}`, booking.id)}
                                        name={`takeHomeBags.${bagType}`}
                                        label={TAKE_HOME_BAGS[bagType].displayValue}
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        disabled
                                        classes={{ root: classes.disabled }}
                                        value={value}
                                        helperText={TAKE_HOME_BAGS[bagType].helperText}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderLeft: '4px solid #28a745',
                                            },
                                        }}
                                    />
                                </Grid>
                            )
                        })}
                    </>
                )}
                {/* Products Section */}
                {displayProducts && (
                    <>
                        <Grid item xs={12}>
                            <Box display="flex" alignItems="center" gap={2}>
                                <Typography variant="h6">Products</Typography>
                                <Chip
                                    label="PAID"
                                    size="small"
                                    sx={{
                                        backgroundColor: '#28a745',
                                        color: 'white',
                                        fontWeight: 'bold',
                                        fontSize: '0.75rem',
                                        border: 'none',
                                        '& .MuiChip-label': {
                                            px: 1.5,
                                        },
                                    }}
                                />
                            </Box>
                        </Grid>
                        {ObjectKeys(PRODUCTS).map((productType) => {
                            const value = booking.products?.[productType]
                            if (!value) return null

                            return (
                                <Grid item xs={6} key={productType}>
                                    <TextField
                                        id={createUniqueId(`products.${productType}`, booking.id)}
                                        name={`products.${productType}`}
                                        label={PRODUCTS[productType].label}
                                        fullWidth
                                        size="small"
                                        variant="outlined"
                                        disabled
                                        classes={{ root: classes.disabled }}
                                        value={value}
                                        helperText={PRODUCTS[productType].helperText}
                                    />
                                </Grid>
                            )
                        })}
                    </>
                )}
                {displayQuestionsCommentsFunFactsHeading && (
                    <Grid item xs={12}>
                        <Typography variant="h6">Parent Questions / Comments / Fun Facts</Typography>
                    </Grid>
                )}
                {displayQuestions && (
                    <Grid item xs={12}>
                        <TextField
                            id={createUniqueId(FormBookingFields.questions, booking.id)}
                            name={FormBookingFields.questions}
                            label="Questions"
                            fullWidth
                            multiline
                            rows={6}
                            size="small"
                            variant={editing || formValues[FormBookingFields.questions].value ? 'outlined' : 'filled'}
                            disabled={!editing}
                            classes={{ root: classes.disabled }}
                            error={formValues[FormBookingFields.questions].error}
                            value={formValues[FormBookingFields.questions].value}
                            onChange={handleFormChange}
                        />
                    </Grid>
                )}
                {displayFunFacts && (
                    <Grid item xs={12}>
                        <TextField
                            id={createUniqueId(FormBookingFields.funFacts, booking.id)}
                            name={FormBookingFields.funFacts}
                            label="Fun Facts"
                            fullWidth
                            multiline
                            rows={6}
                            size="small"
                            variant={editing || formValues[FormBookingFields.funFacts].value ? 'outlined' : 'filled'}
                            disabled={!editing}
                            classes={{ root: classes.disabled }}
                            error={formValues[FormBookingFields.funFacts].error}
                            value={formValues[FormBookingFields.funFacts].value}
                            onChange={handleFormChange}
                        />
                    </Grid>
                )}
            </Grid>
            <EditFormButtons
                loading={loading}
                editing={editing}
                onStartEditing={handleEdit}
                onCancelEditing={cancelEdit}
                onDelete={() => {
                    showConfirmationDialog({
                        dialogTitle: 'Delete Booking',
                        dialogContent:
                            "This will also delete all invitations and RSVP's associated with this booking, and is irreversible. Are you sure you want to continue?",
                        confirmationButtonText: 'Delete',
                        listItems: {
                            items: PARTY_LOST_REASONS.map((reason) => ({ key: reason, value: reason })),
                            title: 'Lost reason',
                        },
                        conditionalTextField: {
                            triggerValue: 'Other',
                            label: 'Other reason',
                        },

                        onConfirm: (lostReason, confirmationResult) =>
                            handleDeleteBooking(lostReason as PartyLostReason, confirmationResult),
                    })
                }}
                onSave={handleSubmit}
                menu={[
                    {
                        label: 'Get party form link',
                        action: async () => {
                            setLoading(true)
                            try {
                                const url = await getPartyFormUrl.mutateAsync({ bookingId: booking.id })
                                navigator.clipboard.writeText(url)
                                toast.success('Party form link copied to clipboard.')
                            } catch (err) {
                                console.error(err)
                                toast.error('Unable to get party form link.')
                            }
                            setLoading(false)
                        },
                    },
                    {
                        label: 'Get cake form link',
                        action: async () => {
                            setLoading(true)
                            try {
                                const url = await getCakeFormUrl.mutateAsync({ bookingId: booking.id })
                                navigator.clipboard.writeText(url)
                                toast.success('Cake form link copied to clipboard.')
                            } catch (err) {
                                console.error(err)
                                toast.error('Unable to get cake form link.')
                            } finally {
                                setLoading(false)
                            }
                        },
                    },
                    {
                        label: 'Resend confirmation email',
                        action: async () => {
                            const confirmed = await confirm({
                                title: 'Resend confirmation email?',
                                description: `This will send the party booking confirmation email to ${booking.parentEmail}.`,
                            })

                            if (!confirmed) return

                            setLoading(true)
                            try {
                                await resendPartyBookingConfirmationEmail.mutateAsync({ bookingId: booking.id })
                                toast.success(`Confirmation email sent to ${booking.parentEmail}.`)
                            } catch (err) {
                                console.error(err)
                                toast.error('Unable to resend confirmation email.')
                            } finally {
                                setLoading(false)
                            }
                        },
                    },
                    ...(booking.useRsvpSystem
                        ? [
                              {
                                  label: 'Get invitation link',

                                  action: async () => {
                                      navigator.clipboard.writeText(
                                          booking.invitationId
                                              ? getInvitationShareUrl(
                                                    import.meta.env.VITE_ENV,
                                                    import.meta.env.DEV,
                                                    booking.invitationId
                                                )
                                              : getInvitationEntryUrl(
                                                    import.meta.env.VITE_ENV,
                                                    import.meta.env.DEV,
                                                    booking.id
                                                )
                                      )
                                      toast.success('Invitation link copied to clipboard')
                                  },
                              },
                          ]
                        : []),
                ]}
            />
        </Root>
    )
}

function createUniqueId(field: string, id: string) {
    return `${field}-${id}`
}

function cloneFormValues(formValues: ExistingBookingFormFields): ExistingBookingFormFields {
    return Object.fromEntries(
        Object.entries(formValues).map(([key, value]) => [key, { ...value }])
    ) as ExistingBookingFormFields
}

export const ExistingBookingForm = WithConfirmationDialog(WithErrorDialog(InnerExistingBookingForm))
