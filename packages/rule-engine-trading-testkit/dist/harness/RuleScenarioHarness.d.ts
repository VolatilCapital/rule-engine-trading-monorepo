/**
 * @file RuleScenarioHarness.ts
 * @description Integration harness that wires a SimulatedPlatformPosition broker
 * to the rule-engine infrastructure, enabling end-to-end scenario tests.
 */
import { type ActionDefinition } from 'rule-engine-monorepo/rule-engine';
import type { RuleTemplate } from 'rule-engine-monorepo/rule-engine';
import { SimulatedPlatformPosition } from '@volatil/simulated-platform';
import type { Position } from '@volatil/simulated-platform';
import { type Clock } from './Clock.js';
/** Minimal set of facts the ContextProvider exposes to rule conditions. */
export interface TradingContextFacts {
    /** Current mid price (bid = ask for zero-spread mode) */
    currentPrice: number;
    /** R-multiple: (currentPrice - entryPrice) / (entryPrice - stopLoss). Positive = profit. */
    currentR: number;
    /**
     * Side-aware, profit-positive percent move from entry (1.5 = +1.5 %).
     * Positive when the trade is winning.
     */
    currentPctFromEntry: number;
    /**
     * Side-aware, profit-positive absolute price move from entry.
     * Positive when the trade is winning.
     */
    currentPriceMove: number;
    /** Elapsed time since position opened, in minutes */
    elapsedMinutes: number;
    /** Peak R reached during the trade lifetime */
    peakR: number;
    /** Drawdown from peak R (peakR - currentR, floored at 0) */
    drawdownFromPeakR: number;
    /**
     * Peak percent-from-entry reached during the trade lifetime.
     * Side-aware, profit-positive. Always ≥ 0 by construction.
     */
    peakPctFromEntry: number;
    /**
     * Peak absolute price move from entry reached during the trade lifetime.
     * Side-aware, profit-positive. Always ≥ 0 by construction.
     */
    peakPriceMove: number;
    /** Drawdown from the percent peak (`max(0, peakPctFromEntry − currentPctFromEntry)`). */
    drawdownFromPeakPct: number;
    /** Drawdown from the price peak (`max(0, peakPriceMove − currentPriceMove)`). */
    drawdownFromPeakPrice: number;
    /** Arbitrary per-rule facts (e.g. slMoved, partialSlDone) */
    facts: Record<string, boolean>;
    /** Pattern detection flags (populated externally if needed) */
    patterns: Record<string, boolean>;
}
export interface HarnessConfig {
    symbol: string;
    leverage: number;
    balance: number;
    /**
     * Optional time port. Defaults to `systemClock` (real Date.now()).
     * Pass a `TestClock` to drive `elapsedMinutes` deterministically.
     */
    clock?: Clock;
}
export interface OpenPositionOpts {
    side: 'BUY' | 'SELL';
    volume: number;
    entry: number;
    sl?: number;
    tp?: number;
}
export interface PlacePendingOrderOpts {
    /** LIMIT triggers when price crosses the level from the opposite direction; STOP triggers when crossed in the trade direction. */
    type: 'LIMIT' | 'STOP';
    side: 'BUY' | 'SELL';
    /** Lot size */
    volume: number;
    /** Trigger price */
    price: number;
}
/**
 * Provides an integrated test environment for trading rule scenarios.
 *
 * Wire-up:
 * - SimulatedPlatformPosition (broker)
 * - SinglePlatformRegistry + account 'test'
 * - InMemoryRepository (rule instances)
 * - JsonLogicConditionEvaluator
 * - TestActionExecutor (wired to broker)
 * - RuleExecutionService<TradingExecutionContext>
 *
 * Typical usage:
 * ```ts
 * const h = new RuleScenarioHarness({ symbol: 'EURUSD', leverage: 100, balance: 10_000 });
 * await h.openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 });
 * await h.attachRule(createMoveSLToBreakevenTemplate({ ... }));
 * await h.priceTo(1.0520);  // drives price and ticks rules
 * ```
 */
export declare class RuleScenarioHarness {
    #private;
    static readonly ACCOUNT_ID = "test";
    constructor(config: HarnessConfig);
    /**
     * Open a market position on the configured symbol.
     * Sets the initial price feed to `entry` before submitting the order.
     */
    openPosition(opts: OpenPositionOpts): Promise<void>;
    /**
     * Place a pending order (LIMIT or STOP) on the configured symbol.
     * Returns the broker order id; also stored internally so the next tick's
     * context exposes `pendingOrderId`.
     */
    placePendingOrder(opts: PlacePendingOrderOpts): Promise<string>;
    /**
     * Attach a rule template to the open position.
     * Instantiates a RuleInstance, saves it to the repository, and registers
     * its ID so that tick() will evaluate it.
     *
     * If the template was created by createTrailingStopTemplate, the params
     * are retrieved from the WeakMap and stored for context population.
     */
    attachRule(template: RuleTemplate, _params?: Record<string, unknown>): Promise<void>;
    /**
     * Drive the broker price to `price`.
     * Convention: bid = ask = price (zero spread, deterministic arithmetic).
     * Internally calls tick() after updating the price feed.
     */
    priceTo(price: number): Promise<void>;
    /**
     * Set the pattern flags exposed in the rule evaluation context.
     * Replaces (does not merge) the previous pattern map.
     */
    setPatterns(patterns: Record<string, boolean>): void;
    /**
     * Evaluate all attached rules against the current broker state.
     * Each rule gets its own context so trailing stop helpers can be
     * computed per-rule using the rule's specific TrailingStopParams.
     */
    tick(): Promise<void>;
    /** Current SL of the open position (undefined if no position or no SL set). */
    get currentSL(): number | undefined;
    /** Current TP of the open position (undefined if no position or no TP set). */
    get currentTP(): number | undefined;
    /** All actions executed so far, in order. */
    get executedActions(): readonly ActionDefinition[];
    /** Current position object from the broker (undefined if no open position). */
    get positionState(): Position | undefined;
    /** Last { bid, ask } tick fed to the broker. */
    get lastBidAsk(): {
        bid: number;
        ask: number;
    };
    /** Currently tracked pending order id, if any. */
    get pendingOrderId(): string | null;
    /** Expose the underlying broker for advanced test assertions. */
    get broker(): SimulatedPlatformPosition;
}
//# sourceMappingURL=RuleScenarioHarness.d.ts.map