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
    positionId: string;
    symbol: string;
    /** Current position quantity (lots) */
    quantity: number;
    /** Current bid price */
    currentPrice: number;
    /** Arbitrary extra facts forwarded from the ContextProvider */
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