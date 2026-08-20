import path from 'node:path'

import { defineConfig } from 'vite-plus'

const packageDir = process.cwd()

export default defineConfig({
    pack: {
        entry: 'src/index.ts',
        outDir: 'dist',
        format: 'esm',
        fixedExtension: false,
        platform: 'browser',
        target: 'es2020',
        sourcemap: true,
        dts: true,
        clean: true,
        alias: {
            '@fizz-kidz/core': path.join(packageDir, '../core/src'),
            '@fizz-kidz/ui': path.join(packageDir, 'src'),
        },
        deps: { neverBundle: true },
    },
})
