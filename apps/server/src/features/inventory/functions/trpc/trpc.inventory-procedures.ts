import { RolePermissionMap, isStudio } from '@fizz-kidz/core'
import type { Permission, Studio } from '@fizz-kidz/core'

import { throwTrpcError } from '@/app/trpc/transport-errors'
import { authenticatedProcedure } from '@/app/trpc/trpc'
import { DatabaseClient } from '@/integrations/firebase/database.client'

export const inventoryReadProcedure = createGlobalInventoryProcedure('inventory:read')
export const inventoryManageItemsProcedure = createGlobalInventoryProcedure('inventory:manage-items')
export const inventoryShoppingListProcedure = createShoppingListInventoryProcedure()
export const inventoryLocationReadProcedure = createLocationInventoryProcedure('inventory:read', 'location')
export const inventoryLocationUpdateStockProcedure = createLocationInventoryProcedure(
    'inventory:update-stock',
    'location'
)

function createGlobalInventoryProcedure(permission: Permission) {
    return authenticatedProcedure.use(async ({ ctx, next }) => {
        await assertGlobalInventoryPermission({ uid: ctx.uid, permission })
        return next()
    })
}

function createLocationInventoryProcedure(permission: Permission, locationField: 'location') {
    return authenticatedProcedure.use(async ({ ctx, getRawInput, next }) => {
        const location = getStudioFromInput(await getRawInput(), locationField)

        if (location) {
            await assertInventoryPermission({ uid: ctx.uid, location, permission })
        } else {
            await assertGlobalInventoryPermission({ uid: ctx.uid, permission })
        }

        return next()
    })
}

function createShoppingListInventoryProcedure() {
    return authenticatedProcedure.use(async ({ ctx, getRawInput, next }) => {
        const rawInput = await getRawInput()
        if (getMasterFromInput(rawInput, 'location')) {
            await assertMasterInventoryPermission({ uid: ctx.uid, permission: 'inventory:shopping-list' })
            return next()
        }

        const location = getStudioFromInput(rawInput, 'location')
        if (!location) {
            throwTrpcError('BAD_REQUEST', 'inventory shopping list requires a studio or master location')
        }

        await assertInventoryPermission({ uid: ctx.uid, location, permission: 'inventory:shopping-list' })
        return next()
    })
}

function getStudioFromInput(input: unknown, field: 'location') {
    if (!input || typeof input !== 'object') return undefined

    const location = (input as Record<string, unknown>)[field]
    if (typeof location === 'string' && isStudio(location)) {
        return location
    }

    return undefined
}

function getMasterFromInput(input: unknown, field: 'location') {
    if (!input || typeof input !== 'object') return false

    return (input as Record<string, unknown>)[field] === 'master'
}

async function assertInventoryPermission(input: { uid: string; location: Studio; permission: Permission }) {
    const user = await DatabaseClient.getUser(input.uid)
    if (user?.accountType !== 'staff' || !user.roles) {
        throwTrpcError('FORBIDDEN', 'inventory requires staff access')
    }

    const studioRole = user.roles[input.location]
    const masterRole = user.roles.master

    if (studioRole && RolePermissionMap[studioRole].includes(input.permission)) {
        return
    }

    if (masterRole && RolePermissionMap[masterRole].includes(input.permission)) {
        return
    }

    throwTrpcError('FORBIDDEN', `inventory requires '${input.permission}' permission for '${input.location}'`)
}

async function assertGlobalInventoryPermission(input: { uid: string; permission: Permission }) {
    const user = await DatabaseClient.getUser(input.uid)
    if (user?.accountType !== 'staff' || !user.roles) {
        throwTrpcError('FORBIDDEN', 'inventory requires staff access')
    }

    const canAccessInventory = Object.values(user.roles).some((role) =>
        RolePermissionMap[role].includes(input.permission)
    )
    if (canAccessInventory) {
        return
    }

    throwTrpcError('FORBIDDEN', `inventory requires '${input.permission}' permission`)
}

async function assertMasterInventoryPermission(input: { uid: string; permission: Permission }) {
    const user = await DatabaseClient.getUser(input.uid)
    if (user?.accountType !== 'staff' || !user.roles) {
        throwTrpcError('FORBIDDEN', 'inventory requires staff access')
    }

    const masterRole = user.roles.master
    if (masterRole && RolePermissionMap[masterRole].includes(input.permission)) {
        return
    }

    throwTrpcError('FORBIDDEN', `inventory requires '${input.permission}' permission for 'master'`)
}
