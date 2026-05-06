/**
 * @file TestActionExecutor.ts
 * @description IActionExecutor implementation that wires trading ActionTypes to
 * the SimulatedPlatformPosition broker API.
 *
 * Keeps an in-memory log of every executed action for assertion purposes.
 */

import type { IActionExecutor, ActionExecutionResult, ActionDefinition } from 'rule-engine-monorepo/rule-engine';
import type { SimulatedPlatformPosition } from '@volatil/simulated-platform';
import { ActionType } from '@volatil/rule-engine-trading';

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
export class TestActionExecutor implements IActionExecutor<TradingExecutionContext> {
  readonly #broker: SimulatedPlatformPosition;
  readonly #executedActions: ActionDefinition[] = [];

  constructor(broker: SimulatedPlatformPosition) {
    this.#broker = broker;
  }

  /** All actions that have been executed, in order. */
  get executedActions(): readonly ActionDefinition[] {
    return this.#executedActions;
  }

  async execute(
    action: ActionDefinition,
    context: TradingExecutionContext,
  ): Promise<ActionExecutionResult> {
    this.#executedActions.push(action);

    switch (action.actionRef as ActionType) {
      case ActionType.MOVE_STOP_LOSS: {
        const newSL: number = action.parameters['newStopPrice'] as number;
        const result = this.#broker.updatePositionStopLoss(context.positionId, newSL);
        if (!result.success) {
          return { success: false, error: result.reason };
        }
        return { success: true, data: { newStopLoss: newSL } };
      }

      case ActionType.PARTIAL_CLOSE: {
        const { quantity, percentage } = action.parameters as {
          quantity?: number;
          percentage?: number;
        };

        let qty: number;
        if (quantity !== undefined) {
          qty = quantity;
        } else if (percentage !== undefined) {
          qty = context.quantity * (percentage / 100);
        } else {
          return { success: false, error: 'PARTIAL_CLOSE: neither quantity nor percentage specified' };
        }

        const result = await this.#broker.closePartialPosition(context.positionId, qty);
        if (!result.success) {
          return { success: false, error: result.reason };
        }
        return {
          success: true,
          data: {
            closedQuantity: result.closedQuantity,
            remainingQuantity: result.remainingQuantity,
          },
        };
      }

      case ActionType.CANCEL_POSITION: {
        const result = await this.#broker.closePosition(context.positionId);
        if (!result.success) {
          return { success: false, error: result.reason };
        }
        return { success: true };
      }

      case ActionType.PLACE_ORDER: {
        // Phase 2 limitation: PLACE_ORDER is not wired to the broker.
        // The action parameters do not uniformly carry all fields required by
        // SimulatedPlatformPosition.submitOrder (side, type, quantity, symbol).
        // The action is recorded in executedActions for assertion purposes.
        // Full implementation deferred to Phase 4.
        console.warn('[TestActionExecutor] PLACE_ORDER recorded but not executed against broker (Phase 2 limit)');
        return { success: true, data: { deferred: true } };
      }

      default:
        return {
          success: false,
          error: `Unknown actionRef: ${action.actionRef}`,
        };
    }
  }
}
