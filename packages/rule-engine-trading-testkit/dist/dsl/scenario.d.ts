/**
 * @file scenario.ts
 * @description Fluent DSL builder for declarative trading rule integration scenarios.
 *
 * @example
 * ```ts
 * await scenario('SL moves to breakeven at 1R')
 *   .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
 *   .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
 *   .attachRule(template)
 *   .priceTo(1.0520)
 *   .expectStopLossAt(1.0500)
 *   .expectActionExecuted(ActionType.MOVE_STOP_LOSS)
 *   .run();
 * ```
 */
import { type HarnessConfig, type OpenPositionOpts } from '../harness/RuleScenarioHarness.js';
import { ActionType } from '@volatil/rule-engine-trading';
import type { RuleTemplate } from 'rule-engine-monorepo/rule-engine';
/**
 * Fluent builder that accumulates scenario steps and executes them in sequence
 * on a fresh RuleScenarioHarness when `run()` is called.
 */
export declare class ScenarioBuilder {
    #private;
    constructor(description: string);
    /**
     * Configure the simulated broker platform.
     * Must be called before any other step that requires broker state.
     */
    platform(config: HarnessConfig): this;
    /** Open a market position. */
    openPosition(opts: OpenPositionOpts): this;
    /** Attach a rule template to the current position. */
    attachRule(template: RuleTemplate, params?: Record<string, unknown>): this;
    /**
     * Drive the broker price to `price` and tick all attached rules.
     * Assertion steps placed after this will see the post-tick harness state.
     */
    priceTo(price: number): this;
    /**
     * Assert that the current SL equals `price` (within optional `tolerance`).
     * Evaluated at the point in the sequence where it appears.
     */
    expectStopLossAt(price: number, tolerance?: number): this;
    /**
     * Assert that the current TP equals `price` (within optional `tolerance`).
     */
    expectTakeProfitAt(price: number, tolerance?: number): this;
    /**
     * Assert that at least one action of the given ActionType has been executed.
     */
    expectActionExecuted(actionType: ActionType): this;
    /**
     * Execute all steps sequentially on a fresh harness.
     * Throws (via node:assert) if any assertion fails.
     */
    run(): Promise<void>;
}
/**
 * Entry-point for the scenario DSL.
 *
 * @example
 * ```ts
 * await scenario('breakeven rule fires at 1R')
 *   .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
 *   .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
 *   .attachRule(template)
 *   .priceTo(1.0520)
 *   .expectStopLossAt(1.0500)
 *   .run();
 * ```
 */
export declare function scenario(description: string): ScenarioBuilder;
//# sourceMappingURL=scenario.d.ts.map