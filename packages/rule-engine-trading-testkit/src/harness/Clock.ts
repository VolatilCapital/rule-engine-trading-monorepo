/**
 * @file Clock.ts
 * @description Time port for the test harness — abstracts Date.now() so tests
 * can drive elapsed time deterministically without fake timers.
 */

/**
 * Minimal time port. The harness reads the current epoch in ms via this port.
 */
export interface Clock {
  now(): number;
}

/**
 * Default adapter backed by `Date.now()`.
 * Use this when the test does not need to control time.
 */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/**
 * Test adapter — advances explicitly via `advance(ms)`.
 * Starts at epoch 0 by default; pass an initial value to override.
 *
 * @example
 * ```ts
 * const clock = new TestClock();
 * harness.openPosition({ ... });        // openedAt = 0
 * clock.advance(30 * 60_000);           // +30 minutes
 * await harness.priceTo(1.0510);        // elapsedMinutes = 30
 * ```
 */
export class TestClock implements Clock {
  #t: number;

  constructor(initial = 0) {
    this.#t = initial;
  }

  now(): number {
    return this.#t;
  }

  advance(ms: number): void {
    if (ms < 0) throw new Error('TestClock.advance: ms must be >= 0');
    this.#t += ms;
  }

  set(ms: number): void {
    if (ms < 0) throw new Error('TestClock.set: ms must be >= 0');
    this.#t = ms;
  }
}
