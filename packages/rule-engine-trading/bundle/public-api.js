// dist/domain/TradingEnums.js
var ActionType;
(function(ActionType2) {
  ActionType2["MOVE_STOP_LOSS"] = "MOVE_STOP_LOSS";
  ActionType2["PLACE_ORDER"] = "PLACE_ORDER";
  ActionType2["PARTIAL_CLOSE"] = "PARTIAL_CLOSE";
  ActionType2["SCALE_OUT"] = "SCALE_OUT";
  ActionType2["START_TRAILING_STOP"] = "START_TRAILING_STOP";
  ActionType2["CANCEL_POSITION"] = "CANCEL_POSITION";
})(ActionType || (ActionType = {}));
var TriggerType;
(function(TriggerType2) {
  TriggerType2["PRICE"] = "PRICE";
  TriggerType2["CANDLE_CLOSE"] = "CANDLE_CLOSE";
  TriggerType2["EVENT"] = "EVENT";
})(TriggerType || (TriggerType = {}));
var ConditionReference;
(function(ConditionReference2) {
  ConditionReference2["PROFIT_RATIO_GREATER_EQUAL"] = "PROFIT_RATIO_GREATER_EQUAL";
  ConditionReference2["POSITION_SIZE_GREATER_THAN"] = "POSITION_SIZE_GREATER_THAN";
  ConditionReference2["VOLUME_GREATER_THAN"] = "VOLUME_GREATER_THAN";
  ConditionReference2["MAX_DRAWDOWN_LESS_THAN"] = "MAX_DRAWDOWN_LESS_THAN";
  ConditionReference2["BARS_SINCE_ENTRY_GREATER_THAN"] = "BARS_SINCE_ENTRY_GREATER_THAN";
  ConditionReference2["STOP_LOSS_TRIGGERED_EQUAL"] = "STOP_LOSS_TRIGGERED_EQUAL";
  ConditionReference2["IS_TRAILING_NOT_EQUAL"] = "IS_TRAILING_NOT_EQUAL";
  ConditionReference2["SL_MOVED_EQUAL_TRUE"] = "SL_MOVED_EQUAL_TRUE";
  ConditionReference2["PARTIAL_SL_DONE_NOT_EQUAL_TRUE"] = "PARTIAL_SL_DONE_NOT_EQUAL_TRUE";
  ConditionReference2["PRICE_LEVEL_REACHED"] = "PRICE_LEVEL_REACHED";
})(ConditionReference || (ConditionReference = {}));

// dist/domain/Measurement.js
var PROFIT_FIELD = {
  R: "currentR",
  percent: "currentPctFromEntry",
  price: "currentPriceMove"
};
var PEAK_FIELD = {
  R: "peakR",
  percent: "peakPctFromEntry",
  price: "peakPriceMove"
};
var DRAWDOWN_FROM_PEAK_FIELD = {
  R: "drawdownFromPeakR",
  percent: "drawdownFromPeakPct",
  price: "drawdownFromPeakPrice"
};
var ALLOWED_UNITS = ["R", "percent", "price"];
function assertMeasurement(name, m, opts = {}) {
  if (m === null || typeof m !== "object") {
    throw new Error(`${name} must be a Measurement object { value, unit }`);
  }
  const candidate = m;
  if (typeof candidate.value !== "number" || !Number.isFinite(candidate.value)) {
    throw new Error(`${name}.value must be a finite number`);
  }
  if (typeof candidate.unit !== "string" || !ALLOWED_UNITS.includes(candidate.unit)) {
    throw new Error(`${name}.unit must be one of R | percent | price`);
  }
  if (opts.allowZero === true) {
    if (candidate.value < 0) {
      throw new Error(`${name}.value must be >= 0 (got ${candidate.value})`);
    }
  } else if (candidate.value <= 0) {
    throw new Error(`${name}.value must be > 0 (got ${candidate.value})`);
  }
}

// dist/templates/moveSLToBreakeven.js
import { RuleTemplate } from "rule-engine-monorepo/rule-engine";

// dist/actions/moveStopLoss.js
function createMoveStopLossAction(params) {
  return {
    actionRef: ActionType.MOVE_STOP_LOSS,
    parameters: params
  };
}

// dist/conditions/tradingConditions.js
import { AtomicCondition, Operator, LogicalCondition, LogicalOperator, MemorizableCondition } from "rule-engine-monorepo/rule-engine";
function createProfitThresholdCondition(threshold) {
  assertMeasurement("threshold", threshold);
  const field = PROFIT_FIELD[threshold.unit];
  return AtomicCondition.create(field, Operator.GREATER_EQUAL, threshold.value, `${field}_check`);
}
function createProfitBelowCondition(threshold) {
  assertMeasurement("threshold", threshold);
  const field = PROFIT_FIELD[threshold.unit];
  return AtomicCondition.create(field, Operator.LESS_THAN, threshold.value, `${field}_below_check`);
}
function createNotExecutedCondition(factKey) {
  return AtomicCondition.create(`facts.${factKey}`, Operator.NOT_EQUAL, true, `${factKey}_not_executed_check`);
}
function createExecutedCondition(factKey) {
  return AtomicCondition.create(`facts.${factKey}`, Operator.EQUAL, true, `${factKey}_executed_check`);
}
function createAndCondition(conditions, conditionRef) {
  return LogicalCondition.create(LogicalOperator.AND, conditions, conditionRef);
}
function createOrCondition(conditions, conditionRef) {
  return LogicalCondition.create(LogicalOperator.OR, conditions, conditionRef);
}
function createHistoricalCondition(factKey) {
  return MemorizableCondition.create(factKey, createExecutedCondition(factKey));
}
function createPriceBelowCondition(price) {
  return AtomicCondition.create("currentPrice", Operator.LESS_EQUAL, price, "price_below_check");
}
function createPriceAboveCondition(price) {
  return AtomicCondition.create("currentPrice", Operator.GREATER_EQUAL, price, "price_above_check");
}
function createTimeElapsedCondition(minutes) {
  return AtomicCondition.create("elapsedMinutes", Operator.GREATER_EQUAL, minutes, "time_elapsed_check");
}
function createPeakRReachedCondition(thresholdR) {
  return AtomicCondition.create("peakR", Operator.GREATER_EQUAL, thresholdR, "peakR_reached_check");
}
function createDrawdownFromPeakCondition(drawdownR) {
  return AtomicCondition.create("drawdownFromPeakR", Operator.GREATER_EQUAL, drawdownR, "drawdown_from_peak_check");
}
function createPatternDetectedCondition(patternName) {
  return AtomicCondition.create(`patterns.${patternName}`, Operator.EQUAL, true, `pattern_${patternName}_check`);
}
function createBearishPatternCondition() {
  return AtomicCondition.create("patterns.bearish", Operator.EQUAL, true, "bearish_pattern_check");
}
function createBullishPatternCondition() {
  return AtomicCondition.create("patterns.bullish", Operator.EQUAL, true, "bullish_pattern_check");
}

