import '../.astro/types.d.ts'

interface ImportMetaEnv {
    PUBLIC_UPLOADTHING_TOKEN: string
    NETLIFY_TOKEN: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
