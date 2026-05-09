import { RuleTemplate } from 'rule-engine-monorepo/rule-engine';
import type { Unit } from '../domain/Measurement.js';
import { TimeBasedStopTemplateParams } from './timeBasedStop.js';
import { MaxDrawdownFromPeakTemplateParams } from './maxDrawdownFromPeak.js';
import { CancelPendingOnPriceLevelTemplateParams } from './cancelPendingOnPriceLevel.js';
import { PartialCloseAtPriceTemplateParams } from './partialCloseAtPrice.js';
/**
 * Template categories for rule classification.
 */
export type TemplateCategory = 'stop-loss' | 'take-profit' | 'time-based' | 'risk-management' | 'pattern-based' | 'order-management' | 'dynamic-position';
/**
 * Template maturity level.
 * - 'stable': Production-ready, visible to all users.
 * - 'lab': Experimental, visible only to whitelisted accounts.
 */
export type TemplateMaturity = 'stable' | 'lab';
export interface TemplateDefinition<T = any> {
    id: string;
    name: string;
    description: string;
    category: TemplateCategory;
    maturity: TemplateMaturity;
    /**
     * Paramètres configurables du template.
     *
     * Champ `options` : si renseigné, le paramètre est rendu comme un <select> dans l'UI
     * plutôt qu'un champ texte libre. Les valeurs doivent être des chaînes correspondant
     * aux valeurs acceptées par le moteur de règles.
     *
     * Exemple : options: ['below', 'above'] pour un paramètre de direction de prix.
     *
     * Multi-unit measurement parameters (`Measurement` in the factory params) are
     * exposed flat as a `<name>Value: number` + `<name>Unit: 'R'|'percent'|'price'`
     * pair so the form pipeline stays simple. The `create` wrapper reassembles them
     * into a `Measurement` object before delegating to the factory.
     */
    parameters: Array<{
        /** Field name on the *flat UI params*, not necessarily on the factory params. */
        name: string;
        type: 'number' | 'string' | 'boolean';
        default: number | string | boolean;
        min?: number;
        max?: number;
        description?: string;
        /** Valeurs autorisées. Si présent, l'UI affiche un select au lieu d'un champ texte. */
        options?: string[];
    }>;
    create: (params: T) => RuleTemplate;
}
interface SLBreakevenFlatParams {
    thresholdValue: number;
    thresholdUnit: Unit;
}
interface LockInFlatParams {
    triggerValue: number;
    triggerUnit: Unit;
    lockInValue: number;
    lockInUnit: Unit;
    ruleId?: string;
}
interface TPFlatParams {
    thresholdValue: number;
    thresholdUnit: Unit;
}
interface FreeTradeFlatParams {
    triggerValue: number;
    triggerUnit: Unit;
    recoverValue: number;
    recoverUnit: Unit;
    ruleId?: string;
}
interface PatternExitFlatParams {
    positionDirection: 'long' | 'short';
    minProfitValue: number;
    minProfitUnit: Unit;
    closePercentage: number;
    patternNames?: string[];
    timeframe?: string;
    ruleId?: string;
}
interface TrailingStopFlatParams {
    distanceValue: number;
    distanceUnit: Unit;
    activationValue: number;
    activationUnit: Unit;
}
export declare const TRAILING_STOP_TEMPLATE: TemplateDefinition<TrailingStopFlatParams>;
export declare const SL_BREAKEVEN_TEMPLATE: TemplateDefinition<SLBreakevenFlatParams>;
export declare const LOCK_IN_PROFIT_STOP_TEMPLATE: TemplateDefinition<LockInFlatParams>;
export declare const TP_TEMPLATE: TemplateDefinition<TPFlatParams>;
export declare const FREE_TRADE_TEMPLATE: TemplateDefinition<FreeTradeFlatParams>;
export declare const TIME_BASED_STOP_TEMPLATE: TemplateDefinition<TimeBasedStopTemplateParams>;
export declare const MAX_DRAWDOWN_FROM_PEAK_TEMPLATE: TemplateDefinition<MaxDrawdownFromPeakTemplateParams>;
export declare const PATTERN_BASED_EXIT_TEMPLATE: TemplateDefinition<PatternExitFlatParams>;
export declare const CANCEL_PENDING_ON_PRICE_LEVEL_TEMPLATE: TemplateDefinition<CancelPendingOnPriceLevelTemplateParams>;
export declare const PARTIAL_CLOSE_AT_PRICE_TEMPLATE: TemplateDefinition<PartialCloseAtPriceTemplateParams>;
export declare const templateDefinitions: Record<string, TemplateDefinition>;
export {};
//# sourceMappingURL=predefinedTemplates.d.ts.map