// dist/templates/moveSLToBreakeven.js
function createMoveSLToBreakevenTemplate(params) {
  const { threshold } = params;
  assertMeasurement("threshold", threshold);
  const actions = [
    createMoveStopLossAction({
      newStopPrice: { "var": "entryPrice" }
    })
  ];
  const historicalConditions = [
    createHistoricalCondition("sl_moved_to_breakeven")
  ];
  const condition = createAndCondition([
    createProfitThresholdCondition(threshold),
    createNotExecutedCondition("sl_moved_to_breakeven")
  ], "main_condition");
  return RuleTemplate.create(condition, actions, historicalConditions);
}

// dist/templates/takeProfit.js
import { RuleTemplate as RuleTemplate2 } from "rule-engine-monorepo/rule-engine";

// dist/actions/placeOrder.js
function createPlaceOrderAction(params) {
  return {
    actionRef: ActionType.PLACE_ORDER,
    parameters: params
  };
}
function createClosePositionAction() {
  return createPlaceOrderAction({
    type: "close_position"
  });
}

// dist/templates/takeProfit.js
function createTakeProfitTemplate(params) {
  const { threshold } = params;
  assertMeasurement("threshold", threshold);
  const actions = [
    createClosePositionAction()
  ];
  const historicalConditions = [
    createHistoricalCondition("position_closed_for_profit")
  ];
  const condition = createAndCondition([
    createProfitThresholdCondition(threshold),
    createNotExecutedCondition("position_closed_for_profit")
  ], "main_condition");
  return RuleTemplate2.create(condition, actions, historicalConditions);
}

// dist/templates/takePartial.js
import { RuleTemplate as RuleTemplate3 } from "rule-engine-monorepo/rule-engine";

// dist/actions/partialClose.js
function createPartialCloseByQuantity(params) {
  if (params.quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }
  return {
    actionRef: ActionType.PARTIAL_CLOSE,
    parameters: {
      quantity: params.quantity
    }
  };
}
function createPartialCloseByPercentage(params) {
  if (params.percentage <= 0 || params.percentage > 100) {
    throw new Error("Percentage must be between 0 and 100");
  }
  return {
    actionRef: ActionType.PARTIAL_CLOSE,
    parameters: {
      percentage: params.percentage
    }
  };
}
function createPartialCloseDynamic(params) {
  if (!params.quantity && !params.percentage) {
    throw new Error("Either quantity or percentage must be specified");
  }
  return {
    actionRef: ActionType.PARTIAL_CLOSE,
    parameters: params.quantity ? { quantity: params.quantity } : { percentage: params.percentage }
  };
}
var PARTIAL_CLOSE_50_PERCENT = createPartialCloseByPercentage({ percentage: 50 });
var PARTIAL_CLOSE_25_PERCENT = createPartialCloseByPercentage({ percentage: 25 });
var PARTIAL_CLOSE_33_PERCENT = createPartialCloseByPercentage({ percentage: 33.33 });

// dist/templates/takePartial.js
var PARTIAL_CLOSE_FACT_PREFIX = "partial_close_done";
function createTakePartialTemplate(params) {
  const { threshold, closePercentage, partialId } = params;
  assertMeasurement("threshold", threshold);
  if (closePercentage <= 0 || closePercentage > 100) {
    throw new Error("closePercentage must be between 0 and 100");
  }
  const factKey = partialId ? `${PARTIAL_CLOSE_FACT_PREFIX}_${partialId}` : `${PARTIAL_CLOSE_FACT_PREFIX}_${threshold.value}${threshold.unit}`;
  const mainCondition = createAndCondition([createProfitThresholdCondition(threshold), createNotExecutedCondition(factKey)], "main_condition");
  const action = createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate3.create(mainCondition, [action], [historicalCondition]);
}
var TAKE_PARTIAL_1R_50PCT = createTakePartialTemplate({
  threshold: { value: 1, unit: "R" },
  closePercentage: 50,
  partialId: "1R_50pct"
});
var TAKE_PARTIAL_1R_33PCT = createTakePartialTemplate({
  threshold: { value: 1, unit: "R" },
  closePercentage: 33.33,
  partialId: "1R_33pct"
});
var TAKE_PARTIAL_2R_50PCT = createTakePartialTemplate({
  threshold: { value: 2, unit: "R" },
  closePercentage: 50,
  partialId: "2R_50pct"
});
var TAKE_PARTIAL_1R_25PCT = createTakePartialTemplate({
  threshold: { value: 1, unit: "R" },
  closePercentage: 25,
  partialId: "1R_25pct"
});
var TAKE_PARTIAL_2R_25PCT = createTakePartialTemplate({
  threshold: { value: 2, unit: "R" },
  closePercentage: 25,
  partialId: "2R_25pct"
});

// dist/templates/timeBasedStop.js
import { RuleTemplate as RuleTemplate4, AtomicCondition as AtomicCondition2, Operator as Operator2 } from "rule-engine-monorepo/rule-engine";
var TIME_STOP_FACT_PREFIX = "time_based_stop_executed";
function createTimeBasedStopTemplate(params) {
  const { maxMinutes, minProfitR, closePercentage = 100, ruleId } = params;
  if (maxMinutes <= 0) {
    throw new Error("maxMinutes must be greater than 0");
  }
  if (closePercentage <= 0 || closePercentage > 100) {
    throw new Error("closePercentage must be between 0 and 100");
  }
  const factKey = ruleId ? `${TIME_STOP_FACT_PREFIX}_${ruleId}` : `${TIME_STOP_FACT_PREFIX}_${maxMinutes}min_${minProfitR}R`;
  const timeCondition = AtomicCondition2.create("elapsedMinutes", Operator2.GREATER_EQUAL, maxMinutes, "time_elapsed_check");
  const profitNotReachedCondition = AtomicCondition2.create("currentR", Operator2.LESS_THAN, minProfitR, ConditionReference.PROFIT_RATIO_GREATER_EQUAL);
  const mainCondition = createAndCondition([timeCondition, profitNotReachedCondition, createNotExecutedCondition(factKey)], "time_based_stop_condition");
  const action = closePercentage === 100 ? createClosePositionAction() : createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate4.create(mainCondition, [action], [historicalCondition]);
}
var TIME_STOP_30MIN_1R = createTimeBasedStopTemplate({
  maxMinutes: 30,
  minProfitR: 1,
  ruleId: "30min_1R"
});
var TIME_STOP_15MIN_05R = createTimeBasedStopTemplate({
  maxMinutes: 15,
  minProfitR: 0.5,
  ruleId: "15min_05R"
});
var TIME_STOP_60MIN_2R = createTimeBasedStopTemplate({
  maxMinutes: 60,
  minProfitR: 2,
  ruleId: "60min_2R"
});

