import type { WebsiteImage } from '@/types/images'

import { sanityClient } from '@/utils/sanity-api-client'

const images = await sanityClient.getWebsiteImages()

function getWebsiteImage(key: string): WebsiteImage {
    const image = images[key]
    if (!image) throw new Error(`Missing Sanity Website image: ${key}`)
    return image
}

export const websiteCreationsBirthdayCakeSlimePng = getWebsiteImage('websiteCreationsBirthdayCakeSlimePng')
export const websiteCreationsBubblingVolcanoesPng = getWebsiteImage('websiteCreationsBubblingVolcanoesPng')
export const websiteCreationsBugsInBathBombsPng = getWebsiteImage('websiteCreationsBugsInBathBombsPng')
export const websiteCreationsCandySlimePng = getWebsiteImage('websiteCreationsCandySlimePng')
export const websiteCreationsCharmKeyringsPng = getWebsiteImage('websiteCreationsCharmKeyringsPng')
export const websiteCreationsDinosaurBathBombsPng = getWebsiteImage('websiteCreationsDinosaurBathBombsPng')
export const websiteCreationsFairyBathBombsPng = getWebsiteImage('websiteCreationsFairyBathBombsPng')
export const websiteCreationsFairyBraceletsPng = getWebsiteImage('websiteCreationsFairyBraceletsPng')
export const websiteCreationsFairySlimePng = getWebsiteImage('websiteCreationsFairySlimePng')
export const websiteCreationsFairyWandsPng = getWebsiteImage('websiteCreationsFairyWandsPng')
export const websiteCreationsFirePotionsPng = getWebsiteImage('websiteCreationsFirePotionsPng')
export const websiteCreationsFizzyBathBombsGreenPng = getWebsiteImage('websiteCreationsFizzyBathBombsGreenPng')
export const websiteCreationsFluffySlimeBluePng = getWebsiteImage('websiteCreationsFluffySlimeBluePng')
export const websiteCreationsFluidBears1Png = getWebsiteImage('websiteCreationsFluidBears1Png')
export const websiteCreationsFluidBears2Png = getWebsiteImage('websiteCreationsFluidBears2Png')
export const websiteCreationsFluidBears3Png = getWebsiteImage('websiteCreationsFluidBears3Png')
export const websiteCreationsFluidBears4Png = getWebsiteImage('websiteCreationsFluidBears4Png')
export const websiteCreationsFluidBears5Png = getWebsiteImage('websiteCreationsFluidBears5Png')
export const websiteCreationsFluidBears6Png = getWebsiteImage('websiteCreationsFluidBears6Png')
export const websiteCreationsFrozenSparkleSlimeGreenPng = getWebsiteImage('websiteCreationsFrozenSparkleSlimeGreenPng')
export const websiteCreationsGlitterFaceShimmerPng = getWebsiteImage('websiteCreationsGlitterFaceShimmerPng')
export const websiteCreationsGlitterHairShimmerPng = getWebsiteImage('websiteCreationsGlitterHairShimmerPng')
export const websiteCreationsGlowCrownsPng = getWebsiteImage('websiteCreationsGlowCrownsPng')
export const websiteCreationsGoldenSlimePng = getWebsiteImage('websiteCreationsGoldenSlimePng')
export const websiteCreationsHendrixGlitterShinePng = getWebsiteImage('websiteCreationsHendrixGlitterShinePng')
export const websiteCreationsHeroPowerChargersPng = getWebsiteImage('websiteCreationsHeroPowerChargersPng')
export const websiteCreationsJellySoapPng = getWebsiteImage('websiteCreationsJellySoapPng')
export const websiteCreationsMarshmallowSlimePng = getWebsiteImage('websiteCreationsMarshmallowSlimePng')
export const websiteCreationsMonsterExplosionsPng = getWebsiteImage('websiteCreationsMonsterExplosionsPng')
export const websiteCreationsMonsterSlimeGreenPng = getWebsiteImage('websiteCreationsMonsterSlimeGreenPng')
export const websiteCreationsMonsterSlimePurplePng = getWebsiteImage('websiteCreationsMonsterSlimePurplePng')
export const websiteCreationsMoonBeamBraceletsPng = getWebsiteImage('websiteCreationsMoonBeamBraceletsPng')
export const websiteCreationsPixieGlitterPng = getWebsiteImage('websiteCreationsPixieGlitterPng')
export const websiteCreationsRainbowBathBombsPng = getWebsiteImage('websiteCreationsRainbowBathBombsPng')
export const websiteCreationsRainbowCrystalsPng = getWebsiteImage('websiteCreationsRainbowCrystalsPng')
export const websiteCreationsRainbowSlimePng = getWebsiteImage('websiteCreationsRainbowSlimePng')
export const websiteCreationsSlimeAddInsPng = getWebsiteImage('websiteCreationsSlimeAddInsPng')
export const websiteCreationsSlimeBasePng = getWebsiteImage('websiteCreationsSlimeBasePng')
export const websiteCreationsSlimeColourPng = getWebsiteImage('websiteCreationsSlimeColourPng')
export const websiteCreationsSnakePotionsPng = getWebsiteImage('websiteCreationsSnakePotionsPng')
export const websiteCreationsSparkleCrownsPng = getWebsiteImage('websiteCreationsSparkleCrownsPng')
export const websiteCreationsSparklingLipBalmPng = getWebsiteImage('websiteCreationsSparklingLipBalmPng')
export const websiteCreationsSpidermanSlimePng = getWebsiteImage('websiteCreationsSpidermanSlimePng')
export const websiteCreationsSquishyPocketsPng = getWebsiteImage('websiteCreationsSquishyPocketsPng')
export const websiteCreationsStarhexWandsPng = getWebsiteImage('websiteCreationsStarhexWandsPng')
export const websiteCreationsSwiftieSlimePng = getWebsiteImage('websiteCreationsSwiftieSlimePng')
export const websiteCreationsTieDyePillowPng = getWebsiteImage('websiteCreationsTieDyePillowPng')
export const websiteCreationsTieDyeToteBagsPng = getWebsiteImage('websiteCreationsTieDyeToteBagsPng')
export const websiteCreationsTsBathBombsPng = getWebsiteImage('websiteCreationsTsBathBombsPng')
export const websiteCreationsTsBraceletsPng = getWebsiteImage('websiteCreationsTsBraceletsPng')
export const websiteCreationsTsFacePaintPng = getWebsiteImage('websiteCreationsTsFacePaintPng')
export const websiteCreationsTsLipBalmPng = getWebsiteImage('websiteCreationsTsLipBalmPng')
export const websiteCreationsTsMidnightsSlimePng = getWebsiteImage('websiteCreationsTsMidnightsSlimePng')
export const websiteCreationsTsRainbowBathBombsPng = getWebsiteImage('websiteCreationsTsRainbowBathBombsPng')
export const websiteCreationsTsSlimePng = getWebsiteImage('websiteCreationsTsSlimePng')
export const websiteCreationsUnicornBathBombsPng = getWebsiteImage('websiteCreationsUnicornBathBombsPng')
export const websiteCreationsUnicornBathCrumblePng = getWebsiteImage('websiteCreationsUnicornBathCrumblePng')
export const websiteCreationsUnicornCloudSlimePng = getWebsiteImage('websiteCreationsUnicornCloudSlimePng')
export const websiteCreationsUnicornSoapPng = getWebsiteImage('websiteCreationsUnicornSoapPng')
export const websiteHolidayProgramDiscountDialogDiscountImagePng = getWebsiteImage(
    'websiteHolidayProgramDiscountDialogDiscountImagePng'
)
export const websiteHolidayProgramDiscountDialogFramePng = getWebsiteImage(
    'websiteHolidayProgramDiscountDialogFramePng'
)
export const websitePagesActivationsAndEventsAnimalsJpg = getWebsiteImage('websitePagesActivationsAndEventsAnimalsJpg')
export const websitePagesActivationsAndEventsBackToSchoolJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsBackToSchoolJpg'
)
export const websitePagesActivationsAndEventsChristmasJpeg = getWebsiteImage(
    'websitePagesActivationsAndEventsChristmasJpeg'
)
export const websitePagesActivationsAndEventsEasterPng = getWebsiteImage('websitePagesActivationsAndEventsEasterPng')
export const websitePagesActivationsAndEventsEngineersJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsEngineersJpg'
)
export const websitePagesActivationsAndEventsEngineersPng = getWebsiteImage(
    'websitePagesActivationsAndEventsEngineersPng'
)
export const websitePagesActivationsAndEventsHalloweenJpeg = getWebsiteImage(
    'websitePagesActivationsAndEventsHalloweenJpeg'
)
export const websitePagesActivationsAndEventsHeroJpg = getWebsiteImage('websitePagesActivationsAndEventsHeroJpg')
export const websitePagesActivationsAndEventsKidsMorningsJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsKidsMorningsJpg'
)
export const websitePagesActivationsAndEventsMCityJpg = getWebsiteImage('websitePagesActivationsAndEventsMCityJpg')
export const websitePagesActivationsAndEventsMothersDayClassicJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsMothersDayClassicJpg'
)
export const websitePagesActivationsAndEventsMothersDayJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsMothersDayJpg'
)
export const websitePagesActivationsAndEventsRoaringRainbowsJpeg = getWebsiteImage(
    'websitePagesActivationsAndEventsRoaringRainbowsJpeg'
)
export const websitePagesActivationsAndEventsScienceWeekJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsScienceWeekJpg'
)
export const websitePagesActivationsAndEventsScientistJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsScientistJpg'
)
export const websitePagesActivationsAndEventsSpringCarnivalJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsSpringCarnivalJpg'
)
export const websitePagesActivationsAndEventsStaffArchwayJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsStaffArchwayJpg'
)
export const websitePagesActivationsAndEventsStaffPng = getWebsiteImage('websitePagesActivationsAndEventsStaffPng')
export const websitePagesActivationsAndEventsWinterWonderlandJpg = getWebsiteImage(
    'websitePagesActivationsAndEventsWinterWonderlandJpg'
)
export const websitePagesAfterSchoolPrograms1Png = getWebsiteImage('websitePagesAfterSchoolPrograms1Png')
export const websitePagesAfterSchoolPrograms2Png = getWebsiteImage('websitePagesAfterSchoolPrograms2Png')
export const websitePagesAfterSchoolPrograms3Png = getWebsiteImage('websitePagesAfterSchoolPrograms3Png')
export const websitePagesAfterSchoolProgramsArtArtPng = getWebsiteImage('websitePagesAfterSchoolProgramsArtArtPng')
export const websitePagesAfterSchoolProgramsArtChildPng = getWebsiteImage('websitePagesAfterSchoolProgramsArtChildPng')
export const websitePagesAfterSchoolProgramsArtClayPng = getWebsiteImage('websitePagesAfterSchoolProgramsArtClayPng')
export const websitePagesAfterSchoolProgramsArtPng = getWebsiteImage('websitePagesAfterSchoolProgramsArtPng')
export const websitePagesAfterSchoolProgramsArtStaffJpg = getWebsiteImage('websitePagesAfterSchoolProgramsArtStaffJpg')
export const websitePagesAfterSchoolProgramsBannerPng = getWebsiteImage('websitePagesAfterSchoolProgramsBannerPng')
export const websitePagesAfterSchoolProgramsFreeTrialPng = getWebsiteImage(
    'websitePagesAfterSchoolProgramsFreeTrialPng'
)
export const websitePagesAfterSchoolProgramsScienceAliBalloonJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceAliBalloonJpg'
)
export const websitePagesAfterSchoolProgramsScienceBlueHatJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceBlueHatJpg'
)
export const websitePagesAfterSchoolProgramsScienceFunScienceJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceFunScienceJpg'
)
export const websitePagesAfterSchoolProgramsScienceGreenBulbJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceGreenBulbJpg'
)
export const websitePagesAfterSchoolProgramsScienceMixingJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceMixingJpg'
)
export const websitePagesAfterSchoolProgramsSciencePinkAtomJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsSciencePinkAtomJpg'
)
export const websitePagesAfterSchoolProgramsSciencePng = getWebsiteImage('websitePagesAfterSchoolProgramsSciencePng')
export const websitePagesAfterSchoolProgramsScienceScienceJpg = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceScienceJpg'
)
export const websitePagesAfterSchoolProgramsScienceTerm1Png = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceTerm1Png'
)
export const websitePagesAfterSchoolProgramsScienceTerm2Png = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceTerm2Png'
)
export const websitePagesAfterSchoolProgramsScienceTerm3Png = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceTerm3Png'
)
export const websitePagesAfterSchoolProgramsScienceTerm4Png = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceTerm4Png'
)
export const websitePagesAfterSchoolProgramsScienceYellowHatPng = getWebsiteImage(
    'websitePagesAfterSchoolProgramsScienceYellowHatPng'
)
export const websitePagesFranchisingActivationsJpg = getWebsiteImage('websitePagesFranchisingActivationsJpg')
export const websitePagesFranchisingAfterSchoolJpg = getWebsiteImage('websitePagesFranchisingAfterSchoolJpg')
export const websitePagesFranchisingAllStaffJpg = getWebsiteImage('websitePagesFranchisingAllStaffJpg')
export const websitePagesFranchisingBirthdayPartiesJpg = getWebsiteImage('websitePagesFranchisingBirthdayPartiesJpg')
export const websitePagesFranchisingBlueWavePng = getWebsiteImage('websitePagesFranchisingBlueWavePng')
export const websitePagesFranchisingCloudsPng = getWebsiteImage('websitePagesFranchisingCloudsPng')
export const websitePagesFranchisingFranchiseChildJpg = getWebsiteImage('websitePagesFranchisingFranchiseChildJpg')
export const websitePagesFranchisingGreenCirclePng = getWebsiteImage('websitePagesFranchisingGreenCirclePng')
export const websitePagesFranchisingHolidayProgramsJpg = getWebsiteImage('websitePagesFranchisingHolidayProgramsJpg')
export const websitePagesFranchisingPinkCirclePng = getWebsiteImage('websitePagesFranchisingPinkCirclePng')
export const websitePagesFranchisingPlayLabJpg = getWebsiteImage('websitePagesFranchisingPlayLabJpg')
export const websitePagesFranchisingPurpleCurvePng = getWebsiteImage('websitePagesFranchisingPurpleCurvePng')
export const websitePagesFranchisingPurpleWavePng = getWebsiteImage('websitePagesFranchisingPurpleWavePng')
export const websitePagesFranchisingSchoolsJpg = getWebsiteImage('websitePagesFranchisingSchoolsJpg')
export const websitePagesFranchisingStaffPng = getWebsiteImage('websitePagesFranchisingStaffPng')
export const websitePagesFranchisingStep1Jpg = getWebsiteImage('websitePagesFranchisingStep1Jpg')
export const websitePagesFranchisingStep2Jpg = getWebsiteImage('websitePagesFranchisingStep2Jpg')
export const websitePagesFranchisingStep3Jpg = getWebsiteImage('websitePagesFranchisingStep3Jpg')
export const websitePagesFranchisingStep4Jpg = getWebsiteImage('websitePagesFranchisingStep4Jpg')
export const websitePagesFranchisingStep5Jpg = getWebsiteImage('websitePagesFranchisingStep5Jpg')
export const websitePagesFranchisingStep6Jpg = getWebsiteImage('websitePagesFranchisingStep6Jpg')
export const websitePagesFranchisingStep7Jpg = getWebsiteImage('websitePagesFranchisingStep7Jpg')
export const websitePagesFranchisingStep8Jpg = getWebsiteImage('websitePagesFranchisingStep8Jpg')
export const websitePagesFranchisingStudio1Jpg = getWebsiteImage('websitePagesFranchisingStudio1Jpg')
export const websitePagesFranchisingStudio2Jpg = getWebsiteImage('websitePagesFranchisingStudio2Jpg')
export const websitePagesFranchisingStudio3Jpg = getWebsiteImage('websitePagesFranchisingStudio3Jpg')
export const websitePagesFranchisingStudio4Jpg = getWebsiteImage('websitePagesFranchisingStudio4Jpg')
export const websitePagesFranchisingStudio5Png = getWebsiteImage('websitePagesFranchisingStudio5Png')
export const websitePagesFranchisingTaliaJpg = getWebsiteImage('websitePagesFranchisingTaliaJpg')
export const websitePagesFranchisingTopBubbleJpg = getWebsiteImage('websitePagesFranchisingTopBubbleJpg')
export const websitePagesFranchisingWhiteSlimePng = getWebsiteImage('websitePagesFranchisingWhiteSlimePng')
export const websitePagesFranchisingYellowCirclePng = getWebsiteImage('websitePagesFranchisingYellowCirclePng')
export const websitePagesFranchisingYellowWaveBottomPng = getWebsiteImage('websitePagesFranchisingYellowWaveBottomPng')
export const websitePagesFranchisingYellowWaveTopPng = getWebsiteImage('websitePagesFranchisingYellowWaveTopPng')
export const websitePagesGiftCardsGiftCard1Png = getWebsiteImage('websitePagesGiftCardsGiftCard1Png')
export const websitePagesGiftCardsGiftCard2Png = getWebsiteImage('websitePagesGiftCardsGiftCard2Png')
export const websitePagesGiftCardsGiftCard3Png = getWebsiteImage('websitePagesGiftCardsGiftCard3Png')
export const websitePagesGiftCardsGiftCard4Png = getWebsiteImage('websitePagesGiftCardsGiftCard4Png')
export const websitePagesGiftCardsGiftCard5Png = getWebsiteImage('websitePagesGiftCardsGiftCard5Png')
export const websitePagesGiftCardsGiftCard6Png = getWebsiteImage('websitePagesGiftCardsGiftCard6Png')
export const websitePagesGiftCardsGiftCard7Png = getWebsiteImage('websitePagesGiftCardsGiftCard7Png')
export const websitePagesGiftCardsGiftCard8Png = getWebsiteImage('websitePagesGiftCardsGiftCard8Png')
export const websitePagesGiftCardsGiftCard9Png = getWebsiteImage('websitePagesGiftCardsGiftCard9Png')
export const websitePagesGiftCardsGroupPng = getWebsiteImage('websitePagesGiftCardsGroupPng')
export const websitePagesGiftCardsPersonalPng = getWebsiteImage('websitePagesGiftCardsPersonalPng')
export const websitePagesGiftCardsPhonePng = getWebsiteImage('websitePagesGiftCardsPhonePng')
export const websitePagesGiftCardsQuestionsPng = getWebsiteImage('websitePagesGiftCardsQuestionsPng')
export const websitePagesHolidayProgramsHolidayProgramsPng = getWebsiteImage(
    'websitePagesHolidayProgramsHolidayProgramsPng'
)
export const websitePagesHomeActivationsJpg = getWebsiteImage('websitePagesHomeActivationsJpg')
export const websitePagesHomeAfterSchoolJpg = getWebsiteImage('websitePagesHomeAfterSchoolJpg')
export const websitePagesHomeBannerGirlPng = getWebsiteImage('websitePagesHomeBannerGirlPng')
export const websitePagesHomeBannerJpg = getWebsiteImage('websitePagesHomeBannerJpg')
export const websitePagesHomeEnergyJpg = getWebsiteImage('websitePagesHomeEnergyJpg')
export const websitePagesHomeFranchisingPng = getWebsiteImage('websitePagesHomeFranchisingPng')
export const websitePagesHomeHolidayProgramsJpg = getWebsiteImage('websitePagesHomeHolidayProgramsJpg')
export const websitePagesHomeIncursionsJpg = getWebsiteImage('websitePagesHomeIncursionsJpg')
export const websitePagesHomeKinderIncursionsJpg = getWebsiteImage('websitePagesHomeKinderIncursionsJpg')
export const websitePagesHomePartiesJpg = getWebsiteImage('websitePagesHomePartiesJpg')
export const websitePagesHomeStudioPng = getWebsiteImage('websitePagesHomeStudioPng')
export const websitePagesInSchoolsAfterSchoolProgramsHeroJpg = getWebsiteImage(
    'websitePagesInSchoolsAfterSchoolProgramsHeroJpg'
)
export const websitePagesInSchoolsIncursionsBlueBubblesPng = getWebsiteImage(
    'websitePagesInSchoolsIncursionsBlueBubblesPng'
)
export const websitePagesInSchoolsIncursionsBonniePng = getWebsiteImage('websitePagesInSchoolsIncursionsBonniePng')
export const websitePagesInSchoolsIncursionsChemical1Jpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsChemical1Jpg'
)
export const websitePagesInSchoolsIncursionsChemical2Jpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsChemical2Jpg'
)
export const websitePagesInSchoolsIncursionsChemical3Jpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsChemical3Jpg'
)
export const websitePagesInSchoolsIncursionsEarth1Webp = getWebsiteImage('websitePagesInSchoolsIncursionsEarth1Webp')
export const websitePagesInSchoolsIncursionsEarth2Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsEarth2Jpg')
export const websitePagesInSchoolsIncursionsEarth3Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsEarth3Jpg')
export const websitePagesInSchoolsIncursionsEarth4Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsEarth4Jpg')
export const websitePagesInSchoolsIncursionsHeroPng = getWebsiteImage('websitePagesInSchoolsIncursionsHeroPng')
export const websitePagesInSchoolsIncursionsKid1Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsKid1Jpg')
export const websitePagesInSchoolsIncursionsKid2Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsKid2Jpg')
export const websitePagesInSchoolsIncursionsKid3Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsKid3Jpg')
export const websitePagesInSchoolsIncursionsLight1Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsLight1Jpg')
export const websitePagesInSchoolsIncursionsLight2Jpg = getWebsiteImage('websitePagesInSchoolsIncursionsLight2Jpg')
export const websitePagesInSchoolsIncursionsPhysical1Jpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsPhysical1Jpg'
)
export const websitePagesInSchoolsIncursionsPhysical2Jpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsPhysical2Jpg'
)
export const websitePagesInSchoolsIncursionsPurpleClassroomJpg = getWebsiteImage(
    'websitePagesInSchoolsIncursionsPurpleClassroomJpg'
)
export const websitePagesLocationsBalwynBalwyn1Jpg = getWebsiteImage('websitePagesLocationsBalwynBalwyn1Jpg')
export const websitePagesLocationsBalwynBalwyn2Jpg = getWebsiteImage('websitePagesLocationsBalwynBalwyn2Jpg')
export const websitePagesLocationsBalwynBalwyn3Jpg = getWebsiteImage('websitePagesLocationsBalwynBalwyn3Jpg')
export const websitePagesLocationsBalwynBalwyn4Jpg = getWebsiteImage('websitePagesLocationsBalwynBalwyn4Jpg')
export const websitePagesLocationsBalwynBalwyn5Jpg = getWebsiteImage('websitePagesLocationsBalwynBalwyn5Jpg')
export const websitePagesLocationsBalwynJpg = getWebsiteImage('websitePagesLocationsBalwynJpg')
export const websitePagesLocationsCheltenhamCheltenham1Jpg = getWebsiteImage(
    'websitePagesLocationsCheltenhamCheltenham1Jpg'
)
export const websitePagesLocationsCheltenhamCheltenham2Jpg = getWebsiteImage(
    'websitePagesLocationsCheltenhamCheltenham2Jpg'
)
export const websitePagesLocationsCheltenhamCheltenham3Jpg = getWebsiteImage(
    'websitePagesLocationsCheltenhamCheltenham3Jpg'
)
export const websitePagesLocationsCheltenhamCheltenham4Jpg = getWebsiteImage(
    'websitePagesLocationsCheltenhamCheltenham4Jpg'
)
export const websitePagesLocationsCheltenhamCheltenham5Jpg = getWebsiteImage(
    'websitePagesLocationsCheltenhamCheltenham5Jpg'
)
export const websitePagesLocationsCheltenhamJpg = getWebsiteImage('websitePagesLocationsCheltenhamJpg')
export const websitePagesLocationsEssendonEssendon1Jpg = getWebsiteImage('websitePagesLocationsEssendonEssendon1Jpg')
export const websitePagesLocationsEssendonEssendon2Jpg = getWebsiteImage('websitePagesLocationsEssendonEssendon2Jpg')
export const websitePagesLocationsEssendonEssendon3Jpg = getWebsiteImage('websitePagesLocationsEssendonEssendon3Jpg')
export const websitePagesLocationsEssendonEssendon4Jpg = getWebsiteImage('websitePagesLocationsEssendonEssendon4Jpg')
export const websitePagesLocationsEssendonEssendon5Jpg = getWebsiteImage('websitePagesLocationsEssendonEssendon5Jpg')
export const websitePagesLocationsEssendonJpg = getWebsiteImage('websitePagesLocationsEssendonJpg')
export const websitePagesLocationsHeroJpg = getWebsiteImage('websitePagesLocationsHeroJpg')
export const websitePagesLocationsKingsvilleBirthdayJpg = getWebsiteImage('websitePagesLocationsKingsvilleBirthdayJpg')
export const websitePagesLocationsKingsvilleContactJpg = getWebsiteImage('websitePagesLocationsKingsvilleContactJpg')
export const websitePagesLocationsKingsvilleHolidayProgramsJpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleHolidayProgramsJpg'
)
export const websitePagesLocationsKingsvilleJpg = getWebsiteImage('websitePagesLocationsKingsvilleJpg')
export const websitePagesLocationsKingsvilleKingsville1Jpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleKingsville1Jpg'
)
export const websitePagesLocationsKingsvilleKingsville2Jpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleKingsville2Jpg'
)
export const websitePagesLocationsKingsvilleKingsville3Jpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleKingsville3Jpg'
)
export const websitePagesLocationsKingsvilleKingsville4Jpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleKingsville4Jpg'
)
export const websitePagesLocationsKingsvilleKingsville5Jpg = getWebsiteImage(
    'websitePagesLocationsKingsvilleKingsville5Jpg'
)
export const websitePagesLocationsKingsvilleOpening1Jpg = getWebsiteImage('websitePagesLocationsKingsvilleOpening1Jpg')
export const websitePagesLocationsKingsvilleOpening2Jpg = getWebsiteImage('websitePagesLocationsKingsvilleOpening2Jpg')
export const websitePagesLocationsKingsvilleOpening3Jpg = getWebsiteImage('websitePagesLocationsKingsvilleOpening3Jpg')
export const websitePagesLocationsKingsvilleSlimeJpg = getWebsiteImage('websitePagesLocationsKingsvilleSlimeJpg')
export const websitePagesLocationsMalvernJpg = getWebsiteImage('websitePagesLocationsMalvernJpg')
export const websitePagesLocationsMalvernMalvern1Jpg = getWebsiteImage('websitePagesLocationsMalvernMalvern1Jpg')
export const websitePagesLocationsMalvernMalvern2Jpg = getWebsiteImage('websitePagesLocationsMalvernMalvern2Jpg')
export const websitePagesLocationsMalvernMalvern3Jpg = getWebsiteImage('websitePagesLocationsMalvernMalvern3Jpg')
export const websitePagesLocationsMalvernMalvern4Jpg = getWebsiteImage('websitePagesLocationsMalvernMalvern4Jpg')
export const websitePagesLocationsMalvernMalvern5Jpg = getWebsiteImage('websitePagesLocationsMalvernMalvern5Jpg')
export const websitePagesOurTeamAllStaffJpg = getWebsiteImage('websitePagesOurTeamAllStaffJpg')
export const websitePagesOurTeamHeroJpg = getWebsiteImage('websitePagesOurTeamHeroJpg')
export const websitePagesOurTeamKymJpg = getWebsiteImage('websitePagesOurTeamKymJpg')
export const websitePagesOurTeamLamiJpg = getWebsiteImage('websitePagesOurTeamLamiJpg')
export const websitePagesOurTeamMichaelaJpg = getWebsiteImage('websitePagesOurTeamMichaelaJpg')
export const websitePagesOurTeamRyanJpg = getWebsiteImage('websitePagesOurTeamRyanJpg')
export const websitePagesOurTeamTShirtPng = getWebsiteImage('websitePagesOurTeamTShirtPng')
export const websitePagesOurTeamTaliaJpg = getWebsiteImage('websitePagesOurTeamTaliaJpg')
export const websitePagesPartiesAtHomeFaqPng = getWebsiteImage('websitePagesPartiesAtHomeFaqPng')
export const websitePagesPartiesAtHomePartiesJpg = getWebsiteImage('websitePagesPartiesAtHomePartiesJpg')
export const websitePagesPartiesAtHomePartiesPng = getWebsiteImage('websitePagesPartiesAtHomePartiesPng')
export const websitePagesPartiesBlueCirclesPng = getWebsiteImage('websitePagesPartiesBlueCirclesPng')
export const websitePagesPartiesBookAPartyHeroJpg = getWebsiteImage('websitePagesPartiesBookAPartyHeroJpg')
export const websitePagesPartiesCakesPng = getWebsiteImage('websitePagesPartiesCakesPng')
export const websitePagesPartiesCreationsHeroJpg = getWebsiteImage('websitePagesPartiesCreationsHeroJpg')
export const websitePagesPartiesEssendonStudioJpg = getWebsiteImage('websitePagesPartiesEssendonStudioJpg')
export const websitePagesPartiesFairyPartyWebp = getWebsiteImage('websitePagesPartiesFairyPartyWebp')
export const websitePagesPartiesFaqPng = getWebsiteImage('websitePagesPartiesFaqPng')
export const websitePagesPartiesFluidBearsPartyPng = getWebsiteImage('websitePagesPartiesFluidBearsPartyPng')
export const websitePagesPartiesGlamPartiesJpg = getWebsiteImage('websitePagesPartiesGlamPartiesJpg')
export const websitePagesPartiesInvitationsPng = getWebsiteImage('websitePagesPartiesInvitationsPng')
export const websitePagesPartiesKPopDemonHuntersPartyPng = getWebsiteImage(
    'websitePagesPartiesKPopDemonHuntersPartyPng'
)
export const websitePagesPartiesLollyBagsPng = getWebsiteImage('websitePagesPartiesLollyBagsPng')
export const websitePagesPartiesPackagesFairiesPng = getWebsiteImage('websitePagesPartiesPackagesFairiesPng')
export const websitePagesPartiesPackagesFluidBearsBlackPng = getWebsiteImage(
    'websitePagesPartiesPackagesFluidBearsBlackPng'
)
export const websitePagesPartiesPackagesFluidBearsWhitePng = getWebsiteImage(
    'websitePagesPartiesPackagesFluidBearsWhitePng'
)
export const websitePagesPartiesPackagesGlitzAndGlamPng = getWebsiteImage('websitePagesPartiesPackagesGlitzAndGlamPng')
export const websitePagesPartiesPackagesKPopDemonHuntersPng = getWebsiteImage(
    'websitePagesPartiesPackagesKPopDemonHuntersPng'
)
export const websitePagesPartiesPackagesMobilePng = getWebsiteImage('websitePagesPartiesPackagesMobilePng')
export const websitePagesPartiesPackagesSafariPng = getWebsiteImage('websitePagesPartiesPackagesSafariPng')
export const websitePagesPartiesPackagesSciencePng = getWebsiteImage('websitePagesPartiesPackagesSciencePng')
export const websitePagesPartiesPackagesSlimePng = getWebsiteImage('websitePagesPartiesPackagesSlimePng')
export const websitePagesPartiesPackagesSwiftiePng = getWebsiteImage('websitePagesPartiesPackagesSwiftiePng')
export const websitePagesPartiesPackagesTieDyePng = getWebsiteImage('websitePagesPartiesPackagesTieDyePng')
export const websitePagesPartiesPackagesUnicornPng = getWebsiteImage('websitePagesPartiesPackagesUnicornPng')
export const websitePagesPartiesPartyHeroJpg = getWebsiteImage('websitePagesPartiesPartyHeroJpg')
export const websitePagesPartiesPartyPacksPng = getWebsiteImage('websitePagesPartiesPartyPacksPng')
export const websitePagesPartiesSafariPartyJpg = getWebsiteImage('websitePagesPartiesSafariPartyJpg')
export const websitePagesPartiesSciencePartyJpg = getWebsiteImage('websitePagesPartiesSciencePartyJpg')
export const websitePagesPartiesSlimeCreationsHeroPng = getWebsiteImage('websitePagesPartiesSlimeCreationsHeroPng')
export const websitePagesPartiesSlimeLabPng = getWebsiteImage('websitePagesPartiesSlimeLabPng')
export const websitePagesPartiesSlimePartyJpg = getWebsiteImage('websitePagesPartiesSlimePartyJpg')
export const websitePagesPartiesTaylorSwiftPartyJpg = getWebsiteImage('websitePagesPartiesTaylorSwiftPartyJpg')
export const websitePagesPartiesTieDyePartyJpg = getWebsiteImage('websitePagesPartiesTieDyePartyJpg')
export const websitePagesPartiesUnicornPartyJpg = getWebsiteImage('websitePagesPartiesUnicornPartyJpg')
export const websitePagesPlayLabAllPlaysBannerJpg = getWebsiteImage('websitePagesPlayLabAllPlaysBannerJpg')
export const websitePagesPlayLabAllPlaysJpg = getWebsiteImage('websitePagesPlayLabAllPlaysJpg')
export const websitePagesPlayLabBlackGraphicsPng = getWebsiteImage('websitePagesPlayLabBlackGraphicsPng')
export const websitePagesPlayLabCreativeKindersBannerJpg = getWebsiteImage(
    'websitePagesPlayLabCreativeKindersBannerJpg'
)
export const websitePagesPlayLabCreativeKindersJpg = getWebsiteImage('websitePagesPlayLabCreativeKindersJpg')
export const websitePagesPlayLabGraphicsPng = getWebsiteImage('websitePagesPlayLabGraphicsPng')
export const websitePagesPlayLabLittleExplorersBannerJpg = getWebsiteImage(
    'websitePagesPlayLabLittleExplorersBannerJpg'
)
export const websitePagesPlayLabLittleExplorersJpg = getWebsiteImage('websitePagesPlayLabLittleExplorersJpg')
export const websitePagesPlayLabSwingJpg = getWebsiteImage('websitePagesPlayLabSwingJpg')
export const websitePagesPreschoolProgram1Jpg = getWebsiteImage('websitePagesPreschoolProgram1Jpg')
export const websitePagesPreschoolProgram2Jpg = getWebsiteImage('websitePagesPreschoolProgram2Jpg')
export const websitePagesPreschoolProgram3Jpg = getWebsiteImage('websitePagesPreschoolProgram3Jpg')
export const websitePagesPreschoolProgramCarousel1Jpg = getWebsiteImage('websitePagesPreschoolProgramCarousel1Jpg')
export const websitePagesPreschoolProgramCarousel2Jpg = getWebsiteImage('websitePagesPreschoolProgramCarousel2Jpg')
export const websitePagesPreschoolProgramCarousel3Jpg = getWebsiteImage('websitePagesPreschoolProgramCarousel3Jpg')
export const websitePagesPreschoolProgramHeroJpg = getWebsiteImage('websitePagesPreschoolProgramHeroJpg')
export const websitePagesPreschoolProgramThursdayJpg = getWebsiteImage('websitePagesPreschoolProgramThursdayJpg')
export const websitePagesPreschoolProgramWednesdayJpg = getWebsiteImage('websitePagesPreschoolProgramWednesdayJpg')
