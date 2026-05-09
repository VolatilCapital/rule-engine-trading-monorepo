/**
 * @file RuleScenarioHarness.ts
 * @description Integration harness that wires a SimulatedPlatformPosition broker
 * to the rule-engine infrastructure, enabling end-to-end scenario tests.
 */

import {
  RuleInstance,
  RuleExecutionService,
  JsonLogicConditionEvaluator,
  InMemoryRepository,
  InMemoryEventEmitter,
  silentLogger,
  type ActionDefinition,
} from 'rule-engine-monorepo/rule-engine';
import type { RuleTemplate } from 'rule-engine-monorepo/rule-engine';
import {
  SimulatedPlatformPosition,
  SinglePlatformRegistry,
} from '@volatil/simulated-platform';
import type { Position } from '@volatil/simulated-platform';

import { TestActionExecutor, type TradingExecutionContext } from './TestActionExecutor.js';
import { systemClock, type Clock } from './Clock.js';
import { trailingStopParamsMap, type TrailingStopParams } from '@volatil/rule-engine-trading';

/** Minimal set of facts the ContextProvider exposes to rule conditions. */
export interface TradingContextFacts {
  /** Current mid price (bid = ask for zero-spread mode) */
  currentPrice: number;
  /** R-multiple: (currentPrice - entryPrice) / (entryPrice - stopLoss). Positive = profit. */
  currentR: number;
  /** Elapsed time since position opened, in minutes */
  elapsedMinutes: number;
  /** Peak R reached during the trade lifetime */
  peakR: number;
  /** Drawdown from peak R (peakR - currentR, floored at 0) */
  drawdownFromPeakR: number;
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
export class RuleScenarioHarness {
  static readonly ACCOUNT_ID = 'test';

  readonly #broker: SimulatedPlatformPosition;
  readonly #symbol: string;
  readonly #repository: InMemoryRepository;
  readonly #executor: TestActionExecutor;
  readonly #evaluator: JsonLogicConditionEvaluator<TradingExecutionContext>;
  readonly #executionService: RuleExecutionService<TradingExecutionContext>;
  readonly #clock: Clock;

  #positionId: string | null = null;
  #pendingOrderId: string | null = null;
  #entryPrice: number | null = null;
  #initialSL: number | null = null;
  #openedAt: number | null = null;
  #peakR = 0;
  #lastBid = 0;
  #lastAsk = 0;
  #patterns: Record<string, boolean> = {};

  /** Active rule instance IDs — populated by attachRule(). */
  readonly #ruleIds: string[] = [];

  /**
   * Maps rule instance id → TrailingStopParams for rules created with
   * createTrailingStopTemplate. Populated in attachRule() via the WeakMap
   * stored in @volatil/rule-engine-trading.
   */
  readonly #trailingParams = new Map<string, TrailingStopParams>();

  /**
   * Rule instance IDs whose trailing stop activation has been met at least once.
   * Once activated, a trailing stop stays activated even if currentR drops below
   * the activation threshold (per product spec: "le trailing continue de protéger
   * les gains acquis").
   */
  readonly #activatedRuleIds = new Set<string>();

  constructor(config: HarnessConfig) {
    this.#symbol = config.symbol;
    this.#clock = config.clock ?? systemClock;

    this.#broker = new SimulatedPlatformPosition({
      symbols: [
        {
          symbol: config.symbol,
          initialPrice: { bid: 1, ask: 1 }, // overwritten on first priceTo / openPosition
        },
      ],
      initialCapital: config.balance,
      leverage: config.leverage,
      fees: { maker: 0, taker: 0 }, // zero fees for test determinism
    });

    const registry = new SinglePlatformRegistry(this.#broker, RuleScenarioHarness.ACCOUNT_ID);
    void registry; // registry is used by SimulatedPlatformControlService in external consumers

    this.#repository = new InMemoryRepository();
    this.#executor = new TestActionExecutor(this.#broker);
    this.#evaluator = new JsonLogicConditionEvaluator<TradingExecutionContext>();
    this.#executionService = new RuleExecutionService<TradingExecutionContext>(
      this.#repository,
      this.#executor,
      this.#evaluator,
      { logger: silentLogger },
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Broker control
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Open a market position on the configured symbol.
   * Sets the initial price feed to `entry` before submitting the order.
   */
  async openPosition(opts: OpenPositionOpts): Promise<void> {
    // Price must be set before submitting the order so the broker has a price.
    this.#lastBid = opts.entry;
    this.#lastAsk = opts.entry;
    this.#broker.onPriceTick({ symbol: this.#symbol, bid: opts.entry, ask: opts.entry, timestamp: this.#clock.now() });

    const result = await this.#broker.submitOrder({
      symbol: this.#symbol,
      type: 'MARKET',
      side: opts.side === 'BUY' ? 'buy' : 'sell',
      quantity: opts.volume,
    });

