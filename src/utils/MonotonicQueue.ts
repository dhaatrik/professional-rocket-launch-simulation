/**
 * Monotonic Queue for tracking maximum values in a sliding window.
 *
 * Provides O(1) amortized time for push and O(1) for getting the maximum.
 */
export class MonotonicMaxQueue {
    private deque: number[] = [];
    private head: number = 0;

    /**
     * Push a value into the queue.
     * Maintains non-increasing order by removing smaller elements from the back.
     *
     * @param val - The value to push
     */
    push(val: number): void {
        while (this.deque.length > this.head && this.deque[this.deque.length - 1]! < val) {
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
        if (this.deque.length > this.head && this.deque[this.head] === val) {
            this.head++;

            // Periodically compact the array to prevent infinite memory growth
            // This happens when the head advances past half the array length, and it's large enough
            if (this.head > 100 && this.head > this.deque.length / 2) {
                this.deque = this.deque.slice(this.head);
                this.head = 0;
            }
        }
    }

    /**
     * Get the current maximum value in the window.
     */
    get max(): number | undefined {
        if (this.deque.length > this.head) {
            return this.deque[this.head];
        }
        return undefined;
    }

    /**
     * Reset the queue.
     */
    clear(): void {
        this.deque = [];
        this.head = 0;
    }
}
