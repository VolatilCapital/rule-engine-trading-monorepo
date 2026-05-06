# @volatil/rule-engine-trading-testkit

Harness d'intégration pour tester les règles de trading contre un broker simulé (`@volatil/simulated-platform`).

## Exécution

```bash
# Depuis la racine du monorepo
pnpm --filter @volatil/rule-engine-trading-testkit test

# Toute la suite
pnpm --filter @volatil/rule-engine-trading-testkit test:run
```

Build préalable si le code source a changé :

```bash
pnpm --filter @volatil/rule-engine-trading-testkit build
```

Type-check :

```bash
pnpm --filter @volatil/rule-engine-trading-testkit exec tsc --noEmit
```

## Ajouter un scénario

Créer un fichier `__tests__/scenarios/<nom>.scenario.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { scenario } from '../../src/dsl/scenario.js';
import { createMonTemplate, ActionType } from '@volatil/rule-engine-trading';

describe('monTemplate', () => {
  it('devrait faire X quand Y', async () => {
    const sc = scenario('description lisible')
      .platform({ symbol: 'EURUSD', leverage: 100, balance: 10_000 })
      .openPosition({ side: 'BUY', volume: 0.1, entry: 1.0500, sl: 1.0480 })
      .attachRule(createMonTemplate({ param1: 1 }))
      .priceTo(1.0520)
      .expectStopLossAt(1.0500)
      .expectActionExecuted(ActionType.MOVE_STOP_LOSS);

    await sc.run();

    // Assertions fines post-`run()` via le harness exposé :
    expect(sc.harness!.executedActions.filter(a => a.actionRef === '...')).toHaveLength(1);
  });
});
```

### DSL disponible

| Méthode | Rôle |
|---|---|
| `.platform({ symbol, leverage, balance })` | Configure le broker simulé |
| `.openPosition({ side, volume, entry, sl?, tp? })` | Ouvre une position de marché |
| `.attachRule(template)` | Attache un template de règle |
| `.priceTo(price)` | Drive le prix et évalue toutes les règles attachées |
| `.expectStopLossAt(price)` | Assert le SL courant |
| `.expectTakeProfitAt(price)` | Assert le TP courant |
| `.expectActionExecuted(actionType)` | Assert qu'au moins 1 action du type donné a été exécutée |
| `.run()` → `Promise<void>` | Exécute la séquence, throw si une assertion échoue |

Après `.run()`, `sc.harness` expose le `RuleScenarioHarness` sous-jacent pour les assertions fines (comptage d'actions, état de position, etc.).

## Limites connues (v1)

### Build / dépendances

- **`peerDependencies` `@volatil/simulated-platform` en wildcard `*`** — pnpm rejette les URLs GitHub en peerDep. La peerDep garde la sémantique documentaire ; la dépendance réelle est résolue par la devDep.
- **`devDependency` en `link:../../../simulated-platform-monorepo/...`** — non portable en CI. À migrer vers `github:VolatilCapital/simulated-platform-monorepo` ou un vrai package npm avant v2.

### TestActionExecutor

- **`PLACE_ORDER` général** — seul le cas `type: 'close_position'` est branché sur le broker. Tout autre type d'ordre est loggé sans exécution réelle.
- **`SCALE_OUT` / `START_TRAILING_STOP`** — non mappés (pas d'API broker correspondante dans `SimulatedPlatformPosition`).

### Harness / Calculs

- **Calcul du R** — `(currentPrice - entry) / (entry - SL)` valide uniquement pour les positions BUY. À inverser pour SELL.
- **`elapsedMinutes`** — basé sur `Date.now()` réel. Les templates time-based (`timeBasedStop`) nécessitent `vi.useFakeTimers()` ou une clock injectable.
- **Convention prix `bid = ask = price`** — spread zéro. Déterministe mais ne teste pas les scénarios spread-dépendants.
- **`patterns` context** — champ vide. Les templates pattern-based (`patternBasedExit`) nécessitent une injection de détection de patterns.
- **`attachRule(params)`** — le paramètre `params` n'est pas transmis au template. Les templates reçoivent tous leurs paramètres via leur factory (ex: `createMoveSLToBreakevenTemplate({ thresholdR: 1 })`).

## Templates couverts en v1

| Template | Scénario | Fichier |
|---|---|---|
| `moveSLToBreakeven` | SL → breakeven à +1R, garde-fou re-trigger | `moveSLToBreakeven.scenario.test.ts` |
| `takePartial` (TAKE_PARTIAL_1R_50PCT) | 50% de close à +1R | `takePartial.scenario.test.ts` |
| `maxDrawdownFromPeak` (MAX_DD_2R_PEAK_1R_DD) | Close sur drawdown 1R depuis pic 2R | `maxDrawdownFromPeak.scenario.test.ts` |

## Templates restants (v2)

| Template | Factory | Spécificité |
|---|---|---|
| `takeProfit` | `createTakeProfitTemplate` | Close à un seuil R cible |
| `freeTrade` | `createFreeTradeTemplate` | Partial close pour récupérer le risque initial |
| `lockInProfitStop` | `createLockInProfitStopTemplate` | SL en 2 paliers (triggerR → lockInR) |
| `timeBasedStop` | `createTimeBasedStopTemplate` | Close si profit min non atteint dans le temps — nécessite mock clock |
| `patternBasedExit` | `createPatternBasedExitTemplate` | Sortie sur pattern de bougie — nécessite injection patterns |
| `cancelPendingOnPriceLevel` | `createCancelPendingOnPriceLevelTemplate` | Annule ordre en attente si prix d'invalidation touché — nécessite pending orders |
| `partialCloseAtPrice` | `createPartialCloseAtPriceTemplate` | Partial close à un prix absolu (non R-based) |
| `takePartial` (variantes supplémentaires) | `TAKE_PARTIAL_2R_50PCT`, `TAKE_PARTIAL_1R_33PCT`, etc. | Même mécanique, seuils différents |
