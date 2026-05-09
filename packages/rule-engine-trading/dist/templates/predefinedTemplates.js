import { createMoveSLToBreakevenTemplate } from './moveSLToBreakeven.js';
import { createTakeProfitTemplate } from './takeProfit.js';
import { createTimeBasedStopTemplate } from './timeBasedStop.js';
import { createFreeTradeTemplate } from './freeTrade.js';
import { createLockInProfitStopTemplate } from './lockInProfitStop.js';
import { createMaxDrawdownFromPeakTemplate } from './maxDrawdownFromPeak.js';
import { createPatternBasedExitTemplate } from './patternBasedExit.js';
import { createCancelPendingOnPriceLevelTemplate } from './cancelPendingOnPriceLevel.js';
import { createPartialCloseAtPriceTemplate } from './partialCloseAtPrice.js';
import { createTrailingStopTemplate } from './trailingStop.js';
// ──────────────────────────────────────────────────────────────────────────
// Helpers for measurement-typed parameters
// ──────────────────────────────────────────────────────────────────────────
const UNIT_OPTIONS = ['R', 'percent', 'price'];
/** Reads `<name>Value` + `<name>Unit` from a flat UI params bag. */
function readMeasurement(source, name) {
    const value = source[`${name}Value`];
    const unit = source[`${name}Unit`];
    return {
        value: typeof value === 'number' ? value : Number(value),
        unit: unit,
    };
}
// ============================================================================
// Stop Loss Templates
// ============================================================================
export const TRAILING_STOP_TEMPLATE = {
    id: 'trailing-stop',
    name: 'Trailing Stop',
    description: 'Dynamically trails the stop loss at a configurable distance from the current price. Distance and activation may use independent units (R, percent, or price). Activates immediately when activationValue ≤ 0.',
    category: 'stop-loss',
    maturity: 'lab',
    parameters: [
        {
            name: 'distanceValue',
            type: 'number',
            default: 0.5,
            min: 0.1,
            max: 10,
            description: 'Trailing distance value (> 0)'
        },
        {
            name: 'distanceUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the trailing distance',
            options: [...UNIT_OPTIONS],
        },
        {
            name: 'activationValue',
            type: 'number',
            default: 1,
            min: 0,
            max: 20,
            description: 'Profit-from-entry threshold before trailing arms (0 = activate immediately)'
        },
        {
            name: 'activationUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the activation threshold',
            options: [...UNIT_OPTIONS],
        }
    ],
    create: (flat) => {
        const params = {
            distance: { value: flat.distanceValue, unit: flat.distanceUnit },
        };
        if (flat.activationValue > 0) {
            params.activation = { value: flat.activationValue, unit: flat.activationUnit };
        }
        return createTrailingStopTemplate(params);
    },
};
export const SL_BREAKEVEN_TEMPLATE = {
    id: 'sl-breakeven',
    name: 'Stop-Loss to Breakeven',
    description: 'Move stop-loss to entry price when profit reaches a threshold (R, percent, or absolute price)',
    category: 'stop-loss',
    maturity: 'stable',
    parameters: [
        {
            name: 'thresholdValue',
            type: 'number',
            default: 2,
            min: 0,
            description: 'Profit threshold value to trigger breakeven move'
        },
        {
            name: 'thresholdUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the threshold',
            options: [...UNIT_OPTIONS],
        }
    ],
    create: (flat) => {
        const params = {
            threshold: readMeasurement(flat, 'threshold'),
        };
        return createMoveSLToBreakevenTemplate(params);
    },
};
export const LOCK_IN_PROFIT_STOP_TEMPLATE = {
    id: 'lock-in-profit-stop',
    name: 'Lock-in Profit Stop',
    description: 'Move stop to guarantee minimum profit when higher profit reached',
    category: 'stop-loss',
    maturity: 'stable',
    parameters: [
        {
            name: 'triggerValue',
            type: 'number',
            default: 3,
            min: 0,
            description: 'Profit value that triggers the lock-in'
        },
        {
            name: 'triggerUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the trigger',
            options: [...UNIT_OPTIONS],
        },
        {
            name: 'lockInValue',
            type: 'number',
            default: 1,
            min: 0,
            description: 'Profit value to lock in (must share unit with trigger)'
        },
        {
            name: 'lockInUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the lock-in value',
            options: [...UNIT_OPTIONS],
        }
    ],
    create: (flat) => {
        const source = flat;
        const params = {
            trigger: readMeasurement(source, 'trigger'),
            lockIn: readMeasurement(source, 'lockIn'),
        };
        if (flat.ruleId !== undefined)
            params.ruleId = flat.ruleId;
        return createLockInProfitStopTemplate(params);
    },
};
// ============================================================================
// Take Profit Templates
// ============================================================================
export const TP_TEMPLATE = {
    id: 'take-profit',
    name: 'Take Profit',
    description: 'Close position when profit reaches a target (R, percent, or absolute price)',
    category: 'take-profit',
    maturity: 'stable',
    parameters: [
        {
            name: 'thresholdValue',
            type: 'number',
            default: 3,
            min: 0,
            description: 'Profit target value'
        },
        {
            name: 'thresholdUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the threshold',
            options: [...UNIT_OPTIONS],
        }
    ],
    create: (flat) => {
        const params = {
            threshold: readMeasurement(flat, 'threshold'),
        };
        return createTakeProfitTemplate(params);
    },
};
export const FREE_TRADE_TEMPLATE = {
    id: 'free-trade',
    name: 'Free Trade',
    description: 'Recover initial risk by partial close at profit threshold',
    category: 'take-profit',
    maturity: 'lab',
    parameters: [
        {
            name: 'triggerValue',
            type: 'number',
            default: 2,
            min: 0,
            description: 'Profit value that triggers the risk recovery'
        },
        {
            name: 'triggerUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the trigger',
            options: [...UNIT_OPTIONS],
        },
        {
            name: 'recoverValue',
            type: 'number',
            default: 1,
            min: 0,
            description: 'Amount to recover (must share unit with trigger)'
        },
        {
            name: 'recoverUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the recover value',
            options: [...UNIT_OPTIONS],
        }
    ],
    create: (flat) => {
        const source = flat;
        const params = {
            trigger: readMeasurement(source, 'trigger'),
            recover: readMeasurement(source, 'recover'),
        };
        if (flat.ruleId !== undefined)
            params.ruleId = flat.ruleId;
        return createFreeTradeTemplate(params);
    },
};
// ============================================================================
// Time-based Templates
// ============================================================================
export const TIME_BASED_STOP_TEMPLATE = {
    id: 'time-based-stop',
    name: 'Time-based Stop',
    description: 'Close position if minimum profit not reached within time limit',
    category: 'time-based',
    maturity: 'lab',
    parameters: [
        {
            name: 'maxMinutes',
            type: 'number',
            default: 30,
            min: 5,
            max: 480,
            description: 'Maximum time in minutes before exit'
        },
        {
            name: 'minProfitR',
            type: 'number',
            default: 1,
            min: 0,
            max: 10,
            description: 'Minimum R that should be reached to avoid exit'
        },
        {
            name: 'closePercentage',
            type: 'number',
            default: 100,
            min: 10,
            max: 100,
            description: 'Percentage of position to close (100 = full close)'
        }
    ],
    create: createTimeBasedStopTemplate
};
// ============================================================================
// Risk Management Templates
// ============================================================================
export const MAX_DRAWDOWN_FROM_PEAK_TEMPLATE = {
    id: 'max-drawdown-from-peak',
    name: 'Max Drawdown from Peak',
    description: 'Close position if profit drops too much from peak R',
    category: 'risk-management',
    maturity: 'lab',
    parameters: [
        {
            name: 'minPeakR',
            type: 'number',
            default: 3,
            min: 1,
            max: 20,
            description: 'Minimum peak R required before rule activates'
        },
        {
            name: 'maxDrawdownR',
            type: 'number',
            default: 1.5,
            min: 0.5,
            max: 10,
            description: 'Maximum R that can be given back to market'
        },
        {
            name: 'closePercentage',
            type: 'number',
            default: 100,
            min: 10,
            max: 100,
            description: 'Percentage of position to close'
        }
    ],
    create: createMaxDrawdownFromPeakTemplate
};
// ============================================================================
// Pattern-based Templates
// ============================================================================
export const PATTERN_BASED_EXIT_TEMPLATE = {
    id: 'pattern-based-exit',
    name: 'Pattern-based Exit',
    description: 'Exit on candlestick patterns (bearish for long, bullish for short)',
    category: 'pattern-based',
    maturity: 'lab',
    parameters: [
        {
            name: 'positionDirection',
            type: 'string',
            default: 'long',
            description: 'Position direction (long or short)',
            options: ['long', 'short'],
        },
        {
            name: 'minProfitValue',
            type: 'number',
            default: 0,
            min: 0,
            description: 'Minimum profit value before pattern exit is allowed (0 = no minimum)'
        },
        {
            name: 'minProfitUnit',
            type: 'string',
            default: 'R',
            description: 'Unit of the minimum-profit threshold',
            options: [...UNIT_OPTIONS],
        },
        {
            name: 'closePercentage',
            type: 'number',
            default: 100,
            min: 10,
            max: 100,
            description: 'Percentage of position to close'
        }
    ],
    create: (flat) => {
        const params = {
            positionDirection: flat.positionDirection,
            closePercentage: flat.closePercentage,
        };
        if (flat.minProfitValue > 0) {
            params.minProfit = readMeasurement(flat, 'minProfit');
        }
        if (flat.patternNames !== undefined)
            params.patternNames = flat.patternNames;
        if (flat.timeframe !== undefined)
            params.timeframe = flat.timeframe;
        if (flat.ruleId !== undefined)
            params.ruleId = flat.ruleId;
        return createPatternBasedExitTemplate(params);
    },
};
// ============================================================================
// Order Management Templates
// ============================================================================
export const CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE = {
    id: 'cancel-pending-on-price-level',
    name: 'Cancel Pending on Price Level',
    description: 'Automatically cancels a pending limit order when a specific price level is reached',
    category: 'order-management',
    maturity: 'stable',
    parameters: [
        {
            name: 'invalidationPrice',
            type: 'number',
            default: 0,
            min: 0,
            description: 'Price level that invalidates the trade setup'
        },
        {
            name: 'direction',
            type: 'string',
            default: 'below',
            description: 'Price direction: "below" or "above"',
            options: ['below', 'above'],
        }
    ],
    create: createCancelPendingOnPriceLevelTemplate
};
// ============================================================================
// Dynamic Position Templates (per-position, not account-level)
// ============================================================================
export const PARTIAL_CLOSE_AT_PRICE_TEMPLATE = {
    id: 'partial-close-at-price',
    name: 'Partial Close at Price',
    description: 'Close a percentage of the position when a specific price level is reached',
    category: 'dynamic-position',
    maturity: 'stable',
    parameters: [
        {
            name: 'targetPrice',
            type: 'number',
            default: 0,
            min: 0,
            description: 'Target price level to trigger partial close'
        },
        {
            name: 'closePercentage',
            type: 'number',
            default: 50,
            min: 1,
            max: 99,
            description: 'Percentage of remaining position to close'
        },
        {
            name: 'side',
            type: 'string',
            default: 'buy',
            description: 'Position side: "buy" or "sell"'
        },
        {
            name: 'levelId',
            type: 'string',
            default: '',
            description: 'Unique identifier for this level'
        }
    ],
    create: createPartialCloseAtPriceTemplate
};
// ============================================================================
// Registry of all template definitions
// ============================================================================
export const templateDefinitions = {
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
    [PARTIAL_CLOSE_AT_PRICE_TEMPLATE.id]: PARTIAL_CLOSE_AT_PRICE_TEMPLATE,
};
//# sourceMappingURL=predefinedTemplates.js.map