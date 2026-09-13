import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '../lib/utils'
import { Button } from '../ui/button'
import PlayLabProgramCard from './play-lab-program-card'

type Module = 'little-explorers' | 'create-kinders' | 'all-playz' | null

const PlayLabProgramsSection = ({
    littleExplorersImage,
    littleExplorersBanner,
    creativeKindersImage,
    creativeKindersBanner,
    allPlaysImage,
    allPlaysBanner,
}: {
    littleExplorersImage?: ReactNode
    littleExplorersBanner?: ReactNode
    creativeKindersImage?: ReactNode
    creativeKindersBanner?: ReactNode
    allPlaysImage?: ReactNode
    allPlaysBanner?: ReactNode
}) => {
    const [isMobile, setIsMobile] = useState(true)

    useEffect(() => {
        setIsMobile(window.innerWidth < 1000)
        const onResize = () => {
            setIsMobile(window.innerWidth < 1000)
        }

        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const [selectedModule, setSelectedModule] = useState<Module>(null)
    const [queuedModule, setQueuedModule] = useState<Module>(null)

    useEffect(() => {
        if (selectedModule === null && queuedModule !== null) {
            const t = window.setTimeout(() => {
                setSelectedModule(queuedModule)
                setQueuedModule(null)
            }, 700)
            return () => window.clearTimeout(t)
        }
    }, [selectedModule, queuedModule])

    const handleModuleClicked = (newModule: Module) => {
        // handle a card is already queued to be closed
        if (selectedModule === null && queuedModule !== null) {
            setQueuedModule(newModule)
        } else if (selectedModule === null) {
            setSelectedModule(newModule)
        } else if (selectedModule === newModule) {
            setSelectedModule(null)
        } else {
            if (isMobile) {
                setSelectedModule(newModule)
            } else {
                setQueuedModule(newModule)
                setSelectedModule(null)
            }
        }
    }

    return (
        <div
            className={cn('mb-16 grid grid-cols-3 gap-8', {
                'grid-cols-1 gap-4': isMobile,
            })}
        >
            <PlayLabProgramCard
                position={1}
                isMobile={isMobile}
                onClick={() => handleModuleClicked('little-explorers')}
                selected={selectedModule === 'little-explorers'}
                queued={queuedModule === 'little-explorers'}
                backgroundColor="#EDF9FB"
                image={littleExplorersImage}
                content={{
                    color: '#4DC5D9',
                    title: 'Little Explorers',
                    subtitle: 'Ages 18 months - 3 years',
                    description:
                        'Little ones explore colourful sensory fun, try exciting new activites and grow social confidence - all while sharing giggles and special moments with their grown-up.',
                    buttons: [
                        {
                            color: '#F6BA33',
                            content: 'Stay and play',
                            tooltip:
                                'A parent or guardian is expected to stay and play with the child for the entire session.',
                        },
                    ],
                }}
            >
                <div className="relative left-1/2 -translate-x-1/2 rounded-3xl bg-[#4DC5D9]/60 p-4 sm:p-8 lg:p-16">
                    <p className="text-center font-lilita text-4xl text-white sm:text-6xl">Little Explorers</p>
                    <p className="mt-2 text-center text-2xl font-bold">Ages 18 months - 3 years</p>
                    <p className="mt-4 text-center font-semibold sm:text-xl">
                        Little ones explore colourful sensory fun, try exciting new activities and grow social
                        confidence - all while sharing giggles and special moments with their grown-up.
                    </p>
                    {littleExplorersBanner}
                    <div className="flex flex-col gap-12 md:flex-row">
                        <div className="flex w-full flex-col gap-8 md:w-1/2">
                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md @container">
                                <div className="grid grid-cols-1 gap-8 @sm:grid-cols-2">
                                    {/* SCHEDULE */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">When</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Fridays</p>
                                                <p className="text-lg text-gray-700">9:15 AM - 10:15 AM</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PRICING */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">Pricing</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Casual price</p>
                                                <p className="text-lg text-gray-700">$35 per session</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-extrabold">Term enrolment</p>
                                                <p className="text-lg text-gray-700">
                                                    $28/week - <span className="italic">20% discount</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md">
                                <p className="mb-4 font-lilita text-4xl text-[#42D4F3]">Your child will:</p>
                                <ul className="mb-4 list-disc pl-4">
                                    <li>Delight in hands-on, mess-free play</li>
                                    <li>Discover coourful, sensroy-rich materials</li>
                                    <li>Try exciting new art, science and craft activities</li>
                                    <li>
                                        Be supported by yourselves and our wonderful team as they grow social skills
                                        with other children in the session
                                    </li>
                                    <li>
                                        Bond and make memories with their special caregiver in a safe, welcoming nd
                                        playful environment
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex w-full flex-col rounded-lg bg-white p-8 shadow-md md:w-1/2">
                            <p className="mb-4 text-2xl font-bold">
                                Learning grows week by week over the term, guided by past adventures.
                            </p>
                            <div className="flex flex-1 flex-col justify-between">
                                <div>
                                    <p className="mb-2 font-gotham text-xl">Activities include:</p>
                                    <ul className="mb-4 list-disc pl-4">
                                        <li>Dry Sensory Play Stations </li>
                                        <li>Wet Sensory Play Stations</li>
                                        <li>Creative Art Stations</li>
                                        <li>Magnet Gravity Play Wall </li>
                                        <li>Sensory Swing (yes, an actual swing!)</li>
                                        <li>Weaving Peg Wall Station</li>
                                        <li>Dancing, music games & imaginative group activities!</li>
                                    </ul>
                                </div>
                                <Button asChild className="w-full bg-[#9044E2] uppercase hover:bg-[#9044E2]/90">
                                    <a href="https://bookings.fizzkidz.com.au/play-lab-booking">Book today</a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </PlayLabProgramCard>
            <PlayLabProgramCard
                position={2}
                isMobile={isMobile}
                onClick={() => handleModuleClicked('create-kinders')}
                selected={selectedModule === 'create-kinders'}
                queued={queuedModule === 'create-kinders'}
                backgroundColor="#F5F9EC"
                image={creativeKindersImage}
                content={{
                    color: '#9ECC45',
                    title: 'Creative Kinders',
                    subtitle: 'Ages 3 - 5 years',
                    description:
                        'Big imaginations, bold creations! In our hands-on art, craft, and science workshops, kids dive into playful experiments that teach real skills—fostering creativity, confidence, and teamwork while they build projects to proudly take home.',
                    buttons: [
                        {
                            color: '#F6BA33',
                            content: 'Stay and play',
                            tooltip:
                                'A parent or guardian is welcome to stay and play with the child for the entire session.',
                        },
                        {
                            color: '#EE1071',
                            content: 'Drop and go',
                            tooltip: 'Kids can be left with us for the session, or you are welcome to stay and play!',
                        },
                    ],
                }}
            >
                <div className="relative left-1/2 -translate-x-1/2 rounded-3xl bg-[#9ECC45]/60 p-4 sm:p-8 lg:p-16">
                    <p className="text-center font-lilita text-4xl text-white sm:text-6xl">Creative Kinders</p>
                    <p className="mt-2 text-center text-2xl font-bold">Ages 3 - 5 years</p>
                    <p className="mt-4 text-center font-semibold sm:text-xl">
                        Big imaginations, bold creations! In our hands-on art, craft, and science workshops, kids dive
                        into playful experiments that teach real skills—fostering creativity, confidence, and teamwork
                        while they build projects to proudly take home.
                    </p>
                    {creativeKindersBanner}
                    <div className="flex flex-col gap-12 md:flex-row">
                        <div className="flex w-full flex-col gap-8 md:w-1/2">
                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md @container">
                                <div className="grid grid-cols-1 gap-8 @sm:grid-cols-2">
                                    {/* SCHEDULE */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">When</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Wednesdays</p>
                                                <p className="text-lg text-gray-700">11:00 AM - 12:00 PM</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-extrabold">Fridays</p>
                                                <p className="text-lg text-gray-700">10:45 am - 11:45 am</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PRICING */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">Pricing</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Casual price</p>
                                                <p className="text-lg text-gray-700">$35 per session</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-extrabold">Term enrolment</p>
                                                <p className="text-lg text-gray-700">
                                                    $28/week - <span className="italic">20% discount</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md">
                                <p className="mb-4 font-lilita text-4xl text-[#42D4F3]">Your child will:</p>
                                <ul className="mb-4 list-disc pl-4">
                                    <li>Take the lead in their own hands-on, creative play</li>
                                    <li>
                                        Dive into immersive art science and craft projects that encourage imagination
                                        and problem-solving skills
                                    </li>
                                    <li>
                                        Build on craft skills to create meaningful take-home projects that spark
                                        continued play, storytelling, and a sstrong sense of pride in their unique
                                        creations
                                    </li>
                                    <li>
                                        Express themselves confidently while bilding friendships and practicing teamwork
                                    </li>
                                    <li>
                                        Share joyful, meaningful moments with their caregiver in a warm, supportive
                                        environment
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex w-full flex-col rounded-lg bg-white p-8 shadow-md md:w-1/2">
                            <p className="mb-4 text-2xl font-bold">
                                Learning grows week by week over the term, guided by past adventures.
                            </p>
                            <div className="flex flex-1 flex-col justify-between">
                                <div>
                                    <p className="mb-2 font-gotham text-xl">Activities include:</p>
                                    <ul className="mb-4 list-disc pl-4">
                                        <li>Dry & Wet Sensory Play</li>
                                        <li>Guided Art Projects</li>
                                        <li>Magnet Gravity Wall Challenges</li>
                                        <li>Sensory Swing & Movement Play</li>
                                        <li>Collaborative Weaving + Pattern Stations</li>
                                        <li>Engineering and Building activities </li>
                                        <li>Self Expression Stations with Take Home Projects </li>
                                        <li>Dancing, music games & imaginative group activities!</li>
                                    </ul>
                                </div>
                                <Button asChild className="w-full bg-[#9044E2] uppercase hover:bg-[#9044E2]/90">
                                    <a href="https://bookings.fizzkidz.com.au/play-lab-booking">Book today</a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </PlayLabProgramCard>
            <PlayLabProgramCard
                position={3}
                isMobile={isMobile}
                onClick={() => handleModuleClicked('all-playz')}
                selected={selectedModule === 'all-playz'}
                queued={queuedModule === 'all-playz'}
                backgroundColor="#F3ECFC"
                image={allPlaysImage}
                content={{
                    color: '#9044E2',
                    title: 'All Playz',
                    subtitle: 'Ages 18 months - 5 years',
                    description:
                        'A mixed-age facilitated adventure of sensory play, discovery, and joyful mess-making!',
                    buttons: [
                        {
                            color: '#F6BA33',
                            content: 'Stay and play',
                            tooltip:
                                'A parent or guardian is welcome to stay and play with the child for the entire session.',
                        },
                        {
                            color: '#EE1071',
                            content: 'Drop and go (3+)',
                            tooltip:
                                'Kids aged 3+ can be left with us for the session, or you are welcome to stay and play!',
                        },
                    ],
                }}
            >
                <div className="relative left-1/2 -translate-x-1/2 rounded-3xl bg-[#9044E2]/40 p-4 sm:p-8 lg:p-16">
                    <p className="text-center font-lilita text-4xl text-white sm:text-6xl">All Playz</p>
                    <p className="mt-2 text-center text-2xl font-bold">Ages 18 months - 5 years</p>
                    <p className="mt-4 text-center font-semibold sm:text-xl">
                        A mixed-age facilitated adventure of sensory play, discovery, and joyful mess-making!
                    </p>
                    {allPlaysBanner}
                    <div className="flex flex-col gap-12 md:flex-row">
                        <div className="flex w-full flex-col gap-8 md:w-1/2">
                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md @container">
                                <div className="grid grid-cols-1 gap-8 @sm:grid-cols-2">
                                    {/* SCHEDULE */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">When</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Wednesdays</p>
                                                <p className="text-lg text-gray-700">9:30 am - 10:30 am</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* PRICING */}
                                    <div className="space-y-2">
                                        <p className="font-lilita text-4xl text-[#8C52FF]">Pricing</p>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-xl font-extrabold">Casual price</p>
                                                <p className="text-lg text-gray-700">$35 per session</p>
                                            </div>
                                            <div>
                                                <p className="text-xl font-extrabold">Term enrolment</p>
                                                <p className="text-lg text-gray-700">
                                                    $28/week - <span className="italic">20% discount</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="relative z-10 h-full rounded-lg bg-white p-8 shadow-md">
                                <p className="mb-4 font-lilita text-4xl text-[#42D4F3]">Your child will:</p>
                                <ul className="mb-4 list-disc pl-4">
                                    <li>Explore hands-on, mess-free play with colourful, sensory-rich material</li>
                                    <li>
                                        Enjoy fun and engaging art, science and craft activities designed for all
                                        abilities
                                    </li>
                                    <li>
                                        Build confidence, creativity, and early problem-solving skills through guided
                                        and independent play
                                    </li>
                                    <li>
                                        Create take-home projects that spark pride, storytelling and continued play at
                                        home
                                    </li>
                                    <li>
                                        Share special bonding moments with their caregiver while being supported by our
                                        passionate team
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex w-full flex-col rounded-lg bg-white p-8 shadow-md md:w-1/2">
                            <p className="mb-4 text-2xl font-bold">
                                Learning grows week by week over the term, guided by past adventures.
                            </p>
                            <div className="flex flex-1 flex-col justify-between">
                                <div>
                                    <p className="mb-2 font-gotham text-xl">Activities include:</p>
                                    <ul className="mb-4 list-disc pl-4">
                                        <li>Dry Sensory Play Stations </li>
                                        <li>Wet Sensory Play Stations</li>
                                        <li>Guided Art Projects</li>
                                        <li>Magnet Gravity Wall Play and Challenges</li>
                                        <li>Sensory Swing & Movement Play</li>
                                        <li>Collaborative Weaving + Pattern Stations</li>
                                        <li>Engineering and Building activities </li>
                                        <li>Dancing, music games & imaginative group activities!</li>
                                    </ul>
                                </div>
                                <Button asChild className="w-full bg-[#9044E2] uppercase hover:bg-[#9044E2]/90">
                                    <a href="https://bookings.fizzkidz.com.au/play-lab-booking">Book today</a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </PlayLabProgramCard>
        </div>
    )
}

export default PlayLabProgramsSection
