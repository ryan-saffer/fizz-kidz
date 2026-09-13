import '../.astro/types.d.ts'

interface ImportMetaEnv {
    PUBLIC_UPLOADTHING_TOKEN: string
    PUBLIC_GOOGLE_MAPS_API_KEY?: string
    NETLIFY_TOKEN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
