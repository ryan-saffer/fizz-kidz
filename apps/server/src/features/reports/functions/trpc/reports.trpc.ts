import { reportReadProcedure } from './trpc.reports-procedures'

import { router } from '@/app/trpc/trpc'
import {
    generateCapacityReport,
    generateCapacityReportInputSchema,
} from '@/features/reports/core/generate-capacity-report'
import {
    generateHolidayProgramCapacityReport,
    generateHolidayProgramCapacityReportInputSchema,
} from '@/features/reports/core/generate-holiday-program-capacity-report'

export const reportsRouter = router({
    generateCapacityReport: reportReadProcedure
        .input(generateCapacityReportInputSchema)
        .query(({ input }) => generateCapacityReport(input)),
    generateHolidayProgramCapacityReport: reportReadProcedure
        .input(generateHolidayProgramCapacityReportInputSchema)
        .query(({ input }) => generateHolidayProgramCapacityReport(input)),
})
