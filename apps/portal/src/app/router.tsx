import '/fonts/LilitaOne-Regular.ttf'
import '/fonts/Gotham-Light.otf'
import { Suspense, lazy } from 'react'
import { Navigate, RouterProvider, createBrowserRouter, useParams, useSearchParams } from 'react-router-dom'

import { NotFound404 } from '@app/root/404.js'
import { Root } from '@app/root/root.js'
import { ProtectedRoute } from '@session/protected-route.js'
import { SignedIn } from '@session/signed-in.js'
import { SignedOut } from '@session/signed-out.js'
import Loader from '@shared/components/loader.js'

/**
 * Lazy load all pages. This enables much cleaner code splitting, particularly for parents booking in
 * a program that do not need all the javascript for the entire dashboard.
 */
const SignInPage = lazy(() =>
    import('../features/authentication/pages/sign-in-page.js').then((module) => ({ default: module.SignInPage }))
)
const Paperform = lazy(() =>
    import('../features/forms/paperform-page.js').then((module) => ({ default: module.Paperform }))
)
const SignUpPage = lazy(() =>
    import('../features/authentication/pages/sign-up-page.js').then((module) => ({ default: module.SignUpPage }))
)
const ResetPasswordPage = lazy(() =>
    import('../features/authentication/pages/reset-password-page.js').then((module) => ({
        default: module.ResetPasswordPage,
    }))
)
const ResetPasswordConfirmPage = lazy(() =>
    import('../features/authentication/pages/reset-password-confirm-page.js').then((module) => ({
        default: module.ResetPasswordConfirmPage,
    }))
)
const Navigation = lazy(() => import('./navigation/navigation.js').then((module) => ({ default: module.Navigation })))
const BookingsPage = lazy(() =>
    import('../features/bookings/bookings-page.js').then((module) => ({ default: module.BookingsPage }))
)
const SelectClassPage = lazy(() =>
    import('../features/after-school-program/Checkin/select-class-page.js').then((module) => ({
        default: module.SelectClassPage,
    }))
)
const AfterSchoolProgramCheckinClassDetails = lazy(() =>
    import('../features/after-school-program/Checkin/ClassDetails/index.js').then((module) => ({
        default: module.AfterSchoolProgramCheckinClassDetails,
    }))
)
const AfterSchoolProgramInvoicingPage = lazy(() =>
    import('../features/after-school-program/Invoicing/after-school-program-invoicing-page.js').then((module) => ({
        default: module.AfterSchoolProgramInvoicingPage,
    }))
)
const AfterSchoolProgramInvoicing = lazy(() =>
    import('../features/after-school-program/Invoicing/InvoiceStatusPage/index.js').then((module) => ({
        default: module.AfterSchoolProgramInvoicing,
    }))
)
const HolidayProgramSelectionPage = lazy(() =>
    import('../features/holiday-programs/holiday-program-class-selection-page.js').then((module) => ({
        default: module.HolidayProgramSelectionPage,
    }))
)
const ClassDetailsPage = lazy(() =>
    import('../features/holiday-programs/class-details/index.js').then((module) => ({
        default: module.ClassDetailsPage,
    }))
)
const Payroll = lazy(() => import('../features/payroll/Payroll.js').then((module) => ({ default: module.Payroll })))
const EnrolmentPage = lazy(() =>
    import('../features/after-school-program/Enrolment/index.js').then((module) => ({ default: module.EnrolmentPage }))
)
const ParentPortalRoot = lazy(() =>
    import('../features/after-school-program/ParentPortal/index.js').then((module) => ({
        default: module.ParentPortalRoot,
    }))
)
const AfterSchoolProgramEnrolmentPage = lazy(() =>
    import('../features/after-school-program/enrolment-form/after-school-program-enrolment-page.js').then((module) => ({
        default: module.AfterSchoolProgramEnrolmentPage,
    }))
)
const PreschoolProgramEnrolmentPage = lazy(() =>
    import('../features/preschool-program/booking-form/pages/preschool-program-enrolment-page.js').then((module) => ({
        default: module.PreschoolProgramEnrolmentPage,
    }))
)
const PreschoolProgramSessionSelectorPage = lazy(() =>
    import('../features/preschool-program/attendance/session-selector/preschool-program-session-selector-page.js').then(
        (module) => ({ default: module.PreschoolProgramSessionSelectorPage })
    )
)
const PreschoolProgramSessionAttendancePage = lazy(() =>
    import('../features/preschool-program/attendance/session-attendance/pages/preschool-program-session-attendance-page.js').then(
        (module) => ({ default: module.PreschoolProgramSessionAttendancePage })
    )
)
const PreschoolProgramInvoicingPage = lazy(() =>
    import('../features/preschool-program/invoicing/pages/preschool-program-invoicing-page.js').then((module) => ({
        default: module.PreschoolProgramInvoicingPage,
    }))
)
const PreschoolProgramInvoiceStatusPage = lazy(() =>
    import('../features/preschool-program/invoicing/pages/preschool-program-invoice-status-page.js').then((module) => ({
        default: module.PreschoolProgramInvoiceStatusPage,
    }))
)
const SelectedProgramProvider = lazy(() =>
    import('../features/after-school-program/enrolment-form/selected-program.provider.js').then((module) => ({
        default: module.SelectedProgramProvider,
    }))
)
const CustomerBookingScreen = lazy(() =>
    import('../features/holiday-programs/customer-booking-screen/pages/customer-booking-page.js').then((module) => ({
        default: module.CustomerBookingPage,
    }))
)
const ManageHolidayProgramAppointment = lazy(() =>
    import('../features/holiday-programs/customer-booking-screen/pages/manage-appointment-page.js').then((module) => ({
        default: module.ManageAppointmentPage,
    }))
)
const Onboarding = lazy(() =>
    import('../features/onboarding/employee-onboarding.js').then((module) => ({ default: module.EmployeeOnboarding }))
)
const PartyCreationsPage = lazy(() =>
    import('../features/creations/party-creations-page.js').then((module) => ({ default: module.PartyCreationsPage }))
)
const HolidayCreationsPage = lazy(() =>
    import('../features/creations/holiday-program-creations-page.js').then((module) => ({
        default: module.HolidayCreationsPage,
    }))
)
const ChooseInvitationPage = lazy(() =>
    import('../features/invitations/choose-invitation-page.js').then((module) => ({
        default: module.ChooseInvitationPage,
    }))
)
const CreateInvitationPage = lazy(() =>
    import('../features/invitations/create-invitation-page.js').then((module) => ({
        default: module.CreateInvitationPage,
    }))
)
const ViewInvitationPage = lazy(() =>
    import('../features/invitations/view-invitation-page.js').then((module) => ({
        default: module.ViewInvitationPage,
    }))
)
const DiscountCodesPage = lazy(() =>
    import('../features/discount-codes/discount-codes-page.js').then((module) => ({
        default: module.DiscountCodesPage,
    }))
)
const SettingsPage = lazy(() =>
    import('../features/settings/settings-page.js').then((module) => ({ default: module.SettingsPage }))
)
const Account = lazy(() => import('../features/settings/account.js').then((module) => ({ default: module.Account })))
const ManageUsersTable = lazy(() =>
    import('../features/settings/manage-users-table.js').then((module) => ({ default: module.ManageUsersTable }))
)
const PlayLabBookingPage = lazy(() =>
    import('../features/play-lab/booking-form/pages/play-lab-booking-page.js').then((module) => ({
        default: module.PlayLabBookingPage,
    }))
)
const PreschoolProgramV2BookingPage = lazy(() =>
    import('../features/preschool-program/booking-v2/pages/preschool-program-v2-booking-page.js').then((module) => ({
        default: module.PreschoolProgramV2BookingPage,
    }))
)
const PlayLabSessionSelectorPage = lazy(() =>
    import('../features/play-lab/attendance/session-selector/play-lab-session-selector-page.js').then((module) => ({
        default: module.PlayLabSessionSelectorPage,
    }))
)
const PlayLabSessionAttendancePage = lazy(() =>
    import('../features/play-lab/attendance/session-attendance/pages/play-lab-session-attendance-page.js').then(
        (module) => ({
            default: module.PlayLabSessionAttendancePage,
        })
    )
)
const TerritoryMappingPage = lazy(() =>
    import('../features/territory-mapping/territory-mapping-page.js').then((module) => ({
        default: module.TerritoryMappingPage,
    }))
)
const ReportsPage = lazy(() =>
    import('../features/reports/reports-page.js').then((module) => ({ default: module.ReportsPage }))
)
const InventoryPage = lazy(() =>
    import('../features/inventory/pages/inventory-page.js').then((module) => ({ default: module.InventoryPage }))
)
const CreateInvitationPageV2 = lazy(() =>
    import('../features/rsvp/pages/create-invitation-page.js').then((module) => ({
        default: module.CreateInvitationPage,
    }))
)
const DesignInvitationPageV2 = lazy(() =>
    import('../features/rsvp/pages/design-invitation-page.js').then((module) => ({
        default: module.DesignInvitationPage,
    }))
)
const ViewInvitationPageV2 = lazy(() =>
    import('../features/rsvp/pages/view-invitation-page.js').then((module) => ({ default: module.ViewInvitationPage }))
)
const RsvpPage = lazy(() =>
    import('../features/rsvp/pages/rsvp-page.js').then((module) => ({ default: module.RsvpPage }))
)

