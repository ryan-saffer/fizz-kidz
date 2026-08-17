import 'typeface-roboto'
import CheckIcon from '@mui/icons-material/Check'
import SaveIcon from '@mui/icons-material/Save'
import {
    Button,
    Checkbox,
    CircularProgress,
    Fab,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from '@mui/material'
import { green } from '@mui/material/colors'
import { styled } from '@mui/material/styles'
import { DatePicker, TimePicker } from '@mui/x-date-pickers'
import { useMutation } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { useState } from 'react'

import { FormBookingFields, STUDIOS, capitalise, combineStrings } from '@fizz-kidz/core'

import { useTRPC } from '@integrations/trpc'
import WithErrorDialog from '@shared/components/dialogs/legacy/ErrorDialog'

import { errorFound, validateFormOnChange, validateFormOnSubmit } from '../validation'

const PREFIX = 'index'

const classes = {
    confirmationEmailCheckbox: `${PREFIX}-confirmationEmailCheckbox`,
    childActions: `${PREFIX}-childActions`,
    childSection: `${PREFIX}-childSection`,
    childSectionHeader: `${PREFIX}-childSectionHeader`,
    saveButtonDiv: `${PREFIX}-saveButtonDiv`,
    saveButton: `${PREFIX}-saveButton`,
    progress: `${PREFIX}-progress`,
    success: `${PREFIX}-success`,
}

const Root = styled('div')(({ theme }) => ({
    [`& .${classes.confirmationEmailCheckbox}`]: {
        float: 'right',
    },

    [`& .${classes.childActions}`]: {
        display: 'flex',
        justifyContent: 'flex-end',
    },

    [`& .${classes.childSection}`]: {
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        padding: theme.spacing(2),
    },

    [`& .${classes.childSectionHeader}`]: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },

    [`& .${classes.saveButtonDiv}`]: {
        display: 'flex',
        justifyContent: 'flex-end',
    },

    [`& .${classes.saveButton}`]: {
        marginTop: theme.spacing(3),
    },

    [`& .${classes.progress}`]: {
        color: green[500],
        position: 'absolute',
        marginTop: '18px',
        marginRight: '-6px',
    },

    [`& .${classes.success}`]: {
        marginTop: theme.spacing(3),
        backgroundColor: green[500],
    },
}))

/** Function, not const obj, to avoid mutation. Each call returns an empty form. */
const getEmptyValues = () => ({
    parentFirstName: {
        value: '',
        error: false,
        errorText: 'First name cannot be empty',
    },
    parentLastName: {
        value: '',
        error: false,
        errorText: 'Last name cannot be empty',
    },
    parentEmail: {
        value: '',
        error: false,
        errorText: 'Email address cannot be empty',
    },
    parentMobile: {
        value: '',
        error: false,
        errorText: 'Mobile number cannot be empty',
    },
    zohoDealId: {
        value: '',
        error: false,
        errorText: '',
    },
    childName: {
        value: '',
        error: false,
        errorText: 'Child name cannot be empty',
    },
    childAge: {
        value: '',
        error: false,
        errorText: 'Child age cannot be empty',
    },
    childBirthday: {
        value: null,
        error: false,
        errorText: '',
    },
    date: {
        value: null,
        error: false,
        errorText: 'Date cannot be empty',
    },
    time: {
        value: null,
        error: false,
        errorText: 'Time cannot be empty',
    },
    location: {
        value: '',
        error: false,
        errorText: 'Location cannot be empty',
    },
    type: {
        value: '',
        error: false,
        errorText: 'Party type cannot be empty',
    },
    partyLength: {
        value: '',
        error: false,
        errorText: 'Party length cannot be empty',
    },
    address: {
        value: '',
        error: false,
        errorText: 'Address cannot be empty',
    },
    notes: {
        value: '',
        error: false,
        errorText: '',
    },
    sendConfirmationEmail: {
        value: true,
        error: false,
        errorText: '',
    },
    useRsvpSystem: {
        value: true,
        error: false,
        errorText: '',
    },
    oldPrices: {
        value: false,
        error: false,
        errorText: '',
    },
    includesFood: {
        value: '',
        error: false,
        errorText: 'Please select a food package',
    },
})

