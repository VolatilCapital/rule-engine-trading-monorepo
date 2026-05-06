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
}

export interface OpenPositionOpts {
  side: 'BUY' | 'SELL';
  volume: number;
  entry: number;
  sl?: number;
  tp?: number;
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

  #positionId: string | null = null;
  #entryPrice: number | null = null;
  #initialSL: number | null = null;
  #openedAt: number | null = null;
  #peakR = 0;
  #lastBid = 0;
  #lastAsk = 0;

  /** Active rule instance IDs — populated by attachRule(). */
  readonly #ruleIds: string[] = [];

  constructor(config: HarnessConfig) {
    this.#symbol = config.symbol;

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
    this.#broker.onPriceTick({ symbol: this.#symbol, bid: opts.entry, ask: opts.entry, timestamp: Date.now() });

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
    this.#openedAt = Date.now();
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
   * Attach a rule template to the open position.
   * Instantiates a RuleInstance, saves it to the repository, and registers
   * its ID so that tick() will evaluate it.
   */
  async attachRule(template: RuleTemplate, _params?: Record<string, unknown>): Promise<void> {
    const instance = RuleInstance.create(template);
    await this.#repository.save(instance);
    this.#ruleIds.push(instance.id);
  }

  /**
   * Drive the broker price to `price`.
   * Convention: bid = ask = price (zero spread, deterministic arithmetic).
   * Internally calls tick() after updating the price feed.
   */
  async priceTo(price: number): Promise<void> {
    this.#lastBid = price;
    this.#lastAsk = price;
    this.#broker.onPriceTick({ symbol: this.#symbol, bid: price, ask: price, timestamp: Date.now() });
    await this.tick();
  }

  /**
   * Evaluate all attached rules against the current broker state.
   * Call this manually if you drive the price feed without using priceTo().
   */
  async tick(): Promise<void> {
    if (this.#ruleIds.length === 0) return;

    const ctx = this.#buildContext();
    for (const ruleId of this.#ruleIds) {
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

  // ──────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ──────────────────────────────────────────────────────────────────────────

  #openPosition(): Position | undefined {
    if (!this.#positionId) return undefined;
    return this.#broker.getOpenPositions().find(p => p.id === this.#positionId);
  }

  #buildContext(): TradingExecutionContext {
    if (!this.#positionId) {
      throw new Error('No open position — call openPosition() first');
    }

    const currentPrice = this.#lastBid; // zero-spread: bid = ask = price
    const entryPrice = this.#entryPrice ?? currentPrice;
    const initialSL = this.#initialSL;

    // R = (currentPrice - entry) / (entry - SL). Only valid for BUY; invert for SELL.
    let currentR = 0;
    if (initialSL !== null && Math.abs(entryPrice - initialSL) > 0) {
      currentR = (currentPrice - entryPrice) / (entryPrice - initialSL);
    }

    // Track peak R over the life of the trade
    if (currentR > this.#peakR) {
      this.#peakR = currentR;
    }

    const elapsedMs = this.#openedAt !== null ? Date.now() - this.#openedAt : 0;
    const elapsedMinutes = elapsedMs / 60_000;

    const pos = this.#openPosition();
    const quantity = pos ? pos.quantity.toNumber() : 0;

    return {
      positionId: this.#positionId,
      symbol: this.#symbol,
      quantity,
      currentPrice,
      currentR,
      elapsedMinutes,
      peakR: this.#peakR,
      drawdownFromPeakR: Math.max(0, this.#peakR - currentR),
      facts: {},
      patterns: {},
    };
  }

  /** Expose the underlying broker for advanced test assertions. */
  get broker(): SimulatedPlatformPosition {
    return this.#broker;
  }
}
