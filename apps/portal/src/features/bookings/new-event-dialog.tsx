import { Close as CloseIcon } from '@mui/icons-material'
import { AppBar, CssBaseline, Dialog, IconButton, Paper, Slide, Toolbar, Typography } from '@mui/material'
import { grey } from '@mui/material/colors'
import { styled } from '@mui/material/styles'
import { DateTime } from 'luxon'
import React, { useState } from 'react'

import { useDateNavigation } from './date-navigation/date-navigation.hooks'
import { NewEventForm } from './events/forms/new-event-form'

import type { TransitionProps } from '@mui/material/transitions'
import type { ReactElement, Ref } from 'react'

const PREFIX = 'NewEventDialog'

const classes = {
    layout: `${PREFIX}-layout`,
    dialog: `${PREFIX}-dialog`,
    appBar: `${PREFIX}-appBar`,
    paper: `${PREFIX}-paper`,
}

const StyledDialog = styled(Dialog)(({ theme }) => ({
    [`& .${classes.layout}`]: {
        width: 'auto',
        marginLeft: theme.spacing(2),
        marginRight: theme.spacing(2),
        [theme.breakpoints.up(800 + parseInt(theme.spacing(2).substring(-2)) * 2)]: {
            width: 800,
            marginLeft: 'auto',
            marginRight: 'auto',
        },
    },

    [`& .MuiDialog-paper`]: {
        backgroundColor: grey[200],
    },

    [`& .${classes.appBar}`]: {
        position: 'relative',
    },

    [`& .${classes.paper}`]: {
        marginBottom: theme.spacing(3),
        padding: theme.spacing(2),
        [theme.breakpoints.up(800 + parseInt(theme.spacing(3).substring(-2)) * 2)]: {
            marginBottom: theme.spacing(6),
            padding: theme.spacing(3),
        },
    },
}))

type Props = {
    open: boolean
    onClose: () => void
}

const Transition = React.forwardRef(
    (
        props: TransitionProps & {
            children: ReactElement<any, any>
        },
        ref: Ref<unknown>
    ) => <Slide direction="up" ref={ref} {...props} />
)

/** Books an event. Party bookings have their own sheet. */
const NewEventDialog: React.FC<Props> = ({ open, onClose }) => {
    // used to ensure form mounts on each open. See https://github.com/reactjs/react-modal/issues/106#issuecomment-546658885
    const [key, setKey] = useState(0)

    const { setDate } = useDateNavigation()

    function handleBookingCreated(date?: Date) {
        setKey(key + 1)
        onClose()
        if (date) {
            setDate(DateTime.fromJSDate(date))
        }
    }

    return (
        <StyledDialog
            fullScreen
            open={open}
            onClose={() => handleBookingCreated()}
            TransitionComponent={Transition}
            disableAutoFocus={true}
            slotProps={{}}
        >
            <CssBaseline />
            <AppBar position="absolute" className={classes.appBar}>
                <Toolbar>
                    <IconButton
                        edge="start"
                        color="inherit"
                        onClick={() => handleBookingCreated()}
                        aria-label="close"
                        size="large"
                    >
                        <CloseIcon />
                    </IconButton>
                    <Typography variant="h6" color="inherit">
                        New Event Booking
                    </Typography>
                </Toolbar>
            </AppBar>
            <main key={key} className={classes.layout}>
                <Paper className={classes.paper}>
                    <NewEventForm onSuccess={handleBookingCreated} />
                </Paper>
            </main>
        </StyledDialog>
    )
}

export default NewEventDialog
