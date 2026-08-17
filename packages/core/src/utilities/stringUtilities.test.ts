import { strictEqual } from 'assert'

import { describe, it } from 'vite-plus/test'

import { addOrdinalSuffix, capitalise } from './stringUtilities'

describe('Fizz Kidz Utilities', () => {
    describe('capitalise', () => {
        it('capitalises the first character without changing the rest', () => {
            strictEqual(capitalise('fizz Kidz'), 'Fizz Kidz')
        })

        it('handles an empty string', () => {
            strictEqual(capitalise(''), '')
        })
    })

    describe('addOrdinalSuffix', () => {
        it('should return "1st" for "1"', () => {
            strictEqual(addOrdinalSuffix('1'), '1st')
        })
        it('should return "2nd" for "2"', () => {
            strictEqual(addOrdinalSuffix('2'), '2nd')
        })

        it('should return "3rd" for "3"', () => {
            strictEqual(addOrdinalSuffix('3'), '3rd')
        })

        it('should return "4th" for "4"', () => {
            strictEqual(addOrdinalSuffix('4'), '4th')
        })

        it('should return "11th" for "11"', () => {
            strictEqual(addOrdinalSuffix('11'), '11th')
        })

        it('should return "12th" for "12"', () => {
            strictEqual(addOrdinalSuffix('12'), '12th')
        })

        it('should return "13th" for "13"', () => {
            strictEqual(addOrdinalSuffix('13'), '13th')
        })

        it('should return "21st" for "21"', () => {
            strictEqual(addOrdinalSuffix('21'), '21st')
        })

        it('should return "22nd" for "22"', () => {
            strictEqual(addOrdinalSuffix('22'), '22nd')
        })

        it('should return "23rd" for "23"', () => {
            strictEqual(addOrdinalSuffix('23'), '23rd')
        })

        it('should return "101st" for "101"', () => {
            strictEqual(addOrdinalSuffix('101'), '101st')
        })

        it('should return "111th" for "111"', () => {
            strictEqual(addOrdinalSuffix('111'), '111th')
        })
        it("should return 'abcth' for 'abc'", () => {
            strictEqual(addOrdinalSuffix('abc'), 'abcth')
        })
        it("should return '4 & 5th' for '4 & 5'", () => {
            strictEqual(addOrdinalSuffix('4 & 5'), '4 & 5th')
        })
        it('should return "2 & 3rd" for "2 & 3"', () => {
            strictEqual(addOrdinalSuffix('2 & 3'), '2 & 3rd')
        })
    })
})