// dist/templates/freeTrade.js
import { RuleTemplate as RuleTemplate5 } from "rule-engine-monorepo/rule-engine";
var FREE_TRADE_FACT_PREFIX = "free_trade_executed";
function createFreeTradeTemplate(params) {
  const { trigger, recover, ruleId } = params;
  assertMeasurement("trigger", trigger);
  assertMeasurement("recover", recover);
  if (trigger.unit !== recover.unit) {
    throw new Error(`trigger and recover must share unit (got trigger=${trigger.unit}, recover=${recover.unit})`);
  }
  if (trigger.value < recover.value) {
    throw new Error(`trigger.value (${trigger.value}) must be >= recover.value (${recover.value})`);
  }
  const closePercentage = recover.value / trigger.value * 100;
  const factKey = ruleId ? `${FREE_TRADE_FACT_PREFIX}_${ruleId}` : `${FREE_TRADE_FACT_PREFIX}_${trigger.value}${trigger.unit}`;
  const mainCondition = createAndCondition([createProfitThresholdCondition(trigger), createNotExecutedCondition(factKey)], "free_trade_condition");
  const action = createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate5.create(mainCondition, [action], [historicalCondition]);
}
var FREE_TRADE_2R = createFreeTradeTemplate({
  trigger: { value: 2, unit: "R" },
  recover: { value: 1, unit: "R" },
  ruleId: "2R"
});
var FREE_TRADE_3R = createFreeTradeTemplate({
  trigger: { value: 3, unit: "R" },
  recover: { value: 1, unit: "R" },
  ruleId: "3R"
});
var FREE_TRADE_1_5R = createFreeTradeTemplate({
  trigger: { value: 1.5, unit: "R" },
  recover: { value: 1, unit: "R" },
  ruleId: "1_5R"
});
var FREE_TRADE_4R = createFreeTradeTemplate({
  trigger: { value: 4, unit: "R" },
  recover: { value: 1, unit: "R" },
  ruleId: "4R"
});

// dist/templates/lockInProfitStop.js
import { RuleTemplate as RuleTemplate6 } from "rule-engine-monorepo/rule-engine";
var LOCK_IN_STOP_FACT_PREFIX = "lock_in_profit_stop_executed";
var lockInProfitStopParamsMap = /* @__PURE__ */ new WeakMap();
var UNIT_SUFFIX = {
  R: "R",
  percent: "pct",
  price: "price"
};
function lockInStopPriceKey(lockIn) {
  const valuePart = String(lockIn.value).replace(/\./g, "_");
  return `lockInStopPrice_${valuePart}${UNIT_SUFFIX[lockIn.unit]}`;
}
function createLockInProfitStopTemplate(params) {
  const { trigger, lockIn, ruleId } = params;
  assertMeasurement("trigger", trigger);
  assertMeasurement("lockIn", lockIn, { allowZero: true });
  if (trigger.unit !== lockIn.unit) {
    throw new Error(`trigger and lockIn must share unit (got trigger=${trigger.unit}, lockIn=${lockIn.unit})`);
  }
  if (lockIn.value >= trigger.value) {
    throw new Error(`lockIn.value (${lockIn.value}) must be < trigger.value (${trigger.value})`);
  }
  const factKey = ruleId ? `${LOCK_IN_STOP_FACT_PREFIX}_${ruleId}` : `${LOCK_IN_STOP_FACT_PREFIX}_${trigger.value}${trigger.unit}_to_${lockIn.value}${lockIn.unit}`;
  const profitCondition = createProfitThresholdCondition(trigger);
  const mainCondition = createAndCondition([profitCondition, createNotExecutedCondition(factKey)], "lock_in_profit_stop_condition");
  const action = createMoveStopLossAction({
    newStopPrice: { "var": lockInStopPriceKey(lockIn) }
  });
  const historicalCondition = createHistoricalCondition(factKey);
  const template = RuleTemplate6.create(mainCondition, [action], [historicalCondition]);
  lockInProfitStopParamsMap.set(template, { trigger, lockIn, ruleId });
  return template;
}
var LOCK_IN_3R_TO_1R = createLockInProfitStopTemplate({
  trigger: { value: 3, unit: "R" },
  lockIn: { value: 1, unit: "R" },
  ruleId: "3R_to_1R"
});
var LOCK_IN_2R_TO_05R = createLockInProfitStopTemplate({
  trigger: { value: 2, unit: "R" },
  lockIn: { value: 0.5, unit: "R" },
  ruleId: "2R_to_05R"
});
var LOCK_IN_4R_TO_2R = createLockInProfitStopTemplate({
  trigger: { value: 4, unit: "R" },
  lockIn: { value: 2, unit: "R" },
  ruleId: "4R_to_2R"
});
var LOCK_IN_5R_TO_3R = createLockInProfitStopTemplate({
  trigger: { value: 5, unit: "R" },
  lockIn: { value: 3, unit: "R" },
  ruleId: "5R_to_3R"
});

// dist/templates/maxDrawdownFromPeak.js
import { RuleTemplate as RuleTemplate7, AtomicCondition as AtomicCondition3, Operator as Operator3 } from "rule-engine-monorepo/rule-engine";
var MAX_DRAWDOWN_FACT_PREFIX = "max_drawdown_from_peak_executed";
function createMaxDrawdownFromPeakTemplate(params) {
  const { minPeakR, maxDrawdownR, minCurrentR, closePercentage = 100, ruleId } = params;
  if (minPeakR <= 0) {
    throw new Error("minPeakR must be greater than 0");
  }
  if (maxDrawdownR <= 0) {
    throw new Error("maxDrawdownR must be greater than 0");
  }
  if (closePercentage <= 0 || closePercentage > 100) {
    throw new Error("closePercentage must be between 0 and 100");
  }
  const factKey = ruleId ? `${MAX_DRAWDOWN_FACT_PREFIX}_${ruleId}` : `${MAX_DRAWDOWN_FACT_PREFIX}_peak${minPeakR}R_dd${maxDrawdownR}R`;
  const conditions = [];
  conditions.push(AtomicCondition3.create("peakR", Operator3.GREATER_EQUAL, minPeakR, "peak_r_check"));
  conditions.push(AtomicCondition3.create("drawdownFromPeakR", Operator3.GREATER_EQUAL, maxDrawdownR, "drawdown_from_peak_check"));
  if (minCurrentR !== void 0) {
    conditions.push(AtomicCondition3.create("currentR", Operator3.GREATER_EQUAL, minCurrentR, "min_current_r_check"));
  }
  const mainCondition = createAndCondition([...conditions, createNotExecutedCondition(factKey)], "max_drawdown_from_peak_condition");
  const action = closePercentage === 100 ? createClosePositionAction() : createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate7.create(mainCondition, [action], [historicalCondition]);
}
var MAX_DD_4R_PEAK_25R_DD = createMaxDrawdownFromPeakTemplate({
  minPeakR: 4,
  maxDrawdownR: 2.5,
  ruleId: "4R_peak_25R_dd"
});
var MAX_DD_3R_PEAK_15R_DD = createMaxDrawdownFromPeakTemplate({
  minPeakR: 3,
  maxDrawdownR: 1.5,
  ruleId: "3R_peak_15R_dd"
});
var MAX_DD_2R_PEAK_1R_DD = createMaxDrawdownFromPeakTemplate({
  minPeakR: 2,
  maxDrawdownR: 1,
  ruleId: "2R_peak_1R_dd"
});
var MAX_DD_5R_PEAK_2R_DD_MIN_1R = createMaxDrawdownFromPeakTemplate({
  minPeakR: 5,
  maxDrawdownR: 2,
  minCurrentR: 1,
  ruleId: "5R_peak_2R_dd_min1R"
});