const VALID_BOOKING_TYPES = ['studio', 'mobile']

let childId = 0

const createEmptyChild = () => ({
    id: `child-${childId++}`,
    name: '',
    age: '',
    birthday: null,
    errors: {
        name: false,
        age: false,
        birthday: false,
    },
})

const validateChildField = (field, value) => {
    if (field === 'birthday') {
        return value === null
    }

    return value.trim() === ''
}

const validateChildrenOnSubmit = (children) => {
    let hasErrors = false

    const validatedChildren = children.map((child) => {
        const errors = {
            name: validateChildField('name', child.name),
            age: validateChildField('age', child.age),
            birthday: validateChildField('birthday', child.birthday),
        }

        if (errors.name || errors.age || errors.birthday) {
            hasErrors = true
        }

        return {
            ...child,
            errors,
        }
    })

    return { children: validatedChildren, hasErrors }
}

const childrenHaveErrors = (children) =>
    children.some((child) => child.errors.name || child.errors.age || child.errors.birthday)

const getAgeFromBirthday = (birthday) => {
    if (!birthday) {
        return ''
    }

    const today = DateTime.now().setZone('Australia/Melbourne').startOf('day')
    const birthdayDate = DateTime.fromJSDate(birthday, { zone: 'Australia/Melbourne' }).startOf('day')

    if (birthdayDate > today) {
        return ''
    }

    let age = today.year - birthdayDate.year

    if (today < birthdayDate.plus({ years: age })) {
        age -= 1
    }

    return `${age + 1}`
}

const syncLegacyChildFields = (formValues, children) => {
    const firstChild = children[0]

    return {
        ...formValues,
        childName: {
            ...formValues.childName,
            value: firstChild?.name || '',
            error: false,
        },
        childAge: {
            ...formValues.childAge,
            value: firstChild?.age || '',
            error: false,
        },
        childBirthday: {
            ...formValues.childBirthday,
            value: firstChild?.birthday || null,
            error: false,
        },
    }
}

const mapChildrenToBooking = (children) =>
    children.map((child) => ({
        name: child.name.trim(),
        age: child.age.trim(),
        birthday: toMelbourneISODate(child.birthday),
    }))

const mapUrlTypeToBookingType = (type) => {
    const normalizedType = type?.trim()?.toLowerCase()
    if (!normalizedType) {
        return undefined
    }

    if (normalizedType === 'fizz kidz studio') {
        return 'studio'
    }

    if (normalizedType === 'at-home' || normalizedType === 'at home') {
        return 'mobile'
    }

    if (VALID_BOOKING_TYPES.includes(normalizedType)) {
        return normalizedType
    }

    return undefined
}

const splitParentName = (parentName) => {
    const fullName = parentName?.trim().replace(/\s+/g, ' ')
    if (!fullName) {
        return {}
    }

    const [firstName, ...lastNameParts] = fullName.split(' ')
    return {
        parentFirstName: firstName,
        parentLastName: lastNameParts.join(' '),
    }
}

const getPrefilledValuesFromUrl = () => {
    if (typeof window === 'undefined') {
        return {}
    }

    const params = new URLSearchParams(window.location.search)
    const parentName = splitParentName(params.get('parentName'))
    const prefilledValues = {
        parentFirstName: parentName.parentFirstName,
        parentLastName: parentName.parentLastName,
        parentEmail: params.get('parentEmail')?.trim(),
        parentMobile: params.get('parentMobile')?.trim(),
        type: mapUrlTypeToBookingType(params.get('type')),
        location: params.get('location')?.trim()?.toLowerCase(),
        zohoDealId: params.get('zohoDealId')?.trim(),
    }

    if (!VALID_BOOKING_TYPES.includes(prefilledValues.type)) {
        delete prefilledValues.type
    }

    if (!STUDIOS.includes(prefilledValues.location)) {
        delete prefilledValues.location
    }

    Object.keys(prefilledValues).forEach((field) => {
        if (!prefilledValues[field]) {
            delete prefilledValues[field]
        }
    })

    return prefilledValues
}

