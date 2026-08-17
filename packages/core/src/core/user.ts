import type { PartialRecord } from '../utilities'
import type { Role } from './role'
import type { StudioOrMaster } from './studio'

type BaseUser = {
    uid: string
    email: string
    imageUrl: string | null
    firstname?: string
    lastname?: string
}

export type StaffUser = BaseUser & {
    roles?: PartialRecord<StudioOrMaster, Role>
    accountType: 'staff'
}

export type CustomerUser = BaseUser & {
    accountType: 'customer'
}

export type AuthUser = StaffUser | CustomerUser
