import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import NavigateBefore from '@mui/icons-material/NavigateBefore'
import NavigateNext from '@mui/icons-material/NavigateNext'
import {
    Box,
    Button,
    CssBaseline,
    Drawer,
    FormControl,
    Grid,
    Hidden,
    MenuItem,
    Select,
    useMediaQuery,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import { MobileDatePicker } from '@mui/x-date-pickers'
import { StaticDatePicker } from '@mui/x-date-pickers'
import { DateTime } from 'luxon'
import { useState } from 'react'

import { STUDIOS, capitalise } from '@fizz-kidz/core'

import { useStickyNavbar } from '@app/root/use-sticky-navbar'
import { useOrg } from '@session/use-org'
import { useSidebar } from '@shared/components/ui/sidebar'

import { useLocationFilter } from '../location-filter/location-filter.hook'
import { DateNavigationContext } from './date-navigation.context'

import type { LocationFilter } from '../location-filter/location-filter.context'
import type { FC, PropsWithChildren, ReactNode } from 'react'

const PREFIX = 'BookingsPage'

const classes = {
    root: `${PREFIX}-root`,
    drawer: `${PREFIX}-drawer`,
    drawerPaper: `${PREFIX}-drawerPaper`,
    content: `${PREFIX}-content`,
    appBar: `${PREFIX}-appBar`,
    appBarToolbar: `${PREFIX}-appBarToolbar`,
    logo: `${PREFIX}-logo`,
    topLeft: `${PREFIX}-topLeft`,
    topCenter: `${PREFIX}-topCenter`,
    authTopRight: `${PREFIX}-authTopRight`,
    noAuthTopRight: `${PREFIX}-noAuthTopRight`,
    logoutIcon: `${PREFIX}-logoutIcon`,
    toolbar: `${PREFIX}-toolbar`,
    inlineDatePicker: `${PREFIX}-inlineDatePicker`,
    location: `${PREFIX}-location`,
    dialogueAppBar: `${PREFIX}-dialogueAppBar`,
    divider: `${PREFIX}-divider`,
    paper: `${PREFIX}-paper`,
    layout: `${PREFIX}-layout`,
    dialog: `${PREFIX}-dialog`,
}

const StyledHeading = styled('h1')({})

const Root = styled('div')(({ theme }) => ({
    [`&.${classes.root}`]: {
        display: 'flex',
        height: '100%',
        background: '#F0F2F5',
        minHeight: 'calc(100vh - 64px)',
    },

    [`& .${classes.drawer}`]: {
        width: drawerWidth,
        flexShrink: 0,
        zIndex: 1,
    },

    [`& .${classes.drawerPaper}`]: {
        width: drawerWidth,
        border: 0,
        left: 'var(--dashboard-sidebar-offset, 0px)',
        transition: theme.transitions.create('left', {
            duration: theme.transitions.duration.shorter,
            easing: theme.transitions.easing.easeInOut,
        }),
    },

    [`& .${classes.content}`]: {
        flexGrow: 1,
        backgroundColor: '#F0F2F5',
        // padding: theme.spacing(3),
    },

    [`& .${classes.appBar}`]: {
        zIndex: theme.zIndex.drawer + 1,
    },

    [`& .${classes.logo}`]: {
        height: 50,
        cursor: 'pointer',
        position: 'absolute',
        left: '50%',
        right: '50%',
        transform: 'translate(-50%)',
    },

    [`& .${classes.topLeft}`]: {
        width: '33.3%',
        display: 'flex',
        justifyContent: 'flex-start',
        '@media (max-width: 550px)': {
            display: 'none',
        },
    },

    [`& .${classes.topCenter}`]: {
        width: '33.3%',
        display: 'flex',
        justifyContent: 'center',
    },

    [`& .${classes.authTopRight}`]: {
        width: '33.3%',
        display: 'flex',
        justifyContent: 'flex-end',
        '@media (max-width: 550px)': {
            width: 'auto',
        },
    },

    [`& .${classes.noAuthTopRight}`]: {
        width: '33.3%',
        display: 'flex',
        justifyContent: 'flex-end',
        '@media (max-width: 550px)': {
            display: 'none',
        },
    },

    [`& .${classes.logoutIcon}`]: {
        paddingTop: theme.spacing(1),
        paddingRight: '0px',
        paddingBottom: theme.spacing(1),
        paddingLeft: theme.spacing(2),
        '@media (max-width: 550px)': {
            display: 'none',
        },
    },

    [`& .${classes.toolbar}`]: theme.mixins.toolbar,
}))

type Props = {
    label: string
    /** Shown beside the heading to staff who can create bookings. */
    action?: ReactNode
}

function midnight(date: DateTime) {
    return date.set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
}

export const DateNavigation: FC<PropsWithChildren<Props>> = (props) => {
    const { action, children } = props

    const { hasPermission } = useOrg()
    const createPermissions = hasPermission('bookings:create')

    const [date, setDate] = useState(midnight(DateTime.now()))
    const [, setLoading] = useState(true)

    const handleDateChange = (date: DateTime) => {
        setDate(midnight(date))
    }

    const { selectedLocation, filterByLocation } = useLocationFilter()

    const wrapFilter = useMediaQuery('(max-width: 550px)')
    const { isMobile, open } = useSidebar()
    const dashboardSidebarOffset = open && !isMobile ? 'var(--sidebar-width)' : '0px'

    useStickyNavbar()

    const { currentOrg } = useOrg()

    return (
        <Root
            className={classes.root}
            style={{ '--dashboard-sidebar-offset': dashboardSidebarOffset } as React.CSSProperties}
        >
            <CssBaseline />
            <Hidden mdDown>
                <Drawer
                    className={classes.drawer}
                    variant="permanent"
                    classes={{
                        paper: classes.drawerPaper,
                    }}
                    anchor="left"
                >
                    <div className={classes.toolbar} />
                    <StaticDatePicker
                        orientation="portrait"
                        value={date}
                        slotProps={{ actionBar: { actions: ['today'] } }}
                        onChange={(date) => handleDateChange(date!)}
                    />
                </Drawer>
            </Hidden>
            <Grid container className="dashboard-full-screen">
                <Box className={classes.content} sx={{ padding: { xs: 2, md: 3 } }}>
                    <div className="mb-2 flex items-center justify-between">
                        <StyledHeading
                            className="lilita"
                            sx={{
                                marginBottom: 0,
                                marginTop: 0,
                                fontSize: {
                                    xs: 24,
                                    sm: 32,
                                },
                            }}
                        >
                            Parties, Events & Incursions
                        </StyledHeading>
                        {createPermissions && action}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexDirection: wrapFilter ? 'column' : 'row' }}>
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                                flex: 2,
                            }}
                        >
                            <Button
                                onClick={() => handleDateChange(date.minus({ days: 1 }))}
                                sx={{
                                    background: 'white',
                                    borderRadius: 2,
                                    flexShrink: 2,
                                    ':hover': { border: '1px solid black' },
                                }}
                            >
                                <NavigateBefore />
                            </Button>
                            <MobileDatePicker
                                closeOnSelect
                                value={date}
                                sx={{ flexShrink: 1 }}
                                slotProps={{
                                    textField: {
                                        sx: {
                                            input: {
                                                textAlign: 'center',
                                                background: 'white',
                                                borderWidth: 0,
                                                borderRadius: 2,
                                                cursor: 'pointer',
                                                ':hover': {
                                                    background: '#E8EBED',
                                                    border: '1px solid black',
                                                    margin: '-1px',
                                                },
                                            },
                                            '& .MuiInputBase-adornedEnd': {
                                                paddingRight: 0,
                                            },
                                            fieldSet: {
                                                borderWidth: 0,
                                            },
                                        },
                                        fullWidth: true,
                                    },
                                    actionBar: { actions: ['today'] },
                                }}
                                format="ccc, LLL d, y"
                                onChange={(date) => date && handleDateChange(date)}
                            />
                            <Button
                                onClick={() => handleDateChange(date.plus({ days: 1 }))}
                                sx={{
                                    background: 'white',
                                    borderRadius: 2,
                                    flexShrink: 2,
                                    ':hover': { border: '1px solid black' },
                                }}
                            >
                                <NavigateNext />
                            </Button>
                        </div>
                        {currentOrg === 'master' && (
                            <FormControl sx={{ background: 'white', flex: 1 }}>
                                <Select
                                    value={selectedLocation}
                                    onChange={(e) => filterByLocation(e.target.value as LocationFilter)}
                                >
                                    <MenuItem value="all">
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <LocationOnOutlinedIcon sx={{ color: '#0f172a', width: 20, height: 20 }} />
                                            <div>All Locations</div>
                                        </div>
                                    </MenuItem>
                                    {STUDIOS.map((studio) => (
                                        <MenuItem key={studio} value={studio}>
                                            {capitalise(studio)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </div>
                    <DateNavigationContext value={{ date, setDate: handleDateChange, setLoading }}>
                        {children}
                    </DateNavigationContext>
                </Box>
            </Grid>
        </Root>
    )
}

const drawerWidth = 320
