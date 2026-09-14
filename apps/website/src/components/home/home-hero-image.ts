import { getImage } from 'astro:assets'

import girls from '@/assets/images/pages/home/girls-masked.png'

// Share the exact source selection between the image and its responsive preload.
export const homeHeroImage = {
    src: girls,
    alt: 'Two girls smiling together after a Fizz Kidz activity',
    width: girls.width,
    widths: [400, 550, 650, 800, 900, 1024, 1100, 1200, girls.width],
    quality: 95,
    sizes: '(max-width: 760px) 550px, (max-width: 1100px) 65vw, (max-width: 1552px) 56vw, 870px',
}

// Keep WebP at the original quality as the fallback. AVIF achieves a smaller
// transfer at quality 80 while retaining the transparent artwork's detail.
export const homeHeroAvif = await getImage({ ...homeHeroImage, format: 'avif', quality: 80 })
