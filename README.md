# Order Report — Refactoring Legacy

Rapport de commandes (legacy) refactoré : parsing CSV, calculs métier (remises, taxe, livraison), génération de rapport texte et JSON.

---

## Installation

### Prérequis

- **Node.js** version 18.x ou 20.x (LTS recommandé)
- **npm** version 9.x ou 10.x (livré avec Node.js)

### Commandes

```bash
# Cloner le dépôt (si besoin)
git clone https://github.com/MarieG56/order-report-refactoring.git
cd order-report-refactoring

# Installer les dépendances
npm install
```

---

## Exécution

### Exécuter le code refactoré

```bash
# Version JavaScript (recommandé)
node src/orderReport.js

# Ou via npm (exécute la version JS)
npm run legacy
```

Le rapport s’affiche dans la console et `legacy/output.json` est généré dans `legacy/`. Le code refactoré est dans **`src/`**. TypeScript : `npx ts-node src/orderReport.ts`.

### Exécuter les tests

```bash
# Tous les tests (Golden Master + unitaires)
npm test

# Uniquement le test Golden Master
npm run test:golden

# Uniquement les tests unitaires
npm run test:unit

# Mode watch (relance les tests à chaque modification)
npm run test:watch
```

### Comparer avec le legacy (validation)

La sortie du code refactoré (`src/orderReport.js`) est validée **caractère par caractère** contre la sortie du script legacy original :

1. **Référence** : `legacy/expected/report.txt` (générée à partir du script legacy, ex. `legacy/orderReportLegacyOriginal.js` ou `legacy/orderReportLegacy.js`).
2. Le test Golden Master exécute le code refactoré et compare sa sortie à ce fichier.
3. Si les sorties diffèrent, le test échoue.

```bash
# Lancer la comparaison (via le test Golden Master)
npm run test:golden

# Régénérer la référence après modification des CSV dans legacy/data/
npm run generate-golden
```

---

## Choix de Refactoring

### Problèmes identifiés dans le legacy

1. **God function / fonction monolithique** : Une seule fonction `run()` lisait tous les CSV, faisait tous les calculs, construisait le rapport et écrivait en console et en fichier.
   - Impact : code difficile à tester, à faire évoluer et à déboguer.

2. **Duplication du parsing CSV** : Chaque fichier (customers, products, orders, etc.) était parsé avec une boucle et un `split(',')` légèrement différents.
   - Impact : risque d’incohérences et de bugs à chaque évolution du format.

3. **Magic numbers et constantes éparpillées** : Taux, seuils et plafonds (TAX, SHIPPING_LIMIT, 0.03 pour le bonus matin, etc.) étaient en dur dans le code.
   - Impact : changements métier coûteux et risque d’erreurs.

4. **I/O et logique métier mélangés** : Lecture de fichiers, calculs et écriture (console + JSON) étaient entremêlés dans la même fonction.
   - Impact : impossibilité de tester la logique sans effets de bord (fichiers, console).

5. **Typage inexistant (TypeScript)** : Types `any` pour Customer, Order, Product, etc.
   - Impact : pas d’autocomplétion ni de détection d’erreurs à la compilation.

### Solutions apportées

1. **Extraction de fonctions par responsabilité** : Une fonction par chargeur (loadCustomers, loadProducts, loadOrders, etc.), une par calcul (computeVolumeDiscount, computeTax, computeShipping, etc.), et une pour la construction du rapport (buildReport).
   - Justification : tests unitaires ciblés, lisibilité et évolution du code plus simples.

2. **Parsing CSV centralisé** : Module `src/csvParser.js` (et `.ts`) : `parseCsv(filePath, fsx)` et `parseCsvSafe(filePath, fsx)` ; les loaders reçoivent `fsx` et mappent les colonnes vers les objets métier. Abstraction `fsx` pour I/O testable.
   - Justification : un seul point de vérité pour le format, gestion propre des fichiers optionnels (ex. promotions).

3. **Objet CONFIG** : Toutes les constantes métier (taux, seuils, paliers) regroupées dans `src/config.js` et `src/config.ts`, partagées par le module principal et `discountCalculator`.
   - Justification : évolution des règles sans toucher à la logique, possibilité d’injection pour les tests.

4. **Séparation I/O / logique** : Abstraction filesystem (`createNodeFileSystem()` en JS, `FileSystem`/`NodeFileSystem` en TS) ; `run(baseDir, deps)` accepte `deps.fsx` optionnel. Toute lecture/écriture passe par `fsx`.
   - Justification : `buildReport()` et les calculs sont testables sans fichier ni console.