// dist/templates/patternBasedExit.js
import { RuleTemplate as RuleTemplate8, AtomicCondition as AtomicCondition4, LogicalCondition as LogicalCondition2, LogicalOperator as LogicalOperator2, Operator as Operator4 } from "rule-engine-monorepo/rule-engine";
var PATTERN_EXIT_FACT_PREFIX = "pattern_based_exit_executed";
function createPatternBasedExitTemplate(params) {
  const { positionDirection, patternNames, minProfit, closePercentage = 100, timeframe, ruleId } = params;
  if (closePercentage <= 0 || closePercentage > 100) {
    throw new Error("closePercentage must be between 0 and 100");
  }
  if (minProfit !== void 0) {
    assertMeasurement("minProfit", minProfit);
  }
  const triggerDirection = positionDirection === "long" ? "bearish" : "bullish";
  const patternSuffix = patternNames?.join("_") ?? triggerDirection;
  const tfSuffix = timeframe ? `_${timeframe}` : "";
  const factKey = ruleId ? `${PATTERN_EXIT_FACT_PREFIX}_${ruleId}` : `${PATTERN_EXIT_FACT_PREFIX}_${positionDirection}_${patternSuffix}${tfSuffix}`;
  const conditions = [];
  if (patternNames && patternNames.length > 0) {
    if (patternNames.length === 1) {
      conditions.push(AtomicCondition4.create(`patterns.${patternNames[0]}`, Operator4.EQUAL, true, `pattern_${patternNames[0]}_check`));
    } else {
      const patternConditions = patternNames.map((name) => AtomicCondition4.create(`patterns.${name}`, Operator4.EQUAL, true, `pattern_${name}_check`));
      conditions.push(LogicalCondition2.create(LogicalOperator2.OR, patternConditions, "pattern_or_check"));
    }
  } else {
    conditions.push(AtomicCondition4.create(`patterns.${triggerDirection}`, Operator4.EQUAL, true, `${triggerDirection}_pattern_check`));
  }
  if (minProfit !== void 0) {
    conditions.push(createProfitThresholdCondition(minProfit));
  }
  const mainCondition = createAndCondition([...conditions, createNotExecutedCondition(factKey)], "pattern_based_exit_condition");
  const action = closePercentage === 100 ? createClosePositionAction() : createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate8.create(mainCondition, [action], [historicalCondition]);
}
var PATTERN_EXIT_LONG_BEARISH = createPatternBasedExitTemplate({
  positionDirection: "long",
  ruleId: "long_bearish"
});
var PATTERN_EXIT_SHORT_BULLISH = createPatternBasedExitTemplate({
  positionDirection: "short",
  ruleId: "short_bullish"
});
var PATTERN_EXIT_LONG_ENGULFING = createPatternBasedExitTemplate({
  positionDirection: "long",
  patternNames: ["engulfing_bearish"],
  ruleId: "long_engulfing"
});
var PATTERN_EXIT_SHORT_ENGULFING = createPatternBasedExitTemplate({
  positionDirection: "short",
  patternNames: ["engulfing_bullish"],
  ruleId: "short_engulfing"
});
var PATTERN_EXIT_LONG_BEARISH_PROFITABLE = createPatternBasedExitTemplate({
  positionDirection: "long",
  minProfit: { value: 0.5, unit: "R" },
  ruleId: "long_bearish_profitable"
});
var PATTERN_EXIT_LONG_BEARISH_PARTIAL = createPatternBasedExitTemplate({
  positionDirection: "long",
  closePercentage: 50,
  ruleId: "long_bearish_partial"
});
var PATTERN_RULE_TRIGGER_TYPE = TriggerType.CANDLE_CLOSE;

// dist/templates/cancelPendingOnPriceLevel.js
import { RuleTemplate as RuleTemplate9 } from "rule-engine-monorepo/rule-engine";

// dist/actions/cancelPosition.js
function createCancelPositionAction() {
  return {
    actionRef: ActionType.CANCEL_POSITION,
    parameters: {}
  };
}

// dist/templates/cancelPendingOnPriceLevel.js
function createCancelPendingOnPriceLevelTemplate(params) {
  const { invalidationPrice, direction } = params;
  if (direction !== "below" && direction !== "above") {
    throw new Error(`Invalid direction: ${direction}. Must be 'below' or 'above'.`);
  }
  if (invalidationPrice <= 0) {
    throw new Error(`Invalid invalidationPrice: ${invalidationPrice}. Must be a positive number.`);
  }
  const priceCondition = direction === "below" ? createPriceBelowCondition(invalidationPrice) : createPriceAboveCondition(invalidationPrice);
  const condition = createAndCondition([
    priceCondition,
    createNotExecutedCondition("position_cancelled")
  ], "cancel_pending_condition");
  const actions = [createCancelPositionAction()];
  const historicalConditions = [createHistoricalCondition("position_cancelled")];
  return RuleTemplate9.create(condition, actions, historicalConditions);
}

// dist/templates/partialCloseAtPrice.js
import { RuleTemplate as RuleTemplate10 } from "rule-engine-monorepo/rule-engine";
var PARTIAL_CLOSE_AT_PRICE_FACT_PREFIX = "dynamic_partial_close";
function createPartialCloseAtPriceTemplate(params) {
  const { targetPrice, closePercentage, side, levelId } = params;
  if (targetPrice <= 0) {
    throw new Error("targetPrice must be greater than 0");
  }
  if (closePercentage <= 0 || closePercentage > 99) {
    throw new Error("closePercentage must be between 1 and 99");
  }
  if (side !== "buy" && side !== "sell") {
    throw new Error('side must be "buy" or "sell"');
  }
  if (!levelId) {
    throw new Error("levelId is required");
  }
  const factKey = `${PARTIAL_CLOSE_AT_PRICE_FACT_PREFIX}_${levelId}`;
  const priceCondition = side === "buy" ? createPriceAboveCondition(targetPrice) : createPriceBelowCondition(targetPrice);
  const mainCondition = createAndCondition([priceCondition, createNotExecutedCondition(factKey)], "main_condition");
  const action = createPartialCloseByPercentage({ percentage: closePercentage });
  const historicalCondition = createHistoricalCondition(factKey);
  return RuleTemplate10.create(mainCondition, [action], [historicalCondition]);
}

// dist/templates/trailingStop.js
import { RuleTemplate as RuleTemplate11, AtomicCondition as AtomicCondition5, Operator as Operator5 } from "rule-engine-monorepo/rule-engine";
var trailingStopParamsMap = /* @__PURE__ */ new WeakMap();
function createTrailingStopTemplate(params) {
  const { distance, activation } = params;
  assertMeasurement("distance", distance);
  if (activation !== void 0) {
    assertMeasurement("activation", activation);
  }
  const condition = AtomicCondition5.create("trailingShouldExecute", Operator5.EQUAL, 1, "trailing_should_execute");
  const action = createMoveStopLossAction({
    newStopPrice: { var: "trailingNewSL" }
  });
  const template = RuleTemplate11.create(condition, [action], [], true);
  const stored = { distance };
  if (activation !== void 0)
    stored.activation = activation;
  trailingStopParamsMap.set(template, stored);
  return template;
}

