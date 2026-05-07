/**
 * @file public-api.ts
 * @description Public API for @volatil/rule-engine-trading-testkit
 */

// DSL
export { scenario, ScenarioBuilder } from './dsl/scenario.js';

// Harness
export { RuleScenarioHarness } from './harness/RuleScenarioHarness.js';
export type { HarnessConfig, OpenPositionOpts, TradingContextFacts } from './harness/RuleScenarioHarness.js';

// Executor
export { TestActionExecutor } from './harness/TestActionExecutor.js';
export type { TradingExecutionContext } from './harness/TestActionExecutor.js';

// Clock port
export { TestClock, systemClock } from './harness/Clock.js';
export type { Clock } from './harness/Clock.js';
