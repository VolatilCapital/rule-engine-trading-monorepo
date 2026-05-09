/**
 * @file trailingStop.ts
 * @description Template factory for trailing stop rules.
 *
 * The trailing stop moves the stop loss dynamically as price advances,
 * maintaining a constant R-distance from the current price.
 *
 * All price/SL calculations are delegated to the execution context
 * via the `trailingNewSL` and `trailingShouldExecute` context fields,
 * which the testkit harness (and production rule execution service) must populate.
 *
 * The template uses `isRecurring = true` so the rule stays ACTIVE after
 * each successful execution and can continue trailing on subsequent ticks.
 */

import { RuleTemplate, AtomicCondition, Operator } from 'rule-engine-monorepo/rule-engine';
import { createMoveStopLossAction } from '../actions/moveStopLoss.js';

/**
 * Parameters for the trailing stop template.
 */
export interface TrailingStopParams {
  /**
   * Trailing distance expressed as R multiples (> 0).
   * The stop is placed `distance` R below the current price.
   * Example: 0.5 means the SL trails 0.5R below the current price.
   */
  distance: number;
  /**
   * Optional activation threshold in R multiples (> 0).
   * When provided, the trailing stop only activates once currentR >= activationR.
   * If omitted, trailing begins immediately from trade open.
   */
  activationR?: number;
}

/**
 * WeakMap that stores the TrailingStopParams for each created RuleTemplate.
 * This allows the testkit harness (or production context builder) to retrieve
 * the original params without extending the upstream RuleTemplate type.
 *
 * @internal Not exported from public-api — internal convention between the
 * trailingStop factory and the harness context builder.
 */
export const trailingStopParamsMap = new WeakMap<RuleTemplate, TrailingStopParams>();

/**
 * Creates a rule template for a trailing stop loss.
 *
 * The rule:
 * - Evaluates `trailingShouldExecute === 1` (populated by context builder)
 * - Executes MOVE_STOP_LOSS with `newStopPrice = { var: 'trailingNewSL' }`
 * - Stays ACTIVE after each fire (isRecurring = true)
 *
 * Context requirements (populated by harness or production service):
 * - `trailingShouldExecute`: 0 | 1 — 1 when activation is met AND new SL is favorable
 * - `trailingNewSL`: number — the new SL price to move to
 *
 * @example
 * ```ts
 * // Trailing 0.5R, no activation
 * const template = createTrailingStopTemplate({ distance: 0.5 });
 *
 * // Trailing 0.5R, only activates at 1R profit
 * const template = createTrailingStopTemplate({ distance: 0.5, activationR: 1 });
 * ```
 */
export function createTrailingStopTemplate(params: TrailingStopParams): RuleTemplate {
  const { distance, activationR } = params;

  if (distance <= 0) {
    throw new Error(`distance must be greater than 0 (got ${distance})`);
  }

  if (activationR !== undefined && activationR <= 0) {
    throw new Error(`activationR must be greater than 0 (got ${activationR})`);
  }

  // Condition: trailingShouldExecute === 1
  // The context builder is responsible for computing this value.
  const condition = new AtomicCondition(
    'trailingShouldExecute',
    Operator.EQUAL,
    1,
    'trailing_should_execute',
  );

  // Action: move stop loss to the pre-computed trailingNewSL value
  const action = createMoveStopLossAction({
    newStopPrice: { var: 'trailingNewSL' },
  });

  // isRecurring = true: rule stays ACTIVE after each successful execution
  const template = RuleTemplate.create(condition, [action], [], true);

  // Store params in WeakMap for harness context builder retrieval
  trailingStopParamsMap.set(template, { distance, activationR });

  return template;
}
