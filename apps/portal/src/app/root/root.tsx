import { StyledEngineProvider, ThemeProvider, createTheme } from '@mui/material/styles'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { httpBatchLink, createTRPCClient } from '@trpc/client'
import { ConfigProvider, type ThemeConfig } from 'antd'
import mixpanel from 'mixpanel-browser'
import { useState } from 'react'
import { Outlet, ScrollRestoration } from 'react-router-dom'
import { Toaster } from 'sonner'

import { getApplicationDomain } from '@fizz-kidz/core'

import { FirebaseProvider } from '@integrations/firebase/firebase-provider'
import useFirebase from '@integrations/firebase/use-firebase'
import { MixpanelContext } from '@integrations/mixpanel/MixpanelContext'
import { TRPCProvider } from '@integrations/trpc'
import { AuthProvider } from '@session/auth-provider'
import { OrgProvider } from '@session/org.provider'
import { ConfirmationDialogWithCheckboxProvider } from '@shared/components/dialogs/confirmation-with-checkbox/confirmation-dialog-with-checkbox.provider'
import { ConfirmationDialogProvider } from '@shared/components/dialogs/confirmation/confirmation-dialog.provider'

import { AppUpdatePrompt } from './app-update-prompt'

import type { AppRouter } from '@/app/trpc/app.trpc'
mixpanel.init(import.meta.env.VITE_MIXPANEL_API_KEY, { debug: import.meta.env.VITE_ENV === 'dev' })

const theme = createTheme({
    palette: {
        background: {
            default: '#fafafa',
        },
        primary: {
            light: '#515051',
            main: '#02152A',
            dark: '#000000',
            contrastText: '#ffffff',
        },
        secondary: {
            light: '#e576c3',
            main: '#B14592',
            dark: '#7f0c64',
            contrastText: '#FFFFFF',
        },
    },
})

const antdTheme: ThemeConfig = {
    token: {
        colorPrimary: '#B14592',
        fontSize: 16,
    },
}

function InnerRoot() {
    const firebase = useFirebase()

    const domain = getApplicationDomain(
        import.meta.env.VITE_ENV,
        ['emulator', 'prod-local'].includes(import.meta.env.MODE)
    )

    const [queryClient] = useState(() => new QueryClient())
    const [trpcClient] = useState(() =>
        createTRPCClient<AppRouter>({
            links: [
                httpBatchLink({
                    url: `${domain}/api/trpc`,
                    async headers() {
                        // first try refresh the users token - this means when returning to the app
                        // after a while, it will refresh the token and work nicely.
                        let authToken = (await firebase.auth.currentUser?.getIdToken()) || ''
                        if (!authToken) {
                            // however when refreshing the page, firebase.auth.currentUser is undefined, and we cannot access the AuthUserContext in here.
                            // to get around this, check the cache for the jwt, and use it if it is there.
                            // since this code is only reached during a full page refresh (or user is not logged in),
                            // if the token is expired, onAuthStateChanged should be triggered and on the second attempt firebase.auth.currentUser should be found.
                            const cachedAuthUser = localStorage.getItem('authUser')
                            if (cachedAuthUser) {
                                const authUser = JSON.parse(cachedAuthUser)
                                authToken = authUser.jwt
                            }
                        }
                        return {
                            authorization: authToken,
                        }
                    },
                }),
            ],
        })
    )

    return (
        <MixpanelContext value={mixpanel}>
            <StyledEngineProvider injectFirst>
                <ThemeProvider theme={theme}>
                    <ConfigProvider theme={antdTheme}>
                        <LocalizationProvider dateAdapter={AdapterLuxon} adapterLocale="en-AU">
                            <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
                                <QueryClientProvider client={queryClient}>
                                    <AuthProvider>
                                        <OrgProvider>
                                            <ConfirmationDialogProvider>
                                                <ConfirmationDialogWithCheckboxProvider>
                                                    <ScrollRestoration />
                                                    <AppUpdatePrompt />
                                                    <Toaster richColors />
                                                    <Outlet />
                                                </ConfirmationDialogWithCheckboxProvider>
                                            </ConfirmationDialogProvider>
                                        </OrgProvider>
                                    </AuthProvider>
                                </QueryClientProvider>
                            </TRPCProvider>
                        </LocalizationProvider>
                    </ConfigProvider>
                </ThemeProvider>
            </StyledEngineProvider>
        </MixpanelContext>
    )
}

export function Root() {
    return (
        <FirebaseProvider>
            <InnerRoot />
        </FirebaseProvider>
    )
}
