/**
 * @file trailingStop.test.ts
 * @description Unit tests for the multi-unit trailing-stop template factory.
 * Locks the contract: validation errors via `assertMeasurement`, condition
 * shape unchanged (still on `trailingShouldExecute`), and `trailingStopParamsMap`
 * stores the exact `Measurement` objects passed in.
 */

import { describe, it, expect } from 'vitest';
import { ConditionToJsonLogicConverter } from 'rule-engine-monorepo/rule-engine';
import {
  createTrailingStopTemplate,
  trailingStopParamsMap,
} from '../../src/templates/trailingStop.js';
import { ActionType } from '../../src/domain/TradingEnums.js';

describe('trailingStop', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Factory validation — distance
  // ──────────────────────────────────────────────────────────────────────────

  it('should create a valid RuleTemplate with distance only (no activation)', () => {
    const template = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } });
    expect(template).toBeDefined();
    expect(template.condition).toBeDefined();
    expect(template.actions.length).toBeGreaterThan(0);
  });

  it('should create a valid RuleTemplate with distance and activation', () => {
    const template = createTrailingStopTemplate({
      distance: { value: 0.5, unit: 'R' },
      activation: { value: 1, unit: 'R' },
    });
    expect(template).toBeDefined();
    expect(template.condition).toBeDefined();
    expect(template.actions.length).toBeGreaterThan(0);
  });

  it('should accept independent units for distance and activation', () => {
    const template = createTrailingStopTemplate({
      distance: { value: 0.3, unit: 'price' },
      activation: { value: 1, unit: 'R' },
    });
    expect(template).toBeDefined();
  });

  it('should throw when distance.value is 0', () => {
    expect(() =>
      createTrailingStopTemplate({ distance: { value: 0, unit: 'R' } }),
    ).toThrow(/distance\.value/i);
  });

  it('should throw when distance.value is negative', () => {
    expect(() =>
      createTrailingStopTemplate({ distance: { value: -0.1, unit: 'R' } }),
    ).toThrow(/distance\.value/i);
  });

  it('should throw when distance.unit is invalid', () => {
    expect(() =>
      createTrailingStopTemplate({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        distance: { value: 0.5, unit: 'pips' as any },
      }),
    ).toThrow(/distance\.unit must be one of/i);
  });

  it('should throw when distance is not a Measurement object', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createTrailingStopTemplate({ distance: 0.5 as any }),
    ).toThrow(/distance/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Factory validation — activation
  // ──────────────────────────────────────────────────────────────────────────

  it('should throw when activation.value is 0', () => {
    expect(() =>
      createTrailingStopTemplate({
        distance: { value: 0.5, unit: 'R' },
        activation: { value: 0, unit: 'R' },
      }),
    ).toThrow(/activation\.value/i);
  });

  it('should throw when activation.value is negative', () => {
    expect(() =>
      createTrailingStopTemplate({
        distance: { value: 0.5, unit: 'R' },
        activation: { value: -1, unit: 'R' },
      }),
    ).toThrow(/activation\.value/i);
  });

  it('should throw when activation.unit is invalid', () => {
    expect(() =>
      createTrailingStopTemplate({
        distance: { value: 0.5, unit: 'R' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activation: { value: 1, unit: 'pips' as any },
      }),
    ).toThrow(/activation\.unit must be one of/i);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // isRecurring — the phare property
  // ──────────────────────────────────────────────────────────────────────────

  it('should have isRecurring === true', () => {
    const template = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } });
    expect(template.isRecurring).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Action shape
  // ──────────────────────────────────────────────────────────────────────────

  it('should emit a MOVE_STOP_LOSS action with newStopPrice: { var: "trailingNewSL" }', () => {
    const template = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } });
    const action = template.actions[0];
    expect(action.actionRef).toBe(ActionType.MOVE_STOP_LOSS);
    expect(action.parameters.newStopPrice).toEqual({ var: 'trailingNewSL' });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Condition shape — unit-agnostic, always trailingShouldExecute
  // ──────────────────────────────────────────────────────────────────────────

  it('should have a condition referencing trailingShouldExecute (R distance)', () => {
    const template = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } });
    const jsonLogic = ConditionToJsonLogicConverter.convert(template.condition);
    expect(JSON.stringify(jsonLogic)).toContain('trailingShouldExecute');
  });

  it('should have the same condition field for percent and price distances', () => {
    const tPct = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'percent' } });
    const tPrice = createTrailingStopTemplate({ distance: { value: 0.3, unit: 'price' } });
    expect(JSON.stringify(ConditionToJsonLogicConverter.convert(tPct.condition))).toContain(
      'trailingShouldExecute',
    );
    expect(JSON.stringify(ConditionToJsonLogicConverter.convert(tPrice.condition))).toContain(
      'trailingShouldExecute',
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // WeakMap registration — stores exact Measurement objects
  // ──────────────────────────────────────────────────────────────────────────

  it('should register the exact distance Measurement in trailingStopParamsMap', () => {
    const distance = { value: 0.5, unit: 'percent' as const };
    const template = createTrailingStopTemplate({ distance });
    const stored = trailingStopParamsMap.get(template);
    expect(stored).toBeDefined();
    expect(stored!.distance).toEqual({ value: 0.5, unit: 'percent' });
    expect(stored!.activation).toBeUndefined();
  });

  it('should register both distance and activation when activation provided', () => {
    const template = createTrailingStopTemplate({
      distance: { value: 0.3, unit: 'price' },
      activation: { value: 1, unit: 'R' },
    });
    const stored = trailingStopParamsMap.get(template);
    expect(stored).toBeDefined();
    expect(stored!.distance).toEqual({ value: 0.3, unit: 'price' });
    expect(stored!.activation).toEqual({ value: 1, unit: 'R' });
  });

  it('should omit activation when not provided', () => {
    const template = createTrailingStopTemplate({ distance: { value: 0.5, unit: 'R' } });
    const stored = trailingStopParamsMap.get(template);
    expect(stored).toBeDefined();
    expect(stored!.activation).toBeUndefined();
  });
});
