import { useEffect, useState } from 'react'

import { ObjectKeys } from '@fizz-kidz/core'
import type { Permission, StudioOrMaster } from '@fizz-kidz/core'

import { checkRoleForPermission } from '@session/permissions'
import { useAuth } from '@session/use-auth'

import { OrgContext } from './org.context'

import type { ReactNode } from 'react'

export function OrgProvider({ children }: { children: ReactNode }) {
    const user = useAuth()

    const [selectedOrg, setSelectedOrg] = useState<StudioOrMaster | null>(() => {
        const cachedOrg = localStorage.getItem('selectedOrg')
        return cachedOrg ? (cachedOrg as StudioOrMaster) : null
    })

    const availableOrgs = (() => {
        if (user?.accountType !== 'staff' || !user.roles) return null
        const orgs = ObjectKeys(user.roles)
        return orgs.length > 0 ? orgs : null
    })()

    const currentOrg = (() => {
        if (!availableOrgs || availableOrgs.length === 0) return null
        if (selectedOrg && availableOrgs.includes(selectedOrg)) return selectedOrg
        return availableOrgs[0]
    })()

    const role = user?.accountType === 'staff' && currentOrg ? user.roles?.[currentOrg] || null : null

    const hasPermission = (permission: Permission) => {
        return checkRoleForPermission(role, permission)
    }

    const switchToOrg = (org: StudioOrMaster) => {
        setSelectedOrg(org)
        localStorage.setItem('selectedOrg', org)
    }

    useEffect(() => {
        if (!currentOrg) {
            setSelectedOrg(null)
            localStorage.removeItem('selectedOrg')
            return
        }

        if (currentOrg !== selectedOrg) {
            setSelectedOrg(currentOrg)
            localStorage.setItem('selectedOrg', currentOrg)
        }
    }, [currentOrg, selectedOrg])

    return (
        <OrgContext
            value={{
                availableOrgs,
                currentOrg,
                switchToOrg,
                role,
                hasPermission,
            }}
        >
            {children}
        </OrgContext>
    )
}
