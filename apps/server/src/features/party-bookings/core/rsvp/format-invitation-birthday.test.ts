import { describe, expect, it } from 'vitest'

import { formatInvitationBirthday } from './format-invitation-birthday'

describe('formatInvitationBirthday', () => {
    describe('one child', () => {
        it.each([
            ['Mia', '4', "Mia's 4th"],
            ['Mia', '1', "Mia's 1st"],
            ['Mia', '2', "Mia's 2nd"],
            ['Mia', '3', "Mia's 3rd"],
            ['Mia', '11', "Mia's 11th"],
            ['Mia', '22', "Mia's 22nd"],
            ['James', '5', "James' 5th"],
            ['  Mia ', ' 4 ', "Mia's 4th"],
        ])('%s, %s -> %s', (name, age, expected) => {
            expect(formatInvitationBirthday(name, age)).toBe(expected)
        })
    })

    describe('pairs each name with its age when every age is a number and the counts match', () => {
        it.each([
            ['Mia & John', '4 & 3', "Mia's 4th & John's 3rd"],
            ['Mia and John', '4 and 3', "Mia's 4th & John's 3rd"],
            ['Mia, John', '4, 3', "Mia's 4th & John's 3rd"],
            ['Mia, John & Sam', '4, 3 & 1', "Mia's 4th, John's 3rd & Sam's 1st"],
            ['Mia & James', '4 & 3', "Mia's 4th & James' 3rd"],
        ])('%s, %s -> %s', (name, age, expected) => {
            expect(formatInvitationBirthday(name, age)).toBe(expected)
        })
    })

    describe('uses one possessive when a single age is shared', () => {
        it.each([
            ['Lachie & Matthew', '6', "Lachie & Matthew's 6th"],
            ['Lachie and Matthew', '6', "Lachie and Matthew's 6th"],
        ])('%s, %s -> %s', (name, age, expected) => {
            expect(formatInvitationBirthday(name, age)).toBe(expected)
        })
    })

    describe('suffixes each age when every age is a number but the counts differ', () => {
        it.each([
            ['Mia, John & Sam', '4 & 3', "Mia, John & Sam's 4th & 3rd"],
            ['The twins', '4 & 3', "The twins' 4th & 3rd"],
        ])('%s, %s -> %s', (name, age, expected) => {
            expect(formatInvitationBirthday(name, age)).toBe(expected)
        })
    })

    describe('keeps the age as typed when any part is not a number', () => {
        it.each([
            ['john and mia', 'five and six', "john and mia's five and six"],
            ['Mia', 'two', "Mia's two"],
            ['Mia', '6 and a half', "Mia's 6 and a half"],
            ['Mia & John', '4 & three', "Mia & John's 4 & three"],
        ])('%s, %s -> %s', (name, age, expected) => {
            expect(formatInvitationBirthday(name, age)).toBe(expected)
        })
    })

    it('does not split names that contain "and"', () => {
        expect(formatInvitationBirthday('Anderson & Andy', '4 & 3')).toBe("Anderson's 4th & Andy's 3rd")
    })
})
