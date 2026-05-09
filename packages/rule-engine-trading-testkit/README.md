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
| `.setPatterns({ bearish?, bullish?, ... })` | Injecte des flags pattern dans le contexte des prochains ticks (remplace, ne fusionne pas) |
| `.advanceTime(minutes)` | Avance la clock du harness (requiert `.platform({ clock: new TestClock() })`) |
| `.placePendingOrder({ type: 'LIMIT' \| 'STOP', side, volume, price })` | Pose un ordre en attente sur le symbole ; expose `pendingOrderId` au contexte des prochains ticks |
| `.run()` → `Promise<void>` | Exécute la séquence, throw si une assertion échoue |

Après `.run()`, `sc.harness` expose le `RuleScenarioHarness` sous-jacent pour les assertions fines (comptage d'actions, état de position, etc.).

## Limites connues (v1)

### Build / dépendances

- **`peerDependencies` `@volatil/simulated-platform` en wildcard `*`** — pnpm rejette les URLs GitHub en peerDep. La peerDep garde la sémantique documentaire ; la dépendance réelle est résolue par la devDep.
- **`devDependency` en `link:../../../simulated-platform-monorepo/...`** — non portable en CI. À migrer vers `github:VolatilCapital/simulated-platform-monorepo` ou un vrai package npm avant v2.

### TestActionExecutor

- **`PLACE_ORDER` général** — seul le cas `type: 'close_position'` est branché sur le broker. Tout autre type d'ordre est loggé sans exécution réelle.
- **`SCALE_OUT` / `START_TRAILING_STOP` (deprecated)** — non mappés (pas d'API broker correspondante dans `SimulatedPlatformPosition`). `START_TRAILING_STOP` est remplacé par le template `trailing-stop` qui utilise `MOVE_STOP_LOSS` avec `isRecurring: true`.
- **`CANCEL_POSITION`** — polymorphe : annule la pending order si `context.pendingOrderId` est présent, sinon ferme la position via `closePosition(positionId)`. Les autres cas (`MOVE_STOP_LOSS`, `PARTIAL_CLOSE`, `PLACE_ORDER` close_position) requièrent `positionId` et retournent une erreur explicite sinon.

### Harness / Calculs

- **Calcul du R** — `(currentPrice - entry) / (entry - SL)` valide uniquement pour les positions BUY. À inverser pour SELL.
- **`elapsedMinutes`** — calculé via le port `Clock` injecté à `HarnessConfig`. Par défaut `systemClock` (Date.now). Pour les templates time-based (`timeBasedStop`), passer `clock: new TestClock()` puis utiliser `.advanceTime(minutes)` du DSL.
- **Convention prix `bid = ask = price`** — spread zéro. Déterministe mais ne teste pas les scénarios spread-dépendants.
- **`patterns` context** — peuplé via `.setPatterns({ ... })` sur le DSL ou `harness.setPatterns(...)`. Les templates pattern-based (`patternBasedExit`) lisent les flags via JsonLogic en notation pointée (ex: `patterns.bearish`).
- **`attachRule(params)`** — le paramètre `params` n'est pas transmis au template. Les templates reçoivent tous leurs paramètres via leur factory (ex: `createMoveSLToBreakevenTemplate({ thresholdR: 1 })`).
- **`lockInStopPrice_<R>R` pré-calculé** — le contexte expose `lockInStopPrice_0.5R`, `_1R`, `_1.5R`, `_2R`, `_2.5R`, `_3R`, `_4R`, `_5R` (BUY uniquement). Pour des R hors liste, étendre le tableau dans `RuleScenarioHarness#buildContext`.
- **`trailingNewSL` / `trailingShouldExecute`** — le contexte expose ces champs pour les règles trailing-stop. Le calcul est side-aware (BUY/SELL via signe de `riskPerUnit`), avec état d'activation mémorisé (une fois le seuil atteint, l'activation persiste). Les autres règles reçoivent `trailingShouldExecute = 0`, `trailingNewSL = NaN`.

## Templates couverts

| Template | Scénario | Fichier |
|---|---|---|
| `moveSLToBreakeven` | SL → breakeven à +1R, garde-fou re-trigger | `moveSLToBreakeven.scenario.test.ts` |
| `takePartial` (TAKE_PARTIAL_1R_50PCT) | 50% de close à +1R | `takePartial.scenario.test.ts` |
| `maxDrawdownFromPeak` (MAX_DD_2R_PEAK_1R_DD) | Close sur drawdown 1R depuis pic 2R | `maxDrawdownFromPeak.scenario.test.ts` |
| `takeProfit` | Close à +2R, garde-fou sous-seuil | `takeProfit.scenario.test.ts` |
| `freeTrade` (FREE_TRADE_2R) | Partial close 50% à +2R, garde-fou anti re-trigger | `freeTrade.scenario.test.ts` |
| `partialCloseAtPrice` | Partial close 30 % au prix cible BUY, garde-fou anti re-trigger | `partialCloseAtPrice.scenario.test.ts` |
| `lockInProfitStop` (LOCK_IN_3R_TO_1R) | Move SL pour locker +1R à +3R, garde-fou anti re-trigger | `lockInProfitStop.scenario.test.ts` |
| `takePartial` variantes (1R_33PCT, 2R_50PCT, 1R_25PCT, 2R_25PCT) | Variantes prédéfinies + composition 25 % à 1R puis 25 % du résiduel à 2R | `takePartialVariants.scenario.test.ts` |
| `patternBasedExit` (PATTERN_EXIT_LONG_BEARISH) | Close BUY sur `patterns.bearish=true`, garde-fou anti re-trigger, no-trigger sans pattern | `patternBasedExit.scenario.test.ts` |
| `timeBasedStop` (TIME_STOP_30MIN_1R) | Close BUY si pas +1R après 30 min, no-trigger sous délai, no-trigger si +1R atteint | `timeBasedStop.scenario.test.ts` |
| `cancelPendingOnPriceLevel` | Annule pending LIMIT BUY si prix franchit le niveau d'invalidation, garde-fou anti re-trigger | `cancelPendingOnPriceLevel.scenario.test.ts` |
| `trailingStop` | Trailing stop 0.5R (BUY/SELL, activation optionnelle, récurrence) — 8 scénarios | `trailingStop.scenario.test.ts` |

**Tous les templates publics sont couverts.** 12 templates / 13 fichiers de scénarios (smoke inclus) / 33 tests.
