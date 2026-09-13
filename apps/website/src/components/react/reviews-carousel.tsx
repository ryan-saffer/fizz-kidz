import { Star } from 'lucide-react'

import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel'

function ReviewsCarousel({
    reviews,
}: {
    reviews: {
        review: string
        writtenBy: string
        writtenYear: string
        writtenDate?: string
        rating?: number
        location?: string
        reviewUrl?: string
        source?: string
    }[]
}) {
    return (
        <Carousel className="mx-auto my-12 w-full min-w-0 max-w-full" opts={{ loop: true, align: 'start' }}>
            <CarouselContent>
                {reviews.map((review, idx) => {
                    const rating = review.rating ?? 5
                    const writtenDate = review.writtenDate ?? review.writtenYear

                    return (
                        <CarouselItem className="max-w-full basis-full md:basis-1/2" key={idx}>
                            <article className="relative flex h-full min-h-72 flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-[#5fd7ef] bg-white p-7 md:h-full md:p-8">
                                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#fff1a8]" />
                                <div className="absolute -bottom-14 -left-14 h-32 w-32 rounded-full bg-[#fce7f3]" />

                                <div className="relative flex flex-col gap-5">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div
                                            className="flex items-center gap-1 text-yellow-400"
                                            aria-label={`${rating.toFixed(1)} out of 5 stars`}
                                        >
                                            {Array.from({ length: 5 }).map((_, starIndex) => (
                                                <Star
                                                    className={`h-7 w-7 drop-shadow-sm ${
                                                        starIndex < Math.round(rating)
                                                            ? 'text-yellow-400'
                                                            : 'text-slate-200'
                                                    }`}
                                                    fill="currentColor"
                                                    key={starIndex}
                                                    strokeWidth={1.75}
                                                />
                                            ))}
                                        </div>
                                        <div className="rounded-full bg-[#5fd7ef] px-4 py-2 font-lilita text-2xl leading-none text-white shadow-sm">
                                            {rating.toFixed(1)}
                                        </div>
                                    </div>

                                    <p className="font-gotham text-lg leading-relaxed text-slate-800 md:text-xl">
                                        "{review.review}"
                                    </p>
                                </div>

                                <footer className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4 font-gotham text-sm font-semibold text-slate-500">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-slate-700">{review.writtenBy}</span>
                                        <span>{writtenDate}</span>
                                    </div>

                                    {review.reviewUrl && (
                                        <a
                                            className="rounded-full border border-[#5fd7ef] bg-white px-4 py-2 text-sm font-bold text-[#1389a3] transition hover:bg-[#e9fbff]"
                                            href={review.reviewUrl}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            View on Google
                                        </a>
                                    )}
                                </footer>
                            </article>
                        </CarouselItem>
                    )
                })}
            </CarouselContent>
            <CarouselPrevious className="left-2 2xl:-left-12" />
            <CarouselNext className="right-2 2xl:-right-12" />
        </Carousel>
    )
}

export default ReviewsCarousel
