declare module 'acuityscheduling' {
    function basic(params: any): any
}

// Markdown files are bundled as text (see `pack.loader` in vite.config.ts).
declare module '*.md' {
    const content: string
    export default content
}
