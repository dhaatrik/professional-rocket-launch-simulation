import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = process.env.PORT || 8080;
const ROOT_DIR = path.join(process.cwd(), 'public');

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm'
};

const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains'
};

// Rate Limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 200;
const MAX_TRACKED_IPS = 5000;
const requestCounts = new Map(); // ip -> { count, startTime }

// Security: Blocklist of sensitive files and directories
const BLOCKED_RESOURCES = new Set([
    'server.js',
    'package.json',
    'package-lock.json',
    'pnpm-lock.yaml',
    '.env',
    '.git',
    '.github',
    '.gitignore',
    '.prettierrc',
    'eslint.config.js',
    'tsconfig.json',
    'vitest.config.ts',
    'src',
    'tests',
    'verification',
    'node_modules',
    '.Jules',
    'README.md',
    'LICENSE',
    'AGENTS.md'
]);

// Garbage collection for rate limit map
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of requestCounts.entries()) {
        if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
            requestCounts.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS);

function getClientIp(req) {
    const remoteAddress = req.socket.remoteAddress;
    const trustedProxies = (process.env.TRUSTED_PROXIES || '').split(',').map(ip => ip.trim()).filter(Boolean);

    const normalizeIp = (ip) => (ip || '').replace(/^::ffff:/, '');
    const normalizedRemote = normalizeIp(remoteAddress);

    const isTrusted = trustedProxies.some(proxy => normalizeIp(proxy) === normalizedRemote);

    if (!isTrusted) {
        return normalizedRemote;
    }

    const xff = req.headers['x-forwarded-for'];
    if (!xff) {
        return normalizedRemote;
    }

    const ips = xff.split(',').map(ip => ip.trim());

    let clientIp = normalizedRemote;
    let foundUntrusted = false;

    for (let i = ips.length - 1; i >= 0; i--) {
        const ip = normalizeIp(ips[i]);
        if (trustedProxies.some(proxy => normalizeIp(proxy) === ip)) {
            continue;
        }
        clientIp = ip;
        foundUntrusted = true;
        break;
    }

    if (!foundUntrusted && ips.length > 0) {
        clientIp = normalizeIp(ips[0]);
    }

    return clientIp;
}

http.createServer((req, res) => {
    // Rate Limiting Check
    const clientIp = getClientIp(req);
    const now = Date.now();

    let requestData = requestCounts.get(clientIp);

    // Initialize or reset if window expired
    if (!requestData || now - requestData.startTime > RATE_LIMIT_WINDOW_MS) {
        // DoS Protection: If map is full and this is a new IP, evict the oldest IP
        if (requestCounts.size >= MAX_TRACKED_IPS && !requestCounts.has(clientIp)) {
            console.warn(`[WARN] Rate limit map full (${requestCounts.size} IPs). Evicting oldest IP to prevent DoS.`);
            const oldestIp = requestCounts.keys().next().value;
            requestCounts.delete(oldestIp);
        }

        requestData = { count: 0, startTime: now };
        requestCounts.set(clientIp, requestData);
    }

    requestData.count++;

    if (requestData.count > MAX_REQUESTS_PER_WINDOW) {
        res.writeHead(429, {
            'Content-Type': 'text/plain',
            ...SECURITY_HEADERS
        });
        res.end('Too Many Requests');
        return;
    }

    // Security: Prevent Directory Traversal
    try {
        // Security: Prevent Null Byte Injection early before decoding or URL parsing
        if (req.url.includes('\0') || req.url.includes('%00')) {
            console.warn(`[WARN] Blocked null byte injection attempt: ${req.url}`);
            res.writeHead(400, {
                'Content-Type': 'text/plain',
                ...SECURITY_HEADERS
            });
            res.end('Bad Request');
            return;
        }

        const safeUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        // Log only the method and pathname, excluding query parameters to prevent sensitive data leakage
        // Use JSON.stringify to sanitize output against log injection
        console.log(`${req.method} ${JSON.stringify(safeUrl.pathname)}`);

        let pathname = decodeURIComponent(safeUrl.pathname);

        // Security: Block access to sensitive files and directories
        const rootPath = pathname.split('/').filter(Boolean)[0]; // robustly extract first segment
        if (rootPath && BLOCKED_RESOURCES.has(rootPath)) {
            console.warn(`[WARN] Blocked access to sensitive resource: ${pathname}`);
            res.writeHead(403, {
                'Content-Type': 'text/plain',
                ...SECURITY_HEADERS
            });
            res.end('Forbidden');
            return;
        }

        if (pathname === '/') {
            pathname = '/index.html';
        }

        // Security: Prevent access to hidden files/directories (starting with .)
        if (pathname.split('/').some(part => part.startsWith('.'))) {
            res.writeHead(403, {
                'Content-Type': 'text/plain',
                ...SECURITY_HEADERS
            });
            res.end('Forbidden');
            return;
        }

        const filePath = path.join(ROOT_DIR, pathname);

        // Ensure the resolved path starts with the ROOT_DIR
        // This prevents access to files outside the project root
        if (!filePath.startsWith(ROOT_DIR) ||
            (filePath.length > ROOT_DIR.length && filePath[ROOT_DIR.length] !== path.sep)) {
            res.writeHead(403, {
                'Content-Type': 'text/plain',
                ...SECURITY_HEADERS
            });
            res.end('Forbidden');
            return;
        }

        const extname = path.extname(filePath);
        let contentType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (error, content) => {
            if (error) {
                if (error.code === 'ENOENT') {
                    const errorPage = path.join(ROOT_DIR, '404.html');
                    fs.readFile(errorPage, (err, content404) => {
                        res.writeHead(404, {
                            'Content-Type': 'text/html',
                            ...SECURITY_HEADERS
                        });
                        res.end(content404 || '404 Not Found', 'utf-8');
                    });
                } else {
                    console.error('Server Error:', error);
                    res.writeHead(500, {
                        ...SECURITY_HEADERS
                    });
                    res.end('Server Error: Internal Server Error');
                }
            } else {
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Cross-Origin-Opener-Policy': 'same-origin',
                    'Cross-Origin-Embedder-Policy': 'require-corp',
                    ...SECURITY_HEADERS
                });
                res.end(content, 'utf-8');
            }
        });
    } catch (e) {
        console.error('Request processing error:', e);
        res.writeHead(400, {
            ...SECURITY_HEADERS
        });
        res.end('Bad Request');
    }

}).listen(PORT);

console.log(`Server running at http://localhost:${PORT}/`);
