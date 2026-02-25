import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Strict CSP Security Headers', () => {
    const htmlFiles = ['analysis.html', 'telemetry.html', 'index.html'];

    htmlFiles.forEach((file) => {
        it(`${file} should have a strict Content-Security-Policy (no unsafe-inline styles)`, () => {
            const filePath = path.resolve(__dirname, '..', 'public', file);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Extract the content attribute
            const match = content.match(/<meta http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
            expect(match).not.toBeNull();

            if (match) {
                const csp = match[1];

                // Check style-src
                // It should contain "style-src 'self'" but NOT "'unsafe-inline'"
                expect(csp).toContain("style-src 'self'");
                expect(csp).not.toContain("style-src 'self' 'unsafe-inline'");
                // Check specifically that unsafe-inline is not present in style-src
                // Simple check: splitting by ; and finding style-src
                const directives = csp.split(';').map(d => d.trim());
                const styleSrc = directives.find(d => d.startsWith('style-src'));

                expect(styleSrc).toBeDefined();
                if (styleSrc) {
                    expect(styleSrc).not.toContain("'unsafe-inline'");
                }
            }
        });
    });
});