5. **Version TypeScript avec interfaces** : Fichiers dans `src/` (`orderReport.ts`, `csvParser.ts`, `config.ts`, `discountCalculator.ts`) avec interfaces Customer, Order, Product, ShippingZone, Promotion, CustomerTotals, ReportJsonRow, FileSystem, Logger.
   - Justification : typage explicite, meilleure maintenabilité et base pour une évolution future.

### Architecture choisie

- **Code refactoré dans `src/`** ; **code legacy inchangé dans `legacy/`** (données, script original, référence Golden Master).
- **Modules dans `src/`** :
  - **config.js / config.ts** : constantes métier (CONFIG).
  - **csvParser.js / csvParser.ts** : `parseCsv`, `parseCsvSafe` (lecture et découpage des CSV, avec abstraction `fsx`).
  - **discountCalculator.js / discountCalculator.ts** : `getPromoDiscount`, `computeVolumeDiscount`, `computeLoyaltyDiscount`, `applyDiscountCap`.
  - **orderReport.js / orderReport.ts** : loaders (`loadCustomers`, `loadProducts`, etc.), `computeLoyaltyPoints`, `buildTotalsByCustomer`, `computeTax`, `computeShipping`, `computeHandling`, `getCurrencyRate`, `round2`, `buildReport`, `run(baseDir, deps)`.
- **Rôle de `run(baseDir, deps)`** : enchaînement chargement (via `fsx`) → calculs → rapport → écriture fichier (via `fsx`) ; retourne le texte. `deps.fsx` optionnel pour isoler l’I/O en test.
- **Flux** : Données CSV (via `fsx`) → loaders → structures en mémoire → calculs → rapport (texte + JSON) → sortie console + fichier (via `fsx`).

### Exemples concrets

**Exemple 1 : Parsing CSV**

- Problème : quatre boucles similaires avec `split(',')` et indices numériques.
- Solution : module `src/csvParser.js` avec `parseCsv(filePath, fsx)` qui retourne les lignes (sans en-tête) ; chaque loader reçoit `fsx` et utilise ces lignes en mappant explicitement par nom de champ.

**Exemple 2 : Remises et plafond**

- Problème : calcul des remises volume et fidélité + plafond global noyés dans la grosse boucle de rapport.
- Solution : `computeVolumeDiscount(subtotal, level, firstOrderDate)`, `computeLoyaltyDiscount(points)`, `applyDiscountCap(volumeDisc, loyaltyDisc)` ; le rapport appelle ces fonctions et affiche les montants.

**Exemple 3 : Testabilité**

- Problème : impossible de tester un calcul sans exécuter tout le script et lire des fichiers.
- Solution : fonctions pures exportées (`computeVolumeDiscount`, `computeTax`, etc.), `buildReport()` sans I/O, et `run(baseDir, { fsx })` pour injecter un filesystem factice ; les tests unitaires appellent ces fonctions avec des entrées fixées.

---

## Limites et Améliorations futures

### Ce qui n’a pas été fait (par manque de temps)

- [ ] Utilisation d’une librairie CSV (ex. `csv-parse`) pour gérer les guillemets et virgules dans les champs.
- [ ] Fichiers de configuration externes (JSON/YAML) pour CONFIG au lieu d’un objet dans le code.
- [ ] Tests d’intégration avec plusieurs jeux de données (petits/gros volumes, cas limites).
- [ ] Découpage plus poussé (ex. `loaders/`, `report/` en sous-modules) ; le découpage actuel (`csvParser`, `config`, `discountCalculator`, `orderReport`) est déjà en place.

### Compromis assumés

- **Code refactoré dans `src/`** : plusieurs modules (`orderReport`, `csvParser`, `config`, `discountCalculator`) en JS et en TS ; le legacy reste intact dans `legacy/` pour la référence et les données.
- **Comportement legacy préservé à l’identique** : règles métier (paliers, bonus week-end, plafonds) et “bugs” intentionnels du legacy sont conservés pour que le test Golden Master reste vert.
- **Double implémentation JS + TS** : les deux versions sont maintenues en parallèle dans `src/` ; une migration progressive vers le seul TypeScript serait plus propre à long terme.

### Pistes d’amélioration future

- Migrer entièrement vers TypeScript et supprimer la version JS une fois les tests et la CI stabilisés.
- Introduire un vrai module de parsing CSV et des schémas de validation (ex. Zod) pour les entrées.
- Exposer `run(baseDir, deps)` et les loaders pour permettre des rapports sur d’autres répertoires (CLI avec argument `--data-dir`).
- Ajouter une sortie HTML ou PDF en plus du texte et du JSON.
