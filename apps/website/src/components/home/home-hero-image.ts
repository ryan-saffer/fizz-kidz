import girls from '@/assets/images/pages/home/girls-masked.png'

// Share the exact source selection between the image and its responsive preload.
export const homeHeroImage = {
    src: girls,
    alt: 'Two girls smiling together after a Fizz Kidz activity',
    width: girls.width,
    widths: [400, 650, 900, 1200, girls.width],
    quality: 95,
    sizes: '(max-width: 760px) 550px, (max-width: 1100px) 65vw, (max-width: 1552px) 56vw, 870px',
}