const router = createBrowserRouter([
    {
        path: '/',
        Component: Root,
        ErrorBoundary: NotFound404,
        children: [
            {
                // redirects the base route to the dashboard, or the sign in page if not logged in
                index: true,
                Component: () => (
                    // <ProtectedRoute roles={[]}>
                    <Navigate to="dashboard" />
                    // </ProtectedRoute>
                ),
            },
            {
                path: 'sign-in',
                Component: function SignInRoute() {
                    const [searchParams] = useSearchParams()
                    const returnTo = searchParams.get('returnTo') ?? '/'
                    return (
                        <Suspense fallback={<Loader />}>
                            <SignedIn>
                                <Navigate to={returnTo} replace />
                            </SignedIn>
                            <SignedOut>
                                <SignInPage />
                            </SignedOut>
                        </Suspense>
                    )
                },
            },
            {
                path: 'sign-up',
                Component: () => (
                    <Suspense fallback={<Loader />}>
                        <SignedIn>
                            <Navigate to="/" />
                        </SignedIn>
                        <SignedOut>
                            <SignUpPage />
                        </SignedOut>
                    </Suspense>
                ),
            },
            {
                path: 'reset-password',
                Component: () => (
                    <Suspense fallback={<Loader />}>
                        <SignedIn>
                            <Navigate to="/" />
                        </SignedIn>
                        <SignedOut>
                            <ResetPasswordPage />
                        </SignedOut>
                    </Suspense>
                ),
            },
            {
                path: 'reset-password/confirm',
                Component: () => (
                    <Suspense fallback={<Loader />}>
                        <ResetPasswordConfirmPage />
                    </Suspense>
                ),
            },
            {
                path: 'form',
                children: [
                    {
                        index: true,
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <Paperform />
                            </Suspense>
                        ),
                    },
                ],
            },
            {
                path: 'dashboard',
                lazy: async () => {
                    const module = await import('./root/dashboard-layout.js')
                    return {
                        Component: module.DashboardLayout,
                    }
                },
                children: [
                    {
                        index: true,
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="dashboard:view">
                                    <Navigation />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'bookings',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="bookings:read">
                                    <BookingsPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'after-school-program',
                        children: [
                            {
                                index: true,
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="after-school-programs:read">
                                            <SelectClassPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: 'class',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="after-school-programs:read">
                                            <AfterSchoolProgramCheckinClassDetails />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'after-school-program-invoicing',
                        children: [
                            {
                                index: true,
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="admin" franchiseOrMaster>
                                            <AfterSchoolProgramInvoicingPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: 'class',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="admin" franchiseOrMaster>
                                            <AfterSchoolProgramInvoicing />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'territory-mapping',
                        children: [
                            {
                                index: true,
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="admin">
                                            <TerritoryMappingPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'reports',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="admin" franchiseOrMaster>
                                    <ReportsPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'inventory',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="inventory:read">
                                    <InventoryPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'holiday-program',
                        children: [
                            {
                                path: '',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <HolidayProgramSelectionPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: 'class',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <ClassDetailsPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'play-lab',
                        children: [
                            {
                                path: '',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <PlayLabSessionSelectorPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: ':appointmentTypeId',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <PlayLabSessionAttendancePage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'preschool-program',
                        children: [
                            {
                                path: '',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <PreschoolProgramSessionSelectorPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: ':appointmentTypeId',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="bookings:read">
                                            <PreschoolProgramSessionAttendancePage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'preschool-program-invoicing',
                        children: [
                            {
                                index: true,
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="admin" franchiseOrMaster>
                                            <PreschoolProgramInvoicingPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                            {
                                path: 'program',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ProtectedRoute permission="admin" franchiseOrMaster>
                                            <PreschoolProgramInvoiceStatusPage />
                                        </ProtectedRoute>
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                    {
                        path: 'payroll',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="admin" franchiseOrMaster>
                                    <Payroll />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'onboarding',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="admin" franchiseOrMaster>
                                    <Onboarding />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'creations',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="creations:read">
                                    <PartyCreationsPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'holiday-creations',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="creations:read">
                                    <HolidayCreationsPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'discount-codes',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="admin">
                                    <DiscountCodesPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                    },
                    {
                        path: 'settings',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ProtectedRoute permission="dashboard:view">
                                    <SettingsPage />
                                </ProtectedRoute>
                            </Suspense>
                        ),
                        children: [
                            {
                                path: '',
                                Component: () => <Navigate to="account" />,
                            },
                            {
                                path: 'account',
                                Component: () => (
                                    <Suspense fallback={<Loader />}>
                                        <Account />
                                    </Suspense>
                                ),
                            },
                            {
                                path: 'members',
                                Component: () => (
                                    <Suspense fallback={<Loader fullScreen />}>
                                        <ManageUsersTable />
                                    </Suspense>
                                ),
                            },
                        ],
                    },
                ],
            },
            {
                path: 'after-school-program-enrolment',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <EnrolmentPage />
                    </Suspense>
                ),
            },
            {
                path: 'parent-portal/:id',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <ParentPortalRoot />
                    </Suspense>
                ),
            },
            // TEMPORARY FIX FOR REDIRECT - TERM 3 2024 ACCIDENTALLY SENT WRONG LINK
            {
                path: 'science-program-booking-form',
                Component: () => <Navigate to="/after-school-program-enrolment-form" />,
            },
            {
                path: 'after-school-program-enrolment-form',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <SelectedProgramProvider>
                            <AfterSchoolProgramEnrolmentPage />
                        </SelectedProgramProvider>
                    </Suspense>
                ),
            },
            {
                path: 'preschool-program-enrolment-form',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <PreschoolProgramEnrolmentPage />
                    </Suspense>
                ),
            },
            {
                path: 'programs',
                children: [
                    {
                        path: 'manage/:appointmentId',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ManageHolidayProgramAppointment />
                            </Suspense>
                        ),
                    },
                    {
                        index: true,
                        Component: () => (
                            <Suspense>
                                {/* fallback looks awkward on this screen */}
                                <CustomerBookingScreen />
                            </Suspense>
                        ),
                    },
                ],
            },
            {
                path: 'play-lab-booking',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <PlayLabBookingPage />
                    </Suspense>
                ),
            },
            {
                path: 'preschool-program-v2-booking',
                Component: () => (
                    <Suspense fallback={<Loader fullScreen />}>
                        <PreschoolProgramV2BookingPage />
                    </Suspense>
                ),
            },
            {
                path: 'invitations',
                children: [
                    {
                        path: '',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ChooseInvitationPage />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'create',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <CreateInvitationPage />
                            </Suspense>
                        ),
                    },
                ],
            },
            {
                path: 'invite',
                children: [
                    {
                        path: '',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <CreateInvitationPageV2 />
                            </Suspense>
                        ),
                    },
                    {
                        path: 'design',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <DesignInvitationPageV2 />
                            </Suspense>
                        ),
                    },
                    {
                        path: ':id',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ViewInvitationPageV2 />
                            </Suspense>
                        ),
                    },
                    {
                        path: ':id/rsvp',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <RsvpPage />
                            </Suspense>
                        ),
                    },
                ],
            },
            {
                path: 'invitation',
                children: [
                    {
                        path: ':id',
                        Component: () => (
                            <Suspense fallback={<Loader fullScreen />}>
                                <ViewInvitationPage />
                            </Suspense>
                        ),
                    },
                ],
            },
            // FIXME: Delete after 2026-06-06 once all legacy /invitation/v2 links have expired.
            {
                path: 'invitation/v2',
                children: [
                    {
                        path: '',
                        Component: () => (
                            <Navigate to={{ pathname: '/invite', search: window.location.search }} replace />
                        ),
                    },
                    {
                        path: 'design',
                        Component: () => <Navigate to="/invite/design" replace />,
                    },
                    {
                        path: ':id',
                        Component: function LegacyInvitationRedirect() {
                            const { id } = useParams()
                            const [searchParams] = useSearchParams()
                            const redirectTo = searchParams.size
                                ? `/invite/${id}?${searchParams.toString()}`
                                : `/invite/${id}`
                            return <Navigate to={redirectTo} replace />
                        },
                    },
                    {
                        path: ':id/rsvp',
                        Component: function LegacyInvitationRsvpRedirect() {
                            const { id } = useParams()
                            const [searchParams] = useSearchParams()
                            const redirectTo = searchParams.size
                                ? `/invite/${id}/rsvp?${searchParams.toString()}`
                                : `/invite/${id}/rsvp`
                            return <Navigate to={redirectTo} replace />
                        },
                    },
                ],
            },
            // This route is pureley for backwards compat for opening bookings links in the calendar made before the dashboard.
            // This can be safely removed in January 2025 (once all existing bookings before the dashboard have passed).
            {
                path: 'bookings',
                Component: () => {
                    const [searchParams] = useSearchParams()
                    const bookingId = searchParams.get('id')

                    const route = bookingId ? `/dashboard/bookings?id=${bookingId}` : '/dashboard/bookings'
                    return <Navigate to={route} />
                },
            },
        ],
    },
])

export const App = () => {
    return <RouterProvider router={router} />
}
