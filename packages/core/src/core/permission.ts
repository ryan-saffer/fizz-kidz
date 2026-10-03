import type { Role } from './role'

const PERMISSIONS = [
    'dashboard:view',
    'bookings:read',
    'bookings:edit',
    'bookings:create',
    'bookings:collect-payment',
    'products:sell',
    'after-school-programs:read',
    'creations:read',
    'inventory:read',
    'inventory:update-stock', // receive, count and remove stock
    'inventory:manage-items', // create, edit and link items to Square
    'inventory:shopping-list',
    'website-chats:read',
    'website-chats:delete',
    'admin', // everything else.. could be broken down, but unneccesary for now.
] as const

export type Permission = (typeof PERMISSIONS)[number]

export const RolePermissionMap: Record<Role, Permission[]> = {
    admin: [
        'admin',
        'dashboard:view',
        'bookings:read',
        'bookings:create',
        'bookings:edit',
        'creations:read',
        'after-school-programs:read',
        'inventory:read',
        'inventory:update-stock',
    ],
    'studio-ipad': [
        'dashboard:view',
        'bookings:read',
        'bookings:collect-payment',
        'products:sell',
        'creations:read',
        'after-school-programs:read',
        'inventory:read',
    ],
    manager: [
        'dashboard:view',
        'bookings:edit',
        'bookings:read',
        'creations:read',
        'after-school-programs:read',
        'inventory:read',
        'inventory:update-stock',
    ],
    facilitator: ['dashboard:view', 'after-school-programs:read'],
    'super-admin': [
        'admin',
        'dashboard:view',
        'bookings:read',
        'bookings:create',
        'bookings:edit',
        'bookings:collect-payment',
        'products:sell',
        'creations:read',
        'after-school-programs:read',
        'inventory:read',
        'inventory:update-stock',
        'inventory:manage-items',
        'inventory:shopping-list',
        'website-chats:read',
        'website-chats:delete',
    ],
}
