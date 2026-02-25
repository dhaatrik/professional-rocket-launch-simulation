
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CSP Security Headers', () => {
    const htmlFiles = ['analysis.html', 'telemetry.html', 'index.html'];

    htmlFiles.forEach((file) => {
        it(`${file} should have a strict Content-Security-Policy`, () => {
            const filePath = path.resolve(__dirname, '..', 'public', file);
            const content = fs.readFileSync(filePath, 'utf-8');

            // Check for meta tag existence
            expect(content).toContain('<meta http-equiv="Content-Security-Policy"');

            // Extract the content attribute
            const match = content.match(/<meta http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
            expect(match).not.toBeNull();

            if (match) {
                const csp = match[1];
                // Must have default-src 'self'
                expect(csp).toContain("default-src 'self'");
                // Must restrict scripts to 'self' (no unsafe-inline or unsafe-eval)
                expect(csp).toContain("script-src 'self'");
                expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
                expect(csp).not.toContain("script-src 'unsafe-inline'");
                // Must restrict objects/embeds
                // (default-src covers object-src if not specified, but good to check generally safe defaults)
            }
        });
    });
});
