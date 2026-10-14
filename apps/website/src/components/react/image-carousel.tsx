import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel'

import type { ReactNode } from 'react'

type Props = {
    imageSlots: string[]
    loop?: boolean
    [slot: string]: ReactNode
}

function ImageCarousel({ imageSlots, loop = false, ...imageSlotProps }: Props) {
    return (
        <Carousel className="m-12" opts={{ loop, align: 'start' }}>
            <CarouselContent>
                {imageSlots.map((imageSlot) => (
                    <CarouselItem key={imageSlot} className="flex basis-full justify-center sm:basis-1/3 lg:basis-1/5">
                        {imageSlotProps[imageSlot]}
                    </CarouselItem>
                ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
        </Carousel>
    )
}

export default ImageCarousel