// dist/templates/predefinedTemplates.js
var UNIT_OPTIONS = ["R", "percent", "price"];
function readMeasurement(source, name) {
  const value = source[`${name}Value`];
  const unit = source[`${name}Unit`];
  return {
    value: typeof value === "number" ? value : Number(value),
    unit
  };
}
var TRAILING_STOP_TEMPLATE = {
  id: "trailing-stop",
  name: "Trailing Stop",
  description: "Dynamically trails the stop loss at a configurable distance from the current price. Distance and activation may use independent units (R, percent, or price). Activates immediately when activationValue \u2264 0.",
  category: "stop-loss",
  maturity: "lab",
  parameters: [
    {
      name: "distanceValue",
      type: "number",
      default: 0.5,
      min: 0.1,
      max: 10,
      description: "Trailing distance value (> 0)"
    },
    {
      name: "distanceUnit",
      type: "string",
      default: "R",
      description: "Unit of the trailing distance",
      options: [...UNIT_OPTIONS]
    },
    {
      name: "activationValue",
      type: "number",
      default: 1,
      min: 0,
      max: 20,
      description: "Profit-from-entry threshold before trailing arms (0 = activate immediately)"
    },
    {
      name: "activationUnit",
      type: "string",
      default: "R",
      description: "Unit of the activation threshold",
      options: [...UNIT_OPTIONS]
    }
  ],
  create: (flat) => {
    const params = {
      distance: { value: flat.distanceValue, unit: flat.distanceUnit }
    };
    if (flat.activationValue > 0) {
      params.activation = { value: flat.activationValue, unit: flat.activationUnit };
    }
    return createTrailingStopTemplate(params);
  }
};
var SL_BREAKEVEN_TEMPLATE = {
  id: "sl-breakeven",
  name: "Stop-Loss to Breakeven",
  description: "Move stop-loss to entry price when profit reaches a threshold (R, percent, or absolute price)",
  category: "stop-loss",
  maturity: "stable",
  parameters: [
    {
      name: "thresholdValue",
      type: "number",
      default: 2,
      min: 0,
      description: "Profit threshold value to trigger breakeven move"
    },
    {
      name: "thresholdUnit",
      type: "string",
      default: "R",
      description: "Unit of the threshold",
      options: [...UNIT_OPTIONS]
    }
  ],
  create: (flat) => {
    const params = {
      threshold: readMeasurement(flat, "threshold")
    };
    return createMoveSLToBreakevenTemplate(params);
  }
};
var LOCK_IN_PROFIT_STOP_TEMPLATE = {
  id: "lock-in-profit-stop",
  name: "Lock-in Profit Stop",
  description: "Move stop to guarantee minimum profit when higher profit reached",
  category: "stop-loss",
  maturity: "stable",
  parameters: [
    {
      name: "triggerValue",
      type: "number",
      default: 3,
      min: 0,
      description: "Profit value that triggers the lock-in"
    },
    {
      name: "triggerUnit",
      type: "string",
      default: "R",
      description: "Unit of the trigger",
      options: [...UNIT_OPTIONS]
    },
    {
      name: "lockInValue",
      type: "number",
      default: 1,
      min: 0,
      description: "Profit value to lock in (must share unit with trigger)"
    },
    {
      name: "lockInUnit",
      type: "string",
      default: "R",
      description: "Unit of the lock-in value",
      options: [...UNIT_OPTIONS]
    }
  ],
  create: (flat) => {
    const source = flat;
    const params = {
      trigger: readMeasurement(source, "trigger"),
      lockIn: readMeasurement(source, "lockIn")
    };
    if (flat.ruleId !== void 0)
      params.ruleId = flat.ruleId;
    return createLockInProfitStopTemplate(params);
  }
};
var TP_TEMPLATE = {
  id: "take-profit",
  name: "Take Profit",
  description: "Close position when profit reaches a target (R, percent, or absolute price)",
  category: "take-profit",
  maturity: "stable",
  parameters: [
    {
      name: "thresholdValue",
      type: "number",
      default: 3,
      min: 0,
      description: "Profit target value"
    },
    {
      name: "thresholdUnit",
      type: "string",
      default: "R",
      description: "Unit of the threshold",
      options: [...UNIT_OPTIONS]
    }
  ],
  create: (flat) => {
    const params = {
      threshold: readMeasurement(flat, "threshold")
    };
    return createTakeProfitTemplate(params);
  }
};
var FREE_TRADE_TEMPLATE = {
  id: "free-trade",
  name: "Free Trade",
  description: "Recover initial risk by partial close at profit threshold",
  category: "take-profit",
  maturity: "lab",
  parameters: [
    {
      name: "triggerValue",
      type: "number",
      default: 2,
      min: 0,
      description: "Profit value that triggers the risk recovery"
    },
    {
      name: "triggerUnit",
      type: "string",
      default: "R",
      description: "Unit of the trigger",
      options: [...UNIT_OPTIONS]
    },
    {
      name: "recoverValue",
      type: "number",
      default: 1,
      min: 0,
      description: "Amount to recover (must share unit with trigger)"
    },
    {
      name: "recoverUnit",
      type: "string",
      default: "R",
      description: "Unit of the recover value",
      options: [...UNIT_OPTIONS]
    }
  ],
  create: (flat) => {
    const source = flat;
    const params = {
      trigger: readMeasurement(source, "trigger"),
      recover: readMeasurement(source, "recover")
    };
    if (flat.ruleId !== void 0)
      params.ruleId = flat.ruleId;
    return createFreeTradeTemplate(params);
  }
};
var TIME_BASED_STOP_TEMPLATE = {
  id: "time-based-stop",
  name: "Time-based Stop",
  description: "Close position if minimum profit not reached within time limit",
  category: "time-based",
  maturity: "lab",
  parameters: [
    {
      name: "maxMinutes",
      type: "number",
      default: 30,
      min: 5,
      max: 480,
      description: "Maximum time in minutes before exit"
    },
    {
      name: "minProfitR",
      type: "number",
      default: 1,
      min: 0,
      max: 10,
      description: "Minimum R that should be reached to avoid exit"
    },
    {
      name: "closePercentage",
      type: "number",
      default: 100,
      min: 10,
      max: 100,
      description: "Percentage of position to close (100 = full close)"
    }
  ],
  create: createTimeBasedStopTemplate
};
var MAX_DRAWDOWN_FROM_PEAK_TEMPLATE = {
  id: "max-drawdown-from-peak",
  name: "Max Drawdown from Peak",
  description: "Close position if profit drops too much from peak R",
  category: "risk-management",
  maturity: "lab",
  parameters: [
    {
      name: "minPeakR",
      type: "number",
      default: 3,
      min: 1,
      max: 20,
      description: "Minimum peak R required before rule activates"
    },
    {
      name: "maxDrawdownR",
      type: "number",
      default: 1.5,
      min: 0.5,
      max: 10,
      description: "Maximum R that can be given back to market"
    },
    {
      name: "closePercentage",
      type: "number",
      default: 100,
      min: 10,
      max: 100,
      description: "Percentage of position to close"
    }
  ],
  create: createMaxDrawdownFromPeakTemplate
};
var PATTERN_BASED_EXIT_TEMPLATE = {
  id: "pattern-based-exit",
  name: "Pattern-based Exit",
  description: "Exit on candlestick patterns (bearish for long, bullish for short)",
  category: "pattern-based",
  maturity: "lab",
  parameters: [
    {
      name: "positionDirection",
      type: "string",
      default: "long",
      description: "Position direction (long or short)",
      options: ["long", "short"]
    },
    {
      name: "minProfitValue",
      type: "number",
      default: 0,
      min: 0,
      description: "Minimum profit value before pattern exit is allowed (0 = no minimum)"
    },
    {
      name: "minProfitUnit",
      type: "string",
      default: "R",
      description: "Unit of the minimum-profit threshold",
      options: [...UNIT_OPTIONS]
    },
    {
      name: "closePercentage",
      type: "number",
      default: 100,
      min: 10,
      max: 100,
      description: "Percentage of position to close"
    }
  ],
  create: (flat) => {
    const params = {
      positionDirection: flat.positionDirection,
      closePercentage: flat.closePercentage
    };
    if (flat.minProfitValue > 0) {
      params.minProfit = readMeasurement(flat, "minProfit");
    }
    if (flat.patternNames !== void 0)
      params.patternNames = flat.patternNames;
    if (flat.timeframe !== void 0)
      params.timeframe = flat.timeframe;
    if (flat.ruleId !== void 0)
      params.ruleId = flat.ruleId;
    return createPatternBasedExitTemplate(params);
  }
};
var CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE = {
  id: "cancel-pending-on-price-level",
  name: "Cancel Pending on Price Level",
  description: "Automatically cancels a pending limit order when a specific price level is reached",
  category: "order-management",
  maturity: "stable",
  parameters: [
    {
      name: "invalidationPrice",
      type: "number",
      default: 0,
      min: 0,
      description: "Price level that invalidates the trade setup"
    },
    {
      name: "direction",
      type: "string",
      default: "below",
      description: 'Price direction: "below" or "above"',
      options: ["below", "above"]
    }
  ],
  create: createCancelPendingOnPriceLevelTemplate
};
var PARTIAL_CLOSE_AT_PRICE_TEMPLATE = {
  id: "partial-close-at-price",
  name: "Partial Close at Price",
  description: "Close a percentage of the position when a specific price level is reached",
  category: "dynamic-position",
  maturity: "stable",
  parameters: [
    {
      name: "targetPrice",
      type: "number",
      default: 0,
      min: 0,
      description: "Target price level to trigger partial close"
    },
    {
      name: "closePercentage",
      type: "number",
      default: 50,
      min: 1,
      max: 99,
      description: "Percentage of remaining position to close"
    },
    {
      name: "side",
      type: "string",
      default: "buy",
      description: 'Position side: "buy" or "sell"'
    },
    {
      name: "levelId",
      type: "string",
      default: "",
      description: "Unique identifier for this level"
    }
  ],
  create: createPartialCloseAtPriceTemplate
};
var templateDefinitions = {
  // Stop Loss
  [TRAILING_STOP_TEMPLATE.id]: TRAILING_STOP_TEMPLATE,
  [SL_BREAKEVEN_TEMPLATE.id]: SL_BREAKEVEN_TEMPLATE,
  [LOCK_IN_PROFIT_STOP_TEMPLATE.id]: LOCK_IN_PROFIT_STOP_TEMPLATE,
  // Take Profit
  [TP_TEMPLATE.id]: TP_TEMPLATE,
  [FREE_TRADE_TEMPLATE.id]: FREE_TRADE_TEMPLATE,
  // Time-based
  [TIME_BASED_STOP_TEMPLATE.id]: TIME_BASED_STOP_TEMPLATE,
  // Risk Management
  [MAX_DRAWDOWN_FROM_PEAK_TEMPLATE.id]: MAX_DRAWDOWN_FROM_PEAK_TEMPLATE,
  // Pattern-based
  [PATTERN_BASED_EXIT_TEMPLATE.id]: PATTERN_BASED_EXIT_TEMPLATE,
  // Order Management
  [CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE.id]: CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE,
  // Dynamic Position
  [PARTIAL_CLOSE_AT_PRICE_TEMPLATE.id]: PARTIAL_CLOSE_AT_PRICE_TEMPLATE
};

