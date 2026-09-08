import { describe, expect, it } from 'vite-plus/test'

import { formatHolidayProgramMedicalDetails, parseHolidayProgramMedicalDetails } from './medical-plans'

describe('Holiday Program medical details', () => {
    it('reads legacy anaphylaxis URLs and preserves multiline allergy notes', () => {
        expect(
            parseHolidayProgramMedicalDetails(
                'Peanuts\nSesame\n\nAnaphylactic: Yes\n\nAnaphylaxis plan: https://example.com/old.pdf?signature=abc'
            )
        ).toEqual({
            allergies: 'Peanuts\nSesame',
            isAnaphylactic: true,
            anaphylaxisPlan: 'https://example.com/old.pdf?signature=abc',
            requiresAsthmaActionPlan: false,
            asthmaActionPlan: '',
        })
    })

    it.each([false, true])(
        'round-trips asthma with anaphylaxis=%s without exposing plan references as allergy notes',
        (isAnaphylactic) => {
            const details = {
                allergies: isAnaphylactic ? 'Peanuts' : '',
                isAnaphylactic,
                anaphylaxisPlan: isAnaphylactic ? 'https://example.com/anaphylaxis.pdf' : '',
                requiresAsthmaActionPlan: true,
                asthmaActionPlan: 'https://example.com/asthma.pdf',
            }
            expect(parseHolidayProgramMedicalDetails(formatHolidayProgramMedicalDetails(details))).toEqual(details)
        }
    )

    it('leaves ordinary allergy notes alone and ignores stale plans when the answers are no', () => {
        const details = {
            allergies: 'Hay fever',
            isAnaphylactic: false,
            anaphylaxisPlan: 'old.pdf',
            requiresAsthmaActionPlan: false,
            asthmaActionPlan: 'old.pdf',
        }
        expect(formatHolidayProgramMedicalDetails(details)).toBe('Hay fever')
        expect(parseHolidayProgramMedicalDetails('')).toEqual({
            ...details,
            allergies: '',
            anaphylaxisPlan: '',
            asthmaActionPlan: '',
        })
    })
})
