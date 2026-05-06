/**
 * @file RuleScenarioHarness.ts
 * @description Integration harness that wires a SimulatedPlatformPosition broker
 * to the rule-engine infrastructure, enabling end-to-end scenario tests.
 */
import { RuleInstance, RuleExecutionService, JsonLogicConditionEvaluator, InMemoryRepository, silentLogger, } from 'rule-engine-monorepo/rule-engine';
import { SimulatedPlatformPosition, SinglePlatformRegistry, } from '@volatil/simulated-platform';
import { TestActionExecutor } from './TestActionExecutor.js';
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
    static ACCOUNT_ID = 'test';
    #broker;
    #symbol;
    #repository;
    #executor;
    #evaluator;
    #executionService;
    #positionId = null;
    #entryPrice = null;
    #initialSL = null;
    #openedAt = null;
    #peakR = 0;
    #lastBid = 0;
    #lastAsk = 0;
    /** Active rule instance IDs — populated by attachRule(). */
    #ruleIds = [];
    constructor(config) {
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
        this.#evaluator = new JsonLogicConditionEvaluator();
        this.#executionService = new RuleExecutionService(this.#repository, this.#executor, this.#evaluator, { logger: silentLogger });
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Broker control
    // ──────────────────────────────────────────────────────────────────────────
    /**
     * Open a market position on the configured symbol.
     * Sets the initial price feed to `entry` before submitting the order.
     */
    async openPosition(opts) {
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
    async attachRule(template, _params) {
        const instance = RuleInstance.create(template);
        await this.#repository.save(instance);
        this.#ruleIds.push(instance.id);
    }
    /**
     * Drive the broker price to `price`.
     * Convention: bid = ask = price (zero spread, deterministic arithmetic).
     * Internally calls tick() after updating the price feed.
     */
    async priceTo(price) {
        this.#lastBid = price;
        this.#lastAsk = price;
        this.#broker.onPriceTick({ symbol: this.#symbol, bid: price, ask: price, timestamp: Date.now() });
        await this.tick();
    }
    /**
     * Evaluate all attached rules against the current broker state.
     * Call this manually if you drive the price feed without using priceTo().
     */
    async tick() {
        if (this.#ruleIds.length === 0)
            return;
        const ctx = this.#buildContext();
        for (const ruleId of this.#ruleIds) {
            await this.#executionService.executeRule(ruleId, ctx);
        }
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Observation getters
    // ──────────────────────────────────────────────────────────────────────────
    /** Current SL of the open position (undefined if no position or no SL set). */
    get currentSL() {
        return this.#openPosition()?.stopLoss?.toNumber();
    }
    /** Current TP of the open position (undefined if no position or no TP set). */
    get currentTP() {
        return this.#openPosition()?.takeProfit?.toNumber();
    }
    /** All actions executed so far, in order. */
    get executedActions() {
        return this.#executor.executedActions;
    }
    /** Current position object from the broker (undefined if no open position). */
    get positionState() {
        return this.#openPosition();
    }
    /** Last { bid, ask } tick fed to the broker. */
    get lastBidAsk() {
        return { bid: this.#lastBid, ask: this.#lastAsk };
    }
    // ──────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ──────────────────────────────────────────────────────────────────────────
    #openPosition() {
        if (!this.#positionId)
            return undefined;
        return this.#broker.getOpenPositions().find(p => p.id === this.#positionId);
    }
    #buildContext() {
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
    get broker() {
        return this.#broker;
    }
}
//# sourceMappingURL=RuleScenarioHarness.js.map