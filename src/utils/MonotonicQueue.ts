/**
 * Monotonic Queue for tracking maximum values in a sliding window.
 *
 * Provides O(1) amortized time for push and O(1) for getting the maximum.
 */
export class MonotonicMaxQueue {
    private deque: number[] = [];

    /**
     * Push a value into the queue.
     * Maintains non-increasing order by removing smaller elements from the back.
     *
     * @param val - The value to push
     */
    push(val: number): void {
        while (this.deque.length > 0 && this.deque[this.deque.length - 1]! < val) {
            this.deque.pop();
        }
        this.deque.push(val);
    }

    /**
     * Remove a value from the front if it matches.
     * Used when the sliding window slides past a value.
     *
     * @param val - The value that is leaving the sliding window
     */
    pop(val: number): void {
        if (this.deque.length > 0 && this.deque[0] === val) {
            this.deque.shift();
        }
    }

    /**
     * Get the current maximum value in the window.
     */
    get max(): number | undefined {
        return this.deque[0];
    }

    /**
     * Reset the queue.
     */
    clear(): void {
        this.deque = [];
    }
}
