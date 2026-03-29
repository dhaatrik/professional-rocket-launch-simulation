export class MathUtils {
    /**
     * Generates a cryptographically secure random number between 0 (inclusive) and 1 (exclusive).
     * Replaces Math.random() where security or better randomness distribution is required.
     */
    static secureRandom(): number {
        const array = new Uint32Array(1);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            crypto.getRandomValues(array);
        } else if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
        } else {
            // Fallback for environments without Web Crypto API (should be rare in modern contexts)
            return Math.random();
        }
        return array[0] / (0xffffffff + 1);
    }
}
