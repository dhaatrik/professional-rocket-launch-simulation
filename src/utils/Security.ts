/**
 * Security utilities for the rocket simulation.
 */

/**
 * Generates a cryptographically secure random float between 0 (inclusive) and 1 (exclusive).
 * This is a secure alternative to Math.random().
 *
 * Uses the Web Crypto API (crypto.getRandomValues) which is available in
 * modern browsers and Node.js environments.
 */
export function secureRandom(): number {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    // Divide by 2^32 (4294967296) to get a number between 0 (inclusive) and 1 (exclusive)
    return array[0]! / 4294967296;
}
