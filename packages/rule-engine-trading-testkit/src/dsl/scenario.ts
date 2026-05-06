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

import assert from 'node:assert/strict';
import { RuleScenarioHarness, type HarnessConfig, type OpenPositionOpts } from '../harness/RuleScenarioHarness.js';
import { ActionType } from '@volatil/rule-engine-trading';
import type { RuleTemplate } from 'rule-engine-monorepo/rule-engine';

// ──────────────────────────────────────────────────────────────────────────────
// Step types (internal)
// ──────────────────────────────────────────────────────────────────────────────

type Step =
  | { kind: 'openPosition'; opts: OpenPositionOpts }
  | { kind: 'attachRule'; template: RuleTemplate; params?: Record<string, unknown> }
  | { kind: 'priceTo'; price: number }
  | { kind: 'expectStopLossAt'; price: number; tolerance?: number }
  | { kind: 'expectTakeProfitAt'; price: number; tolerance?: number }
  | { kind: 'expectActionExecuted'; actionType: ActionType };

// ──────────────────────────────────────────────────────────────────────────────
// ScenarioBuilder
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fluent builder that accumulates scenario steps and executes them in sequence
 * on a fresh RuleScenarioHarness when `run()` is called.
 */
export class ScenarioBuilder {
  readonly #description: string;
  #platformConfig: HarnessConfig | null = null;
  readonly #steps: Step[] = [];

  constructor(description: string) {
    this.#description = description;
  }

  /**
   * Configure the simulated broker platform.
   * Must be called before any other step that requires broker state.
   */
  platform(config: HarnessConfig): this {
    this.#platformConfig = config;
    return this;
  }

  /** Open a market position. */
  openPosition(opts: OpenPositionOpts): this {
    this.#steps.push({ kind: 'openPosition', opts });
    return this;
  }

  /** Attach a rule template to the current position. */
  attachRule(template: RuleTemplate, params?: Record<string, unknown>): this {
    this.#steps.push({ kind: 'attachRule', template, params });
    return this;
  }

  /**
   * Drive the broker price to `price` and tick all attached rules.
   * Assertion steps placed after this will see the post-tick harness state.
   */
  priceTo(price: number): this {
    this.#steps.push({ kind: 'priceTo', price });
    return this;
  }

  /**
   * Assert that the current SL equals `price` (within optional `tolerance`).
   * Evaluated at the point in the sequence where it appears.
   */
  expectStopLossAt(price: number, tolerance = 0.000001): this {
    this.#steps.push({ kind: 'expectStopLossAt', price, tolerance });
    return this;
  }

  /**
   * Assert that the current TP equals `price` (within optional `tolerance`).
   */
  expectTakeProfitAt(price: number, tolerance = 0.000001): this {
    this.#steps.push({ kind: 'expectTakeProfitAt', price, tolerance });
    return this;
  }

  /**
   * Assert that at least one action of the given ActionType has been executed.
   */
  expectActionExecuted(actionType: ActionType): this {
    this.#steps.push({ kind: 'expectActionExecuted', actionType });
    return this;
  }

  /**
   * Execute all steps sequentially on a fresh harness.
   * Throws (via node:assert) if any assertion fails.
   */
  async run(): Promise<void> {
    assert.ok(
      this.#platformConfig !== null,
      `[scenario: ${this.#description}] .platform() must be called before .run()`,
    );

    const harness = new RuleScenarioHarness(this.#platformConfig!);

    for (const step of this.#steps) {
      switch (step.kind) {
        case 'openPosition':
          await harness.openPosition(step.opts);
          break;

        case 'attachRule':
          await harness.attachRule(step.template, step.params);
          break;

        case 'priceTo':
          await harness.priceTo(step.price);
          break;

        case 'expectStopLossAt': {
          const sl = harness.currentSL;
          assert.ok(
            sl !== undefined,
            `[scenario: ${this.#description}] expectStopLossAt(${step.price}): SL is undefined`,
          );
          assert.ok(
            Math.abs(sl - step.price) <= (step.tolerance ?? 0.000001),
            `[scenario: ${this.#description}] expectStopLossAt: expected SL ≈ ${step.price}, got ${sl}`,
          );
          break;
        }

        case 'expectTakeProfitAt': {
          const tp = harness.currentTP;
          assert.ok(
            tp !== undefined,
            `[scenario: ${this.#description}] expectTakeProfitAt(${step.price}): TP is undefined`,
          );
          assert.ok(
            Math.abs(tp - step.price) <= (step.tolerance ?? 0.000001),
            `[scenario: ${this.#description}] expectTakeProfitAt: expected TP ≈ ${step.price}, got ${tp}`,
          );
          break;
        }

        case 'expectActionExecuted': {
          const executed = harness.executedActions.some(a => a.actionRef === step.actionType);
          assert.ok(
            executed,
            `[scenario: ${this.#description}] expectActionExecuted(${step.actionType}): action not found in ${JSON.stringify(harness.executedActions.map(a => a.actionRef))}`,
          );
          break;
        }
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Public factory
// ──────────────────────────────────────────────────────────────────────────────

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
export function scenario(description: string): ScenarioBuilder {
  return new ScenarioBuilder(description);
}