// dist/registry/instances.js
var ACTIONS = {
  MOVE_STOP_LOSS_TO_BREAKEVEN: createMoveStopLossAction({
    newStopPrice: { "var": "entryPrice" }
  }),
  CLOSE_POSITION: createClosePositionAction(),
  CANCEL_POSITION: createCancelPositionAction()
};
var CONDITIONS = {
  PROFIT_1R: createProfitThresholdCondition({ value: 1, unit: "R" }),
  PROFIT_1_5R: createProfitThresholdCondition({ value: 1.5, unit: "R" }),
  PROFIT_2R: createProfitThresholdCondition({ value: 2, unit: "R" }),
  PROFIT_3R: createProfitThresholdCondition({ value: 3, unit: "R" }),
  PROFIT_5R: createProfitThresholdCondition({ value: 5, unit: "R" }),
  SL_NOT_MOVED: createNotExecutedCondition("sl_moved_to_breakeven"),
  POSITION_NOT_CLOSED: createNotExecutedCondition("position_closed_for_profit")
};
var TEMPLATES = {
  SL_BREAKEVEN_1R: createMoveSLToBreakevenTemplate({ threshold: { value: 1, unit: "R" } }),
  SL_BREAKEVEN_1_5R: createMoveSLToBreakevenTemplate({ threshold: { value: 1.5, unit: "R" } }),
  SL_BREAKEVEN_2R: createMoveSLToBreakevenTemplate({ threshold: { value: 2, unit: "R" } }),
  SL_BREAKEVEN_3R: createMoveSLToBreakevenTemplate({ threshold: { value: 3, unit: "R" } }),
  TAKE_PROFIT_2R: createTakeProfitTemplate({ threshold: { value: 2, unit: "R" } }),
  TAKE_PROFIT_3R: createTakeProfitTemplate({ threshold: { value: 3, unit: "R" } }),
  TAKE_PROFIT_5R: createTakeProfitTemplate({ threshold: { value: 5, unit: "R" } })
};

