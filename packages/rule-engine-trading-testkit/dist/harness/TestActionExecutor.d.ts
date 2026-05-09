/**
 * @file TestActionExecutor.ts
 * @description IActionExecutor implementation that wires trading ActionTypes to
 * the SimulatedPlatformPosition broker API.
 *
 * Keeps an in-memory log of every executed action for assertion purposes.
 */
import type { IActionExecutor, ActionExecutionResult, ActionDefinition } from 'rule-engine-monorepo/rule-engine';
import type { SimulatedPlatformPosition } from '@volatil/simulated-platform';
/**
 * Execution context expected by this executor.
 * The harness populates this from broker state before each rule tick.
 */
export interface TradingExecutionContext {
    /** Position id when an open position exists. Optional for pending-only scenarios. */
    positionId?: string;
    /** Pending order id when one is placed. Used by CANCEL_POSITION on pending-only flows. */
    pendingOrderId?: string;
    symbol: string;
    /** Position quantity (lots). 0 when no position is open. */
    quantity: number;
    currentPrice: number;
    /**
     * Side-aware, profit-positive percent move from entry. Positive when the
     * trade is winning, negative when it is losing.
     * Formula (adapter): `sign × (currentPrice − entryPrice) / entryPrice × 100`.
     */
    currentPctFromEntry: number;
    /**
     * Side-aware, profit-positive absolute price move from entry. Positive when
     * the trade is winning, negative when it is losing.
     * Formula (adapter): `sign × (currentPrice − entryPrice)`.
     */
    currentPriceMove: number;
    /**
     * Side-aware, profit-positive percent peak from entry (most-favorable-ever
     * percent move seen during the trade lifetime). Always ≥ 0 by construction.
     */
    peakPctFromEntry?: number;
    /**
     * Side-aware, profit-positive absolute price peak move from entry
     * (most-favorable-ever absolute price move). Always ≥ 0 by construction.
     */
    peakPriceMove?: number;
    /**
     * Drawdown from the percent peak: `max(0, peakPctFromEntry − currentPctFromEntry)`.
     */
    drawdownFromPeakPct?: number;
    /**
     * Drawdown from the price peak: `max(0, peakPriceMove − currentPriceMove)`.
     */
    drawdownFromPeakPrice?: number;
    [key: string]: unknown;
}
/**
 * IActionExecutor implementation for trading rule integration tests.
 *
 * Dispatches each ActionType to the corresponding SimulatedPlatformPosition
 * method. Accumulates a log of all executed actions that tests can inspect.
 *
 * Phase 2 limitations (to document in Phase 4):
 * - PLACE_ORDER: not implemented against the broker — logged only. The
 *   SimulatedPlatformPosition API requires an explicit symbol, type, side and
 *   quantity that are not carried uniformly in the action parameters.
 * - SCALE_OUT / START_TRAILING_STOP: not mapped (no broker-level API).
 */
export declare class TestActionExecutor implements IActionExecutor<TradingExecutionContext> {
    #private;
    constructor(broker: SimulatedPlatformPosition);
    /** All actions that have been executed, in order. */
    get executedActions(): readonly ActionDefinition[];
    execute(action: ActionDefinition, context: TradingExecutionContext): Promise<ActionExecutionResult>;
}
//# sourceMappingURL=TestActionExecutor.d.ts.map