const getInitialValues = () => {
    const initialValues = getEmptyValues()
    const prefilledValues = getPrefilledValuesFromUrl()

    Object.keys(prefilledValues).forEach((field) => {
        if (initialValues[field]) {
            initialValues[field].value = prefilledValues[field]
        }
    })

    return initialValues
}

const toMelbourneISODate = (date) => {
    return DateTime.fromObject(
        {
            day: date.getDate(),
            month: date.getMonth() + 1,
            year: date.getFullYear(),
        },
        { zone: 'Australia/Melbourne' }
    ).toISODate()
}

/**
 * Strips out the error and errorText fields, leaving only the field and value
 *
 * @param {object} formValues - the form values as an object
 * @return {object} the booking ready to be written to firestore
 */
const mapFormToBooking = (formValues, children) => {
    var booking = {}
    for (let field in formValues) {
        booking[field] = formValues[field].value
    }

    const mappedChildren = mapChildrenToBooking(children)

    // trim fields
    booking[FormBookingFields.parentFirstName] = booking[FormBookingFields.parentFirstName].trim()
    booking[FormBookingFields.parentLastName] = booking[FormBookingFields.parentLastName].trim()
    booking[FormBookingFields.parentEmail] = booking[FormBookingFields.parentEmail].trim()
    booking[FormBookingFields.parentMobile] = booking[FormBookingFields.parentMobile].trim()
    booking.zohoDealId = booking.zohoDealId.trim()
    booking.children = mappedChildren

    // child name and age are derived from the children
    booking[FormBookingFields.childName] = combineStrings(mappedChildren.map((child) => child.name))
    booking[FormBookingFields.childAge] = combineStrings(mappedChildren.map((child) => child.age))

    // make sure 'includesFood' is set as a boolean (for mobile parties its value is '' at this point)
    booking[FormBookingFields.includesFood] = !!booking[FormBookingFields.includesFood]

    // combine date and time into one
    // hardcode to AEST to ensure bookings can be created/updated from anywhere in the world
    const dateTime = DateTime.fromObject(
        {
            day: booking.date.getDate(),
            month: booking.date.getMonth() + 1,
            year: booking.date.getFullYear(),
            hour: booking.time.getHours(),
            minute: booking.time.getMinutes(),
        },
        { zone: 'Australia/Melbourne' }
    ).toJSDate()
    delete booking.date
    delete booking.time
    booking['dateTime'] = dateTime

    return booking
}