    if (!result.success || !result.positionId) {
      throw new Error(`openPosition failed: ${result.reason ?? 'unknown'}`);
    }

    this.#positionId = result.positionId;
    this.#entryPrice = opts.entry;
    this.#openedAt = this.#clock.now();
    this.#peakR = 0;

    if (opts.sl !== undefined) {
      const slResult = this.#broker.updatePositionStopLoss(result.positionId, opts.sl);
      if (!slResult.success) {
        throw new Error(`Could not set SL: ${slResult.reason}`);
      }
      this.#initialSL = opts.sl;
    }

    if (opts.tp !== undefined) {
      const tpResult = this.#broker.updatePositionTakeProfit(result.positionId, opts.tp);
      if (!tpResult.success) {
        throw new Error(`Could not set TP: ${tpResult.reason}`);
      }
    }
  }

  /**
   * Place a pending order (LIMIT or STOP) on the configured symbol.
   * Returns the broker order id; also stored internally so the next tick's
   * context exposes `pendingOrderId`.
   */
  async placePendingOrder(opts: PlacePendingOrderOpts): Promise<string> {
    const result = await this.#broker.submitOrder({
      symbol: this.#symbol,
      type: opts.type,
      side: opts.side === 'BUY' ? 'buy' : 'sell',
      quantity: opts.volume,
      price: opts.price,
    });
    if (!result.success || !result.orderId) {
      throw new Error(`placePendingOrder failed: ${result.reason ?? 'unknown'}`);
    }
    this.#pendingOrderId = result.orderId;
    return result.orderId;
  }

  /**
   * Attach a rule template to the open position.
   * Instantiates a RuleInstance, saves it to the repository, and registers
   * its ID so that tick() will evaluate it.
   *
   * If the template was created by createTrailingStopTemplate, the params
   * are retrieved from the WeakMap and stored for context population.
   */
  async attachRule(template: RuleTemplate, _params?: Record<string, unknown>): Promise<void> {
    const instance = RuleInstance.create(template);
    await this.#repository.save(instance);
    this.#ruleIds.push(instance.id);

    // Detect trailing stop templates via the WeakMap exported from the factory.
    const trailingParams = trailingStopParamsMap.get(template);
    if (trailingParams !== undefined) {
      this.#trailingParams.set(instance.id, trailingParams);
    }
  }

  /**
   * Drive the broker price to `price`.
   * Convention: bid = ask = price (zero spread, deterministic arithmetic).
   * Internally calls tick() after updating the price feed.
   */
  async priceTo(price: number): Promise<void> {
    this.#lastBid = price;
    this.#lastAsk = price;
    this.#broker.onPriceTick({ symbol: this.#symbol, bid: price, ask: price, timestamp: this.#clock.now() });
    await this.tick();
  }

  /**
   * Set the pattern flags exposed in the rule evaluation context.
   * Replaces (does not merge) the previous pattern map.
   */
  setPatterns(patterns: Record<string, boolean>): void {
    this.#patterns = { ...patterns };
  }

  /**
   * Evaluate all attached rules against the current broker state.
   * Each rule gets its own context so trailing stop helpers can be
   * computed per-rule using the rule's specific TrailingStopParams.
   */
  async tick(): Promise<void> {
    if (this.#ruleIds.length === 0) return;

    for (const ruleId of this.#ruleIds) {
      const ctx = this.#buildContext(ruleId);
      await this.#executionService.executeRule(ruleId, ctx);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Observation getters
  // ──────────────────────────────────────────────────────────────────────────

  /** Current SL of the open position (undefined if no position or no SL set). */
  get currentSL(): number | undefined {
    return this.#openPosition()?.stopLoss?.toNumber();
  }

  /** Current TP of the open position (undefined if no position or no TP set). */
  get currentTP(): number | undefined {
    return this.#openPosition()?.takeProfit?.toNumber();
  }

  /** All actions executed so far, in order. */
  get executedActions(): readonly ActionDefinition[] {
    return this.#executor.executedActions;
  }

  /** Current position object from the broker (undefined if no open position). */
  get positionState(): Position | undefined {
    return this.#openPosition();
  }

  /** Last { bid, ask } tick fed to the broker. */
  get lastBidAsk(): { bid: number; ask: number } {
    return { bid: this.#lastBid, ask: this.#lastAsk };
  }

  /** Currently tracked pending order id, if any. */
  get pendingOrderId(): string | null {
    return this.#pendingOrderId;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  #openPosition(): Position | undefined {
    if (!this.#positionId) return undefined;
    return this.#broker.getOpenPositions().find(p => p.id === this.#positionId);
  }

  #buildContext(ruleId?: string): TradingExecutionContext {
    const currentPrice = this.#lastBid;
    const entryPrice = this.#entryPrice ?? currentPrice;
    const initialSL = this.#initialSL;

    let currentR = 0;
    if (initialSL !== null && Math.abs(entryPrice - initialSL) > 0) {
      currentR = (currentPrice - entryPrice) / (entryPrice - initialSL);
    }
    if (currentR > this.#peakR) {
      this.#peakR = currentR;
    }

    const elapsedMs = this.#openedAt !== null ? this.#clock.now() - this.#openedAt : 0;
    const elapsedMinutes = elapsedMs / 60_000;

    const pos = this.#openPosition();
    const quantity = pos ? pos.quantity.toNumber() : 0;

    const lockInStops: Record<string, number> =
      initialSL !== null && Math.abs(entryPrice - initialSL) > 0
        ? Object.fromEntries(
            [0.5, 1, 1.5, 2, 2.5, 3, 4, 5].map(r => [
              `lockInStopPrice_${r}R`,
              entryPrice + r * (entryPrice - initialSL),
            ]),
          )
        : {};

    // ── Trailing stop helpers ─────────────────────────────────────────────────
    // Computed only when ruleId maps to a trailing-stop rule.
    // Default: trailingShouldExecute = 0, trailingNewSL = NaN (not applicable).
    let trailingNewSL = NaN;
    let trailingShouldExecute: 0 | 1 = 0;

    const trailingParams = ruleId !== undefined ? this.#trailingParams.get(ruleId) : undefined;
    if (
      trailingParams !== undefined &&
      initialSL !== null &&
      Math.abs(entryPrice - initialSL) > 0 &&
      currentR >= 0 // only trail when in profit territory (guards adverse-price artifacts)
    ) {
      // riskPerUnit is signed: positive for BUY (entry > initialSL), negative for SELL
      const riskPerUnit = entryPrice - initialSL;

      // Activation is stateful: once currentR reaches activationR, it stays active.
      // This ensures the trailing continues protecting gains even if profit dips.
      const alreadyActivated = ruleId !== undefined && this.#activatedRuleIds.has(ruleId);
      const activationMet =
        alreadyActivated ||
        trailingParams.activationR === undefined ||
        currentR >= trailingParams.activationR;

      // Persist activation state when threshold is first crossed.
      if (activationMet && !alreadyActivated && trailingParams.activationR !== undefined) {
        this.#activatedRuleIds.add(ruleId!);
      }

      // Candidate new SL: entry + (currentR - distance) * riskPerUnit
      // For BUY: trails below current price by distance*R
      // For SELL: trails above current price by distance*R (riskPerUnit is negative)
      const candidateSL = entryPrice + (currentR - trailingParams.distance) * riskPerUnit;

      // Current SL from the broker (fallback to initialSL if unset)
      const currentSL = pos?.stopLoss?.toNumber() ?? initialSL;

      // Favorable check (side-aware via sign of riskPerUnit):
      // BUY (riskPerUnit > 0): candidateSL must be ABOVE currentSL
      // SELL (riskPerUnit < 0): candidateSL must be BELOW currentSL
      const isFavorable =
        riskPerUnit > 0 ? candidateSL > currentSL : candidateSL < currentSL;

      if (activationMet && isFavorable) {
        trailingShouldExecute = 1;
        trailingNewSL = candidateSL;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    const ctx: TradingExecutionContext = {
      symbol: this.#symbol,
      quantity,
      currentPrice,
      currentR,
      elapsedMinutes,
      peakR: this.#peakR,
      drawdownFromPeakR: Math.max(0, this.#peakR - currentR),
      entryPrice,
      facts: {},
      patterns: { ...this.#patterns },
      trailingNewSL,
      trailingShouldExecute,
      ...lockInStops,
    };
    if (this.#positionId) ctx.positionId = this.#positionId;
    if (this.#pendingOrderId) ctx.pendingOrderId = this.#pendingOrderId;
    return ctx;
  }

  /** Expose the underlying broker for advanced test assertions. */
  get broker(): SimulatedPlatformPosition {
    return this.#broker;
  }
}
