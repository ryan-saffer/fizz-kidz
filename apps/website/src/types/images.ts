import type { ImageMetadata } from 'astro'

export type WebsiteImage = {
    src: string
    width: number
    height: number
    assetId: string
}

export type ImageSource = ImageMetadata | WebsiteImage
