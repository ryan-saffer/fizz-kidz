// https://stackoverflow.com/a/58962072/7870403
export function isObjKey<T extends object>(key: PropertyKey, obj: T): key is keyof T {
    return key in obj
}

// Fixes the typing of `Object.keys()`
export function ObjectKeys<T extends object>(object: T) {
    return Object.keys(object) as (keyof T)[]
}

// Fixes the typing of `Object.entries()`
export function ObjectEntries<T extends object>(object: T) {
    return Object.entries(object) as {
        [K in keyof T]: [K, T[K]]
    }[keyof T][]
}

export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>
}

// https://stackoverflow.com/a/57103940/7870403
export type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never

export type WithoutId<T> = DistributiveOmit<T, 'id'>
export type WithId<T> = T & { id: string }

export type WithoutUid<T> = DistributiveOmit<T, 'uid'>

// https://stackoverflow.com/a/53276873/7870403
export type PartialRecord<K extends keyof any, T> = {
    [P in K]?: T
}

/**
 * Given the value of an object, find the key of this value.
 * Only works for string records.
 */
export function getKeyByValue<T extends Record<string, string>>(obj: T, value: string) {
    return Object.entries(obj).find(([, v]) => v === value)?.[0] as keyof T | undefined
}

export function isNotNull<T>(value: T | null): value is T {
    return value !== null
}

export * from './application-domain'
export * from './contact-info'
export * from './stringUtilities'
export * from './assert-never'
