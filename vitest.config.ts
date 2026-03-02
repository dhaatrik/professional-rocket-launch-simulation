import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        globals: true,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/main.ts'],
            reporter: ['text', 'html'],
        },
        environment: 'jsdom',
        alias: {
            '@/': new URL('./src/', import.meta.url).pathname,
            '@types/': new URL('./src/types/', import.meta.url).pathname,
            '@physics/': new URL('./src/physics/', import.meta.url).pathname,
            '@ui/': new URL('./src/ui/', import.meta.url).pathname,
            '@utils/': new URL('./src/utils/', import.meta.url).pathname,
            '@core/': new URL('./src/core/', import.meta.url).pathname,
        },
    },
});
