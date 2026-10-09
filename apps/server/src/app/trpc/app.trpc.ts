import { router } from './trpc'

import { afterSchoolProgramRouter } from '@/features/after-school-program/functions/trpc/after-school-program.trpc'
import { authRouter } from '@/features/auth/functions/trpc/auth.trpc'
import { creationsRouter } from '@/features/creations/functions/trpc/creations.trpc'
import { eventsRouter } from '@/features/events/functions/trpc/events.trpc'
import { holidayProgramsRouter } from '@/features/holiday-programs/functions/trpc/holiday-programs.trpc'
import { inventoryRouter } from '@/features/inventory/functions/trpc/inventory.trpc'
import { partiesRouter } from '@/features/party-bookings/functions/trpc/parties.trpc'
import { paymentsRouter } from '@/features/payments/functions/trpc/payments.trpc'
import { posRouter } from '@/features/pos/functions/trpc/pos.trpc'
import { preschoolProgramV2Router } from '@/features/preschool-program-v2/functions/trpc/preschool-program-v2.trpc'
import { preschoolProgramRouter } from '@/features/preschool-program/functions/trpc/preschool-program.trpc'
import { reportsRouter } from '@/features/reports/functions/trpc/reports.trpc'
import { staffRouter } from '@/features/staff/functions/trpc/staff.trpc'
import { websiteChatsRouter } from '@/features/website-chat/functions/trpc/website-chats.trpc'
import { websiteFormsRouter } from '@/features/website/functions/trpc/website-forms.trpc'
import { acuityRouter } from '@/integrations/acuity/functions/trpc/acuity.trpc'

export const appRouter = router({
    parties: partiesRouter,
    events: eventsRouter,
    acuity: acuityRouter,
    holidayPrograms: holidayProgramsRouter,
    afterSchoolProgram: afterSchoolProgramRouter,
    preschoolProgram: preschoolProgramRouter,
    preschoolProgramV2: preschoolProgramV2Router,
    staff: staffRouter,
    auth: authRouter,
    creations: creationsRouter,
    reports: reportsRouter,
    inventory: inventoryRouter,
    websiteForms: websiteFormsRouter,
    websiteChats: websiteChatsRouter,
    payments: paymentsRouter,
    pos: posRouter,
})

export type AppRouter = typeof appRouter
