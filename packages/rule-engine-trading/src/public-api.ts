// Domain
export { ActionType, ConditionReference, TriggerType } from './domain/TradingEnums.js';

// Templates
export { createMoveSLToBreakevenTemplate, type MoveSLToBreakevenTemplateParams } from './templates/moveSLToBreakeven.js';
export { createTakeProfitTemplate, type TakeProfitTemplateParams } from './templates/takeProfit.js';
export {
  createTakePartialTemplate,
  TAKE_PARTIAL_1R_50PCT,
  TAKE_PARTIAL_1R_33PCT,
  TAKE_PARTIAL_2R_50PCT,
  TAKE_PARTIAL_1R_25PCT,
  TAKE_PARTIAL_2R_25PCT,
  type TakePartialTemplateParams,
} from './templates/takePartial.js';
export {
  TRAILING_STOP_TEMPLATE,
  SL_BREAKEVEN_TEMPLATE,
  TP_TEMPLATE,
  LOCK_IN_PROFIT_STOP_TEMPLATE,
  FREE_TRADE_TEMPLATE,
  TIME_BASED_STOP_TEMPLATE,
  MAX_DRAWDOWN_FROM_PEAK_TEMPLATE,
  PATTERN_BASED_EXIT_TEMPLATE,
  CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE,
  PARTIAL_CLOSE_AT_PRICE_TEMPLATE,
  templateDefinitions,
  type TemplateDefinition,
  type TemplateCategory,
  type TemplateMaturity,
} from './templates/predefinedTemplates.js';
export {
  createTrailingStopTemplate,
  /** @internal Used by testkit harness to retrieve TrailingStopParams from a RuleTemplate. */
  trailingStopParamsMap,
  type TrailingStopParams,
} from './templates/trailingStop.js';
export {
  createPartialCloseAtPriceTemplate,
  type PartialCloseAtPriceTemplateParams,
} from './templates/partialCloseAtPrice.js';
export {
  createTimeBasedStopTemplate,
  TIME_STOP_30MIN_1R,
  TIME_STOP_15MIN_05R,
  TIME_STOP_60MIN_2R,
  type TimeBasedStopTemplateParams,
} from './templates/timeBasedStop.js';
export {
  createFreeTradeTemplate,
  FREE_TRADE_2R,
  FREE_TRADE_3R,
  FREE_TRADE_1_5R,
  FREE_TRADE_4R,
  type FreeTradeTemplateParams,
} from './templates/freeTrade.js';
export {
  createLockInProfitStopTemplate,
  createLockInProfitStopTemplateWithExplicitPrice,
  LOCK_IN_3R_TO_1R,
  LOCK_IN_2R_TO_05R,
  LOCK_IN_4R_TO_2R,
  LOCK_IN_5R_TO_3R,
  type LockInProfitStopTemplateParams,
} from './templates/lockInProfitStop.js';
export {
  createMaxDrawdownFromPeakTemplate,
  MAX_DD_4R_PEAK_25R_DD,
  MAX_DD_3R_PEAK_15R_DD,
  MAX_DD_2R_PEAK_1R_DD,
  MAX_DD_5R_PEAK_2R_DD_MIN_1R,
  type MaxDrawdownFromPeakTemplateParams,
} from './templates/maxDrawdownFromPeak.js';
export {
  createPatternBasedExitTemplate,
  PATTERN_EXIT_LONG_BEARISH,
  PATTERN_EXIT_SHORT_BULLISH,
  PATTERN_EXIT_LONG_ENGULFING,
  PATTERN_EXIT_SHORT_ENGULFING,
  PATTERN_EXIT_LONG_BEARISH_PROFITABLE,
  PATTERN_EXIT_LONG_BEARISH_PARTIAL,
  PATTERN_RULE_TRIGGER_TYPE,
  type PatternBasedExitTemplateParams,
  type PositionDirection,
} from './templates/patternBasedExit.js';
export {
  createCancelPendingOnPriceLevelTemplate,
  type CancelPendingOnPriceLevelTemplateParams,
} from './templates/cancelPendingOnPriceLevel.js';

// Actions
export { createMoveStopLossAction, type MoveStopLossParams } from './actions/moveStopLoss.js';
export { createPlaceOrderAction, createClosePositionAction, type PlaceOrderParams } from './actions/placeOrder.js';
export { createCancelPositionAction } from './actions/cancelPosition.js';
export {
  createPartialCloseByQuantity,
  createPartialCloseByPercentage,
  createPartialCloseDynamic,
  PARTIAL_CLOSE_50_PERCENT,
  PARTIAL_CLOSE_25_PERCENT,
  PARTIAL_CLOSE_33_PERCENT,
  type PartialCloseByQuantityParams,
  type PartialCloseByPercentageParams,
} from './actions/partialClose.js';

// Conditions
export {
  createProfitThresholdCondition,
  createProfitBelowCondition,
  createNotExecutedCondition,
  createExecutedCondition,
  createAndCondition,
  createOrCondition,
  createHistoricalCondition,
  createPriceBelowCondition,
  createPriceAboveCondition,
  createTimeElapsedCondition,
  createPeakRReachedCondition,
  createDrawdownFromPeakCondition,
  createPatternDetectedCondition,
  createBearishPatternCondition,
  createBullishPatternCondition,
} from './conditions/tradingConditions.js';

// Predefined instances
export { ACTIONS, CONDITIONS, TEMPLATES } from './registry/instances.js';

// Registry
export { tradingRuleRegistry } from './registry/registry.js';

// Schemas
export {
  TRADING_CONTEXT_FIELDS,
  moveStopLossSchema,
  placeOrderSchema,
  partialCloseSchema,
  scaleOutSchema,
  startTrailingStopSchema,
  cancelPositionSchema,
  tradingActionSchemas,
} from './schemas/actionSchemas.js';

export {
  profitRatioSchema,
  positionSizeSchema,
  volumeSchema,
  maxDrawdownSchema,
  barsSinceEntrySchema,
  stopLossTriggeredSchema,
  isTrailingSchema,
  slMovedSchema,
  partialSlDoneSchema,
  priceLevelSchema,
  tradingConditionSchemas,
} from './schemas/conditionSchemas.js';

export { createTradingSchemaRegistry } from './schemas/tradingSchemaRegistry.js';
