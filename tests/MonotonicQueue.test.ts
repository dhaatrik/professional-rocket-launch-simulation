import { describe, it, expect } from 'vitest';
import { MonotonicMaxQueue } from '../src/utils/MonotonicQueue';

describe('MonotonicMaxQueue', () => {
    it('should maintain the maximum value', () => {
        const q = new MonotonicMaxQueue();
        q.push(10);
        expect(q.max).toBe(10);
        q.push(5);
        expect(q.max).toBe(10);
        q.push(15);
        expect(q.max).toBe(15);
    });

    it('should correctly pop values when they match the maximum', () => {
        const q = new MonotonicMaxQueue();
        q.push(10);
        q.push(5);
        expect(q.max).toBe(10);

        q.pop(10);
        expect(q.max).toBe(5);

        q.pop(5);
        expect(q.max).toBeUndefined();
    });

    it('should not pop values when they do not match the maximum', () => {
        const q = new MonotonicMaxQueue();
        q.push(10);
        q.push(5);
        expect(q.max).toBe(10);

        q.pop(5); // 5 is in the deque but not at the front
        expect(q.max).toBe(10);
    });

    it('should handle sliding window correctly', () => {
        const q = new MonotonicMaxQueue();
        const window = [1, 3, -1, -3, 5, 3, 6, 7];
        const k = 3;
        const results: (number | undefined)[] = [];

        for (let i = 0; i < window.length; i++) {
            q.push(window[i]!);
            if (i >= k) {
                q.pop(window[i - k]!);
            }
            if (i >= k - 1) {
                results.push(q.max);
            }
        }

        expect(results).toEqual([3, 3, 5, 5, 6, 7]);
    });

    it('should clear correctly', () => {
        const q = new MonotonicMaxQueue();
        q.push(10);
        q.clear();
        expect(q.max).toBeUndefined();
    });
});