/** The booking form component */
const InnerNewBookingForm = (props) => {
    const trpc = useTRPC()
    const [formValues, setFormValues] = useState(getInitialValues)
    const [children, setChildren] = useState(() => [createEmptyChild()])
    const [valid, setValid] = useState(true)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const createBookingMutation = useMutation(trpc.parties.createPartyBooking.mutationOptions())

    const updateValidity = (nextFormValues, nextChildren) => {
        setValid(!errorFound(nextFormValues) && !childrenHaveErrors(nextChildren))
    }

    const handleChildChange = (index, field, value) => {
        const nextChildren = children.map((child, childIndex) => {
            if (childIndex !== index) {
                return child
            }

            const nextAge = field === 'birthday' ? getAgeFromBirthday(value) : child.age

            return {
                ...child,
                [field]: value,
                ...(field === 'birthday' ? { age: nextAge } : {}),
                errors: {
                    ...child.errors,
                    ...(field === 'birthday' ? { age: validateChildField('age', nextAge) } : {}),
                    [field]: validateChildField(field, value),
                },
            }
        })

        const nextFormValues = syncLegacyChildFields(formValues, nextChildren)

        setChildren(nextChildren)
        setFormValues(nextFormValues)
        updateValidity(nextFormValues, nextChildren)
    }

    const addChild = () => {
        const nextChildren = [...children, createEmptyChild()]
        const nextFormValues = syncLegacyChildFields(formValues, nextChildren)
        setChildren(nextChildren)
        setFormValues(nextFormValues)
        updateValidity(nextFormValues, nextChildren)
    }

    const removeChild = (index) => {
        const nextChildren = children.filter((_, childIndex) => childIndex !== index)
        const nextFormValues = syncLegacyChildFields(formValues, nextChildren)
        setChildren(nextChildren)
        setFormValues(nextFormValues)
        updateValidity(nextFormValues, nextChildren)
    }

    const handleFormChange = (e, id) => {
        const isPickerField = typeof id === 'string'
        let field = isPickerField ? id : e.target.name
        let value
        if (isPickerField) {
            value = e.toJSDate()
        } else if (field === 'sendConfirmationEmail') {
            value = e.target.checked
        } else {
            value = e.target.value
        }
        let tmpValues = { ...formValues }
        tmpValues[field].value = value
        tmpValues = validateFormOnChange(tmpValues, field, value)

        // clear the value and errors of the address field if it is no longer required
        if (field === 'type') {
            tmpValues.address.value = ''
            tmpValues.address.error = false

            tmpValues.includesFood.value = ''
            tmpValues.includesFood.error = false
        }

        updateValidity(tmpValues, children)
        setFormValues(tmpValues)
    }

    const handleSubmit = async () => {
        var tmpFormValues = syncLegacyChildFields(formValues, children)
        const validatedChildren = validateChildrenOnSubmit(children)
        tmpFormValues = validateFormOnSubmit(tmpFormValues)

        setChildren(validatedChildren.children)

        // if there is an error (fields are empty), update the values and return
        if (tmpFormValues || validatedChildren.hasErrors) {
            setValid(false)
            if (tmpFormValues) {
                setFormValues(tmpFormValues)
            }
            return
        }

        // everything looks good, lets write to firebase and create calendar/send confirmation email
        setLoading(true)
        var booking = mapFormToBooking(formValues, children)

        try {
            await createBookingMutation.mutateAsync(booking)
            setLoading(false)
            setSuccess(true)
            setTimeout(() => {
                // let user see success for a second, then close the dialog
                props.onSuccess(formValues.date.value)
            }, 1000)
        } catch (err) {
            console.error(err)
            setLoading(false)
            setSuccess(false)
            props.displayError('Party has not been booked in properly. Please try again.\nError details: ' + err)
        }
    }

    return (
        <Root>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <Typography variant="h6">Parent Details</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id="parentFirstName"
                        name="parentFirstName"
                        label="Parent first name"
                        fullWidth
                        variant="outlined"
                        autoComplete="off"
                        value={formValues.parentFirstName.value}
                        error={formValues.parentFirstName.error}
                        helperText={formValues.parentFirstName.error ? formValues.parentFirstName.errorText : ''}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id="parentLastName"
                        name="parentLastName"
                        label="Parent last name"
                        fullWidth
                        variant="outlined"
                        value={formValues.parentLastName.value}
                        error={formValues.parentLastName.error}
                        helperText={formValues.parentLastName.error ? formValues.parentLastName.errorText : ''}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id="parentEmail"
                        name="parentEmail"
                        label="Parent email"
                        fullWidth
                        variant="outlined"
                        value={formValues.parentEmail.value}
                        error={formValues.parentEmail.error}
                        helperText={formValues.parentEmail.error ? formValues.parentEmail.errorText : ''}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id="parentMobile"
                        name="parentMobile"
                        label="Parent mobile"
                        fullWidth
                        variant="outlined"
                        value={formValues.parentMobile.value}
                        error={formValues.parentMobile.error}
                        helperText={formValues.parentMobile.error ? formValues.parentMobile.errorText : ''}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField
                        id="zohoDealId"
                        name="zohoDealId"
                        label="Zoho deal id (optional)"
                        fullWidth
                        variant="outlined"
                        value={formValues.zohoDealId.value}
                        error={formValues.zohoDealId.error}
                        helperText={formValues.zohoDealId.error ? formValues.zohoDealId.errorText : ''}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12}>
                    <Typography variant="h6">Child Details</Typography>
                </Grid>
                {children.map((child, index) => (
                    <Grid item xs={12} key={child.id}>
                        <div className={classes.childSection}>
                            <div className={classes.childSectionHeader}>
                                <Typography variant="subtitle1">Child {index + 1}</Typography>
                                {children.length > 1 && (
                                    <Button color="secondary" type="button" onClick={() => removeChild(index)}>
                                        Remove child
                                    </Button>
                                )}
                            </div>
                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        id={`childName-${child.id}`}
                                        label="Child name"
                                        fullWidth
                                        variant="outlined"
                                        value={child.name}
                                        error={child.errors.name}
                                        helperText={child.errors.name ? 'Child name cannot be empty' : ''}
                                        onChange={(e) => handleChildChange(index, 'name', e.target.value)}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <DatePicker
                                        label="Child birthday"
                                        orientation="portrait"
                                        maxDate={DateTime.now().setZone('Australia/Melbourne')}
                                        value={child.birthday ? DateTime.fromJSDate(child.birthday) : null}
                                        onChange={(value) =>
                                            handleChildChange(index, 'birthday', value ? value.toJSDate() : null)
                                        }
                                        format="dd/LL/yyyy"
                                        slotProps={{
                                            textField: {
                                                error: child.errors.birthday,
                                                helperText: child.errors.birthday
                                                    ? 'Child birthday cannot be empty'
                                                    : '',
                                                fullWidth: true,
                                            },
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        id={`childAge-${child.id}`}
                                        label="Child age"
                                        fullWidth
                                        variant="outlined"
                                        value={child.age}
                                        error={child.errors.age}
                                        helperText={
                                            child.errors.age
                                                ? 'Child age cannot be empty'
                                                : 'Make sure this is how old the child will be turning'
                                        }
                                        onChange={(e) => handleChildChange(index, 'age', e.target.value)}
                                    />
                                </Grid>
                            </Grid>
                        </div>
                    </Grid>
                ))}
                <Grid item xs={12}>
                    <div className={classes.childActions}>
                        <Button variant="outlined" color="secondary" type="button" onClick={addChild}>
                            Add another child
                        </Button>
                    </div>
                </Grid>
                <Grid item xs={12}>
                    <Typography variant="h6">Date, Time & Location</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                    <DatePicker
                        label="Party date"
                        orientation="portrait"
                        value={formValues.date.value ? DateTime.fromJSDate(formValues.date.value) : null}
                        onChange={(e) => handleFormChange(e, 'date')}
                        format="dd/LL/yyyy"
                        slotProps={{
                            textField: {
                                error: formValues.date.error,
                                helperText: formValues.date.error ? formValues.date.errorText : '',
                            },
                        }}
                    />
                </Grid>
                <Grid item xs={6} sm={3}>
                    <TimePicker
                        label="Party time"
                        value={formValues.time.value ? DateTime.fromJSDate(formValues.time.value) : null}
                        onChange={(e) => handleFormChange(e, 'time')}
                        slotProps={{
                            textField: {
                                error: formValues.time.error,
                                helperText: formValues.time.error ? formValues.time.errorText : '',
                            },
                        }}
                    />
                </Grid>
                <Grid item xs={6} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                            name="type"
                            id="type"
                            label="type"
                            value={formValues.type.value ?? ''}
                            error={formValues.type.error}
                            onChange={handleFormChange}
                        >
                            <MenuItem value="studio">Fizz Kidz Studio</MenuItem>
                            <MenuItem value="mobile">Mobile</MenuItem>
                        </Select>
                        {formValues.type.error ? (
                            <FormHelperText error={true}>{formValues.type.errorText}</FormHelperText>
                        ) : null}
                    </FormControl>
                </Grid>
                <Grid item xs={6} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Location</InputLabel>
                        <Select
                            value={formValues.location.value ? formValues.location.value : ''}
                            name="location"
                            label="location"
                            id="location"
                            error={formValues.location.error}
                            onChange={handleFormChange}
                        >
                            {STUDIOS.map((location) => (
                                <MenuItem key={location} value={location}>
                                    {capitalise(location)}
                                </MenuItem>
                            ))}
                        </Select>
                        {formValues.location.error ? (
                            <FormHelperText error={true}>{formValues.location.errorText}</FormHelperText>
                        ) : null}
                    </FormControl>
                </Grid>
                <Grid item xs={6} sm={6}>
                    <FormControl fullWidth>
                        <InputLabel>Party Length</InputLabel>
                        <Select
                            name="partyLength"
                            id="partyLength"
                            label="party length"
                            value={formValues.partyLength.value ? formValues.partyLength.value : ''}
                            error={formValues.partyLength.error}
                            onChange={handleFormChange}
                        >
                            <MenuItem value="1">1 hour</MenuItem>
                            <MenuItem value="1.5">1.5 hours</MenuItem>
                            <MenuItem value="2">2 hours</MenuItem>
                        </Select>
                        {formValues.partyLength.error ? (
                            <FormHelperText error={true}>{formValues.partyLength.errorText}</FormHelperText>
                        ) : null}
                    </FormControl>
                </Grid>
                {formValues.type.value === 'mobile' && (
                    <Grid item xs={12}>
                        <TextField
                            id="address"
                            name="address"
                            label="Address"
                            fullWidth
                            variant="outlined"
                            value={formValues.address.value}
                            error={formValues.address.error}
                            helperText={formValues.address.error ? formValues.address.errorText : ''}
                            onChange={handleFormChange}
                        />
                    </Grid>
                )}
                {formValues.type.value === 'studio' && (
                    <>
                        <Grid item xs={12}>
                            <Typography variant="h6">Party Food</Typography>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Food Package</InputLabel>
                                <Select
                                    name="includesFood"
                                    id="includesFood"
                                    label="Food Package"
                                    value={formValues.includesFood.value}
                                    error={formValues.includesFood.error}
                                    onChange={handleFormChange}
                                >
                                    <MenuItem value={true}>Includes food</MenuItem>
                                    <MenuItem value={false}>Self catered</MenuItem>
                                </Select>
                                {formValues.includesFood.error ? (
                                    <FormHelperText error={true}>{formValues.includesFood.errorText}</FormHelperText>
                                ) : null}
                            </FormControl>
                        </Grid>
                    </>
                )}
                <Grid item xs={12}>
                    <Typography variant="h6">Notes</Typography>
                </Grid>
                <Grid item xs={12}>
                    <TextField
                        id="notes"
                        name="notes"
                        label="Notes"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={5}
                        value={formValues.notes.value}
                        error={formValues.notes.error}
                        onChange={handleFormChange}
                    />
                </Grid>
                <Grid item xs={12}>
                    <FormControlLabel
                        className={classes.confirmationEmailCheckbox}
                        control={
                            <Checkbox
                                id="sendConfirmationEmail"
                                color="secondary"
                                name="sendConfirmationEmail"
                                checked={formValues.sendConfirmationEmail.value}
                                value={formValues.sendConfirmationEmail.value}
                                onChange={handleFormChange}
                            />
                        }
                        label="Send confirmation email"
                    />
                </Grid>
            </Grid>
            <div className={classes.saveButtonDiv}>
                <Fab
                    className={success ? classes.success : classes.saveButton}
                    aria-label="save"
                    color="secondary"
                    type="submit"
                    disabled={loading || !valid}
                    onClick={handleSubmit}
                >
                    {success ? <CheckIcon /> : <SaveIcon />}
                </Fab>
                {loading && <CircularProgress size={68} className={classes.progress} />}
            </div>
        </Root>
    )
}

export const NewBookingForm = WithErrorDialog(InnerNewBookingForm)