// dist/registry/registry.js
var tradingRuleRegistry = {
  // ============================================================================
  // Stop Loss à breakeven
  // ============================================================================
  "sl-breakeven-1.5r": createMoveSLToBreakevenTemplate({ threshold: { value: 1.5, unit: "R" } }),
  "sl-breakeven-2r": createMoveSLToBreakevenTemplate({ threshold: { value: 2, unit: "R" } }),
  "sl-breakeven-3r": createMoveSLToBreakevenTemplate({ threshold: { value: 3, unit: "R" } }),
  // ============================================================================
  // Prise de bénéfices (Take Profit)
  // ============================================================================
  "tp-2r": createTakeProfitTemplate({ threshold: { value: 2, unit: "R" } }),
  "tp-3r": createTakeProfitTemplate({ threshold: { value: 3, unit: "R" } }),
  "tp-5r": createTakeProfitTemplate({ threshold: { value: 5, unit: "R" } }),
  // ============================================================================
  // Partial Take Profit
  // ============================================================================
  "partial-1r-50pct": createTakePartialTemplate({ threshold: { value: 1, unit: "R" }, closePercentage: 50, partialId: "1R_50pct" }),
  "partial-2r-50pct": createTakePartialTemplate({ threshold: { value: 2, unit: "R" }, closePercentage: 50, partialId: "2R_50pct" }),
  "partial-1r-33pct": createTakePartialTemplate({ threshold: { value: 1, unit: "R" }, closePercentage: 33.33, partialId: "1R_33pct" }),
  // ============================================================================
  // Time-based Stop (sortie si profit non atteint dans le temps)
  // ============================================================================
  "time-stop-30min-1r": createTimeBasedStopTemplate({ maxMinutes: 30, minProfitR: 1, ruleId: "30min_1R" }),
  "time-stop-15min-05r": createTimeBasedStopTemplate({ maxMinutes: 15, minProfitR: 0.5, ruleId: "15min_05R" }),
  "time-stop-60min-2r": createTimeBasedStopTemplate({ maxMinutes: 60, minProfitR: 2, ruleId: "60min_2R" }),
  // ============================================================================
  // Free Trade (retirer le risque initial)
  // ============================================================================
  "free-trade-2r": createFreeTradeTemplate({ trigger: { value: 2, unit: "R" }, recover: { value: 1, unit: "R" }, ruleId: "2R" }),
  "free-trade-3r": createFreeTradeTemplate({ trigger: { value: 3, unit: "R" }, recover: { value: 1, unit: "R" }, ruleId: "3R" }),
  "free-trade-1.5r": createFreeTradeTemplate({ trigger: { value: 1.5, unit: "R" }, recover: { value: 1, unit: "R" }, ruleId: "1_5R" }),
  // ============================================================================
  // Lock-in Profit Stop (verrouillage du profit)
  // ============================================================================
  "lock-3r-to-1r": createLockInProfitStopTemplate({ trigger: { value: 3, unit: "R" }, lockIn: { value: 1, unit: "R" }, ruleId: "3R_to_1R" }),
  "lock-2r-to-05r": createLockInProfitStopTemplate({ trigger: { value: 2, unit: "R" }, lockIn: { value: 0.5, unit: "R" }, ruleId: "2R_to_05R" }),
  "lock-4r-to-2r": createLockInProfitStopTemplate({ trigger: { value: 4, unit: "R" }, lockIn: { value: 2, unit: "R" }, ruleId: "4R_to_2R" }),
  "lock-5r-to-3r": createLockInProfitStopTemplate({ trigger: { value: 5, unit: "R" }, lockIn: { value: 3, unit: "R" }, ruleId: "5R_to_3R" }),
  // ============================================================================
  // Max Drawdown from Peak (protection contre retournements)
  // ============================================================================
  "max-dd-4r-peak-25r": createMaxDrawdownFromPeakTemplate({ minPeakR: 4, maxDrawdownR: 2.5, ruleId: "4R_peak_25R_dd" }),
  "max-dd-3r-peak-15r": createMaxDrawdownFromPeakTemplate({ minPeakR: 3, maxDrawdownR: 1.5, ruleId: "3R_peak_15R_dd" }),
  "max-dd-2r-peak-1r": createMaxDrawdownFromPeakTemplate({ minPeakR: 2, maxDrawdownR: 1, ruleId: "2R_peak_1R_dd" }),
  // ============================================================================
  // Pattern-based Exit (sortie sur pattern de bougie)
  // ============================================================================
  "pattern-exit-long-bearish": createPatternBasedExitTemplate({ positionDirection: "long", ruleId: "long_bearish" }),
  "pattern-exit-short-bullish": createPatternBasedExitTemplate({ positionDirection: "short", ruleId: "short_bullish" }),
  "pattern-exit-long-engulfing": createPatternBasedExitTemplate({ positionDirection: "long", patternNames: ["engulfing_bearish"], ruleId: "long_engulfing" }),
  "pattern-exit-long-profitable": createPatternBasedExitTemplate({ positionDirection: "long", minProfit: { value: 0.5, unit: "R" }, ruleId: "long_bearish_profitable" })
};

// dist/schemas/actionSchemas.js
var TRADING_CONTEXT_FIELDS = [
  "entryPrice",
  "currentPrice",
  "stopLoss",
  "takeProfit",
  "currentR",
  "positionSize",
  "accountBalance"
];
var moveStopLossSchema = {
  actionRef: ActionType.MOVE_STOP_LOSS,
  category: "stop_loss",
  parameters: [
    {
      name: "newStopPrice",
      type: "field-ref",
      required: true,
      availableFields: [...TRADING_CONTEXT_FIELDS]
    }
  ]
};
var placeOrderSchema = {
  actionRef: ActionType.PLACE_ORDER,
  category: "orders",
  parameters: [
    {
      name: "type",
      type: "select",
      required: true,
      options: ["market", "limit", "stop", "close_position"],
      defaultValue: "market"
    },
    {
      name: "symbol",
      type: "string",
      required: false
    },
    {
      name: "side",
      type: "select",
      required: false,
      options: ["BUY", "SELL"]
    },
    {
      name: "quantity",
      type: "number",
      required: false,
      min: 0,
      step: 0.01
    }
  ]
};
var partialCloseSchema = {
  actionRef: ActionType.PARTIAL_CLOSE,
  category: "orders",
  parameters: [
    {
      name: "percentage",
      type: "number",
      required: true,
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 50
    }
  ]
};
var scaleOutSchema = {
  actionRef: ActionType.SCALE_OUT,
  category: "orders",
  parameters: [
    {
      name: "percentage",
      type: "number",
      required: true,
      min: 1,
      max: 100,
      step: 1,
      defaultValue: 25
    },
    {
      name: "targetR",
      type: "number",
      required: true,
      min: 0,
      step: 0.5,
      defaultValue: 2
    }
  ]
};
var startTrailingStopSchema = {
  actionRef: ActionType.START_TRAILING_STOP,
  category: "stop_loss",
  parameters: [
    {
      name: "trailingDistance",
      type: "number",
      required: true,
      min: 0,
      step: 0.1
    },
    {
      name: "activationR",
      type: "number",
      required: false,
      min: 0,
      step: 0.5,
      defaultValue: 1
    }
  ]
};
var cancelPositionSchema = {
  actionRef: ActionType.CANCEL_POSITION,
  category: "orders",
  parameters: []
};
var tradingActionSchemas = [
  moveStopLossSchema,
  placeOrderSchema,
  partialCloseSchema,
  scaleOutSchema,
  startTrailingStopSchema,
  cancelPositionSchema
];

