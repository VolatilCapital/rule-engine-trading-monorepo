/**
 * @file trailingStop.ts
 * @description Template factory for trailing stop rules.
 *
 * The trailing stop moves the stop loss dynamically as price advances,
 * placing the SL at a configurable `distance` from the current price/profit.
 *
 * Both `distance` (the geometric step the SL trails the price by) and the
 * optional `activation` threshold (profit-from-entry that must be reached
 * before trailing arms) are `Measurement` values. They may use independent
 * units (`R`, `percent`, or `price`) because they describe orthogonal things:
 * `distance` is a geometric offset, `activation` is a profit-from-entry gate.
 *
 * The template stays pure — it emits a single `AtomicCondition` on
 * `trailingShouldExecute` and a `MOVE_STOP_LOSS` action that reads the
 * pre-computed `trailingNewSL`. All unit-aware arithmetic lives in the
 * adapter (the testkit harness or the production context builder).
 *
 * The template uses `isRecurring = true` so the rule stays ACTIVE after
 * each successful execution and can continue trailing on subsequent ticks.
 */
import { RuleTemplate } from 'rule-engine-monorepo/rule-engine';
import { type Measurement } from '../domain/Measurement.js';
/**
 * Parameters for the trailing stop template.
 */
export interface TrailingStopParams {
    /**
     * Trailing distance, expressed as a `Measurement`.
     * - `R`: SL trails the current price by `value` × initial-risk units.
     * - `percent`: SL trails the current price by `value` % of price.
     * - `price`: SL trails the current price by `value` quote-currency units.
     *
     * Must be strictly positive.
     */
    distance: Measurement;
    /**
     * Optional activation threshold, expressed as a `Measurement`.
     * The trailing arms only once the profit-from-entry (in `activation.unit`)
     * reaches `activation.value`. Once armed, it stays armed for the lifetime
     * of the rule instance, even if profit dips back below the threshold.
     *
     * Omit to start trailing immediately. May use a different unit than `distance`.
     */
    activation?: Measurement;
}
/**
 * WeakMap that stores the TrailingStopParams for each created RuleTemplate.
 * This allows the testkit harness (or production context builder) to retrieve
 * the original params without extending the upstream RuleTemplate type.
 *
 * @internal Not exported from public-api — internal convention between the
 * trailingStop factory and the harness context builder.
 */
export declare const trailingStopParamsMap: WeakMap<RuleTemplate, TrailingStopParams>;
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
 * Throws synchronously when:
 * - `distance` is not a well-formed positive `Measurement`.
 * - `activation` is provided and not a well-formed positive `Measurement`.
 *
 * @example
 * ```ts
 * // Trailing 0.5R, no activation
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.5, unit: 'R' },
 * });
 *
 * // Trailing 0.5%, only activates at +1% profit
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.5, unit: 'percent' },
 *   activation: { value: 1, unit: 'percent' },
 * });
 *
 * // Mixed units: trail by 0.3 in price, arm once profit reaches 1R
 * const template = createTrailingStopTemplate({
 *   distance: { value: 0.3, unit: 'price' },
 *   activation: { value: 1, unit: 'R' },
 * });
 * ```
 */
export declare function createTrailingStopTemplate(params: TrailingStopParams): RuleTemplate;
//# sourceMappingURL=trailingStop.d.ts.map