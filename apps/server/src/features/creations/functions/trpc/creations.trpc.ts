import { authenticatedProcedure, router } from '@/app/trpc/trpc'
import { SanityClient } from '@/integrations/sanity/sanity.client'

export const creationsRouter = router({
    getBirthdayPartyCreations: authenticatedProcedure.query(async () => {
        const sanity = await SanityClient.getInstance()
        return sanity.getBirthdayPartyCreations()
    }),
    getHolidayProgramCreations: authenticatedProcedure.query(async () => {
        const sanity = await SanityClient.getInstance()
        return sanity.getHolidayProgramCreations()
    }),
})