// dist/schemas/conditionSchemas.js
var profitRatioSchema = {
  conditionRef: ConditionReference.PROFIT_RATIO_GREATER_EQUAL,
  category: "profit",
  fields: [
    {
      name: "thresholdR",
      type: "number",
      required: true,
      min: 0,
      step: 0.5,
      defaultValue: 1
    }
  ]
};
var positionSizeSchema = {
  conditionRef: ConditionReference.POSITION_SIZE_GREATER_THAN,
  category: "position",
  fields: [
    {
      name: "minSize",
      type: "number",
      required: true,
      min: 0,
      step: 0.01
    }
  ]
};
var volumeSchema = {
  conditionRef: ConditionReference.VOLUME_GREATER_THAN,
  category: "market",
  fields: [
    {
      name: "minVolume",
      type: "number",
      required: true,
      min: 0
    }
  ]
};
var maxDrawdownSchema = {
  conditionRef: ConditionReference.MAX_DRAWDOWN_LESS_THAN,
  category: "risk",
  fields: [
    {
      name: "maxDrawdownPercent",
      type: "number",
      required: true,
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 10
    }
  ]
};
var barsSinceEntrySchema = {
  conditionRef: ConditionReference.BARS_SINCE_ENTRY_GREATER_THAN,
  category: "time",
  fields: [
    {
      name: "minBars",
      type: "number",
      required: true,
      min: 1,
      step: 1,
      defaultValue: 5
    }
  ]
};
var stopLossTriggeredSchema = {
  conditionRef: ConditionReference.STOP_LOSS_TRIGGERED_EQUAL,
  category: "stop_loss",
  fields: [
    {
      name: "triggered",
      type: "boolean",
      required: true,
      defaultValue: true
    }
  ]
};
var isTrailingSchema = {
  conditionRef: ConditionReference.IS_TRAILING_NOT_EQUAL,
  category: "stop_loss",
  fields: [
    {
      name: "isTrailing",
      type: "boolean",
      required: true,
      defaultValue: false
    }
  ]
};
var slMovedSchema = {
  conditionRef: ConditionReference.SL_MOVED_EQUAL_TRUE,
  category: "stop_loss",
  fields: []
};
var partialSlDoneSchema = {
  conditionRef: ConditionReference.PARTIAL_SL_DONE_NOT_EQUAL_TRUE,
  category: "stop_loss",
  fields: []
};
var priceLevelSchema = {
  conditionRef: ConditionReference.PRICE_LEVEL_REACHED,
  category: "price",
  fields: [
    {
      name: "invalidationPrice",
      type: "number",
      required: true,
      min: 0,
      step: 1e-4
    },
    {
      name: "direction",
      type: "string",
      required: true,
      defaultValue: "below"
    }
  ]
};
var tradingConditionSchemas = [
  profitRatioSchema,
  positionSizeSchema,
  volumeSchema,
  maxDrawdownSchema,
  barsSinceEntrySchema,
  stopLossTriggeredSchema,
  isTrailingSchema,
  slMovedSchema,
  partialSlDoneSchema,
  priceLevelSchema
];

// dist/schemas/tradingSchemaRegistry.js
import { SchemaRegistry } from "rule-engine-monorepo/rule-engine";
function createTradingSchemaRegistry() {
  const registry = new SchemaRegistry();
  registry.registerActions(tradingActionSchemas);
  registry.registerConditions(tradingConditionSchemas);
  return registry;
}
export {
  ACTIONS,
  ActionType,
  CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE,
  CONDITIONS,
  ConditionReference,
  DRAWDOWN_FROM_PEAK_FIELD,
  FREE_TRADE_1_5R,
  FREE_TRADE_2R,
  FREE_TRADE_3R,
  FREE_TRADE_4R,
  FREE_TRADE_TEMPLATE,
  LOCK_IN_2R_TO_05R,
  LOCK_IN_3R_TO_1R,
  LOCK_IN_4R_TO_2R,
  LOCK_IN_5R_TO_3R,
  LOCK_IN_PROFIT_STOP_TEMPLATE,
  MAX_DD_2R_PEAK_1R_DD,
  MAX_DD_3R_PEAK_15R_DD,
  MAX_DD_4R_PEAK_25R_DD,
  MAX_DD_5R_PEAK_2R_DD_MIN_1R,
  MAX_DRAWDOWN_FROM_PEAK_TEMPLATE,
  PARTIAL_CLOSE_25_PERCENT,
  PARTIAL_CLOSE_33_PERCENT,
  PARTIAL_CLOSE_50_PERCENT,
  PARTIAL_CLOSE_AT_PRICE_TEMPLATE,
  PATTERN_BASED_EXIT_TEMPLATE,
  PATTERN_EXIT_LONG_BEARISH,
  PATTERN_EXIT_LONG_BEARISH_PARTIAL,
  PATTERN_EXIT_LONG_BEARISH_PROFITABLE,
  PATTERN_EXIT_LONG_ENGULFING,
  PATTERN_EXIT_SHORT_BULLISH,
  PATTERN_EXIT_SHORT_ENGULFING,
  PATTERN_RULE_TRIGGER_TYPE,
  PEAK_FIELD,
  PROFIT_FIELD,
  SL_BREAKEVEN_TEMPLATE,
  TAKE_PARTIAL_1R_25PCT,
  TAKE_PARTIAL_1R_33PCT,
  TAKE_PARTIAL_1R_50PCT,
  TAKE_PARTIAL_2R_25PCT,
  TAKE_PARTIAL_2R_50PCT,
  TEMPLATES,
  TIME_BASED_STOP_TEMPLATE,
  TIME_STOP_15MIN_05R,
  TIME_STOP_30MIN_1R,
  TIME_STOP_60MIN_2R,
  TP_TEMPLATE,
  TRADING_CONTEXT_FIELDS,
  TRAILING_STOP_TEMPLATE,
  TriggerType,
  assertMeasurement,
  barsSinceEntrySchema,
  cancelPositionSchema,
  createAndCondition,
  createBearishPatternCondition,
  createBullishPatternCondition,
  createCancelPendingOnPriceLevelTemplate,
  createCancelPositionAction,
  createClosePositionAction,
  createDrawdownFromPeakCondition,
  createExecutedCondition,
  createFreeTradeTemplate,
  createHistoricalCondition,
  createLockInProfitStopTemplate,
  createMaxDrawdownFromPeakTemplate,
  createMoveSLToBreakevenTemplate,
  createMoveStopLossAction,
  createNotExecutedCondition,
  createOrCondition,
  createPartialCloseAtPriceTemplate,
  createPartialCloseByPercentage,
  createPartialCloseByQuantity,
  createPartialCloseDynamic,
  createPatternBasedExitTemplate,
  createPatternDetectedCondition,
  createPeakRReachedCondition,
  createPlaceOrderAction,
  createPriceAboveCondition,
  createPriceBelowCondition,
  createProfitBelowCondition,
  createProfitThresholdCondition,
  createTakePartialTemplate,
  createTakeProfitTemplate,
  createTimeBasedStopTemplate,
  createTimeElapsedCondition,
  createTradingSchemaRegistry,
  createTrailingStopTemplate,
  isTrailingSchema,
  lockInProfitStopParamsMap,
  maxDrawdownSchema,
  moveStopLossSchema,
  partialCloseSchema,
  partialSlDoneSchema,
  placeOrderSchema,
  positionSizeSchema,
  priceLevelSchema,
  profitRatioSchema,
  scaleOutSchema,
  slMovedSchema,
  startTrailingStopSchema,
  stopLossTriggeredSchema,
  templateDefinitions,
  tradingActionSchemas,
  tradingConditionSchemas,
  tradingRuleRegistry,
  trailingStopParamsMap,
  volumeSchema
};
