import { CalendarIcon } from '@sanity/icons/Calendar'
import { defineArrayMember, defineField, defineType } from 'sanity'

import { HolidayProgramScheduleInput } from '../../components/holiday-program-schedule-input'

export const holidayProgramWeek = defineType({
    name: 'holidayProgramWeek',
    title: 'Holiday Program Schedule',
    type: 'document',
    icon: CalendarIcon,
    fields: [
        defineField({
            name: 'title',
            title: 'Week title',
            type: 'string',
            validation: (rule) => rule.required(),
        }),
        defineField({
            name: 'order',
            title: 'Display order',
            type: 'number',
            description: 'Weeks with lower numbers appear first on the Website.',
            validation: (rule) => rule.required().integer().min(0),
        }),
        defineField({
            name: 'programs',
            title: 'Programs',
            type: 'array',
            description: 'Add morning and afternoon sessions, then drag them into date order.',
            components: { input: HolidayProgramScheduleInput },
            of: [defineArrayMember({ type: 'holidayProgramSession' })],
            validation: (rule) => rule.required().min(1),
        }),
    ],
    preview: {
        select: { title: 'title', order: 'order' },
        prepare: ({ title, order }) => ({ title, subtitle: `Display order: ${order}` }),
    },
})
