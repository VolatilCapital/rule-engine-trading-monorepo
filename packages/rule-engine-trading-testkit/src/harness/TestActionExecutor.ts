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

  /**
   * Resolve JsonLogic `{ "var": "key" }` expressions found in action parameters
   * against the execution context. Only resolves top-level parameters whose value
   * is a plain object containing a `var` property. Non-JsonLogic values pass through
   * unchanged.
   */
  #resolveParams(
    params: Record<string, unknown>,
    context: TradingExecutionContext,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(params)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'var' in value &&
        typeof (value as Record<string, unknown>)['var'] === 'string'
      ) {
        const varName = (value as Record<string, string>)['var'];
        resolved[key] = context[varName];
      } else {
        resolved[key] = value;
      }
    }
    return resolved;
  }

  async execute(
    action: ActionDefinition,
    context: TradingExecutionContext,
  ): Promise<ActionExecutionResult> {
    this.#executedActions.push(action);

    // Resolve JsonLogic `{ "var": "key" }` expressions in parameters against context
    const params = this.#resolveParams(action.parameters, context);

    switch (action.actionRef as ActionType) {
      case ActionType.MOVE_STOP_LOSS: {
        const newSL: number = params['newStopPrice'] as number;
        const result = this.#broker.updatePositionStopLoss(context.positionId, newSL);
        if (!result.success) {
          return { success: false, error: result.reason };
        }
        return { success: true, data: { newStopLoss: newSL } };
      }

      case ActionType.PARTIAL_CLOSE: {
        const { quantity, percentage } = params as {
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
        const orderType = params['type'] as string | undefined;

        if (orderType === 'close_position') {
          const result = await this.#broker.closePosition(context.positionId);
          if (!result.success) {
            return { success: false, error: result.reason };
          }
          return { success: true };
        }

        // Other PLACE_ORDER types: not wired to the broker.
        // The action is recorded in executedActions for assertion purposes.
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
