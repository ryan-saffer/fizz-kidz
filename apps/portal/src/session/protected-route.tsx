import { Navigate, useLocation } from 'react-router-dom'

import { isFranchiseOrMaster, type Permission } from '@fizz-kidz/core'

import { useAuth } from '@session/use-auth'

import Unauthorised from './Unauthorised'
import { useOrg } from './use-org'

import type { ReactNode } from 'react'

export function ProtectedRoute({
    permission,
    franchiseOrMaster = false,
    children,
}: {
    permission: Permission
    // Limits access to this page to only 'Corporate Studios' or a Franchise studio. Corporate studios such as 'Malvern' will redirect back to the dashboard.
    franchiseOrMaster?: boolean
    children: ReactNode
}) {
    const authUser = useAuth()
    const { hasPermission, currentOrg } = useOrg()
    const location = useLocation()
    if (!authUser?.uid) {
        // come back to this page (and its query, e.g. a CRM link's booking details) once signed in
        const returnTo = encodeURIComponent(location.pathname + location.search)
        return <Navigate to={`/sign-in?returnTo=${returnTo}`} replace />
    }

    if (!currentOrg) {
        return <Unauthorised showLogout />
    }

    if (!hasPermission(permission)) {
        return <Unauthorised />
    }

    if (franchiseOrMaster && !isFranchiseOrMaster(currentOrg)) {
        return <Navigate to="/dashboard" />
    }

    return children
}
