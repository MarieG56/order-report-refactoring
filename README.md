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
# Version JavaScript (recommandé pour le rapport)
node legacy/orderReportLegacy.js

# Version TypeScript
npm run legacy
```

Le rapport s’affiche dans la console et `legacy/output.json` est généré dans le dossier `legacy/`.

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

La sortie du code refactoré est validée **caractère par caractère** contre la sortie du script legacy original :

1. **Référence** : `legacy/expected/report.txt` (générée à partir de `legacy/orderReportLegacyOriginal.js`).
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

2. **Parsing CSV centralisé** : `parseCsv(filePath)` et `parseCsvSafe(filePath)` pour tous les fichiers ; les loaders ne font que mapper les colonnes vers les objets métier.
   - Justification : un seul point de vérité pour le format, gestion propre des fichiers optionnels (ex. promotions).

3. **Objet CONFIG** : Toutes les constantes métier (taux, seuils, paliers) regroupées dans un objet `CONFIG` en tête de fichier.
   - Justification : évolution des règles sans toucher à la logique, possibilité d’injection pour les tests.

4. **Séparation I/O / logique** : `run()` appelle loaders → calculs → `buildReport()` ; le texte retourné est affiché et le JSON écrit uniquement dans le bloc `require.main === module` (ou équivalent).
   - Justification : `buildReport()` et les calculs sont testables sans fichier ni console.

5. **Version TypeScript avec interfaces** : Fichier `orderReportLegacy.ts` avec interfaces Customer, Order, Product, ShippingZone, Promotion, CustomerTotals, ReportJsonRow.
   - Justification : typage explicite, meilleure maintenabilité et base pour une évolution future.

### Architecture choisie

- **Un seul module principal** (`legacy/orderReportLegacy.js` / `.ts`) pour rester proche du legacy tout en le découpant en fonctions.
- **Rôle des blocs** :
  - **CONFIG** : constantes métier.
  - **parseCsv / parseCsvSafe** : lecture et découpage des CSV.
  - **loadCustomers, loadProducts, loadShippingZones, loadPromotions, loadOrders** : chargement des données vers des structures métier.
  - **computeLoyaltyPoints, buildTotalsByCustomer** : agrégation et calculs par ligne (promos, bonus matin).
  - **computeVolumeDiscount, computeLoyaltyDiscount, applyDiscountCap, computeTax, computeShipping, computeHandling, getCurrencyRate** : calculs purs (remises, taxe, livraison, devise).
  - **buildReport** : construction du texte et du tableau JSON (sans I/O).
  - **run(baseDir)** : enchaînement chargement → calculs → rapport → écriture fichier ; retourne le texte (affiché côté appelant).
- **Flux** : Données CSV → loaders → structures en mémoire → calculs → rapport (texte + JSON) → sortie console + fichier.

### Exemples concrets

**Exemple 1 : Parsing CSV**

- Problème : quatre boucles similaires avec `split(',')` et indices numériques.
- Solution : `parseCsv(filePath)` retourne les lignes (sans en-tête) ; chaque loader utilise ces lignes et mappe explicitement par nom de champ.

**Exemple 2 : Remises et plafond**

- Problème : calcul des remises volume et fidélité + plafond global noyés dans la grosse boucle de rapport.
- Solution : `computeVolumeDiscount(subtotal, level, firstOrderDate)`, `computeLoyaltyDiscount(points)`, `applyDiscountCap(volumeDisc, loyaltyDisc)` ; le rapport appelle ces fonctions et affiche les montants.

**Exemple 3 : Testabilité**

- Problème : impossible de tester un calcul sans exécuter tout le script et lire des fichiers.
- Solution : fonctions pures exportées (`computeVolumeDiscount`, `computeTax`, etc.) et `buildReport()` sans I/O ; les tests unitaires appellent ces fonctions avec des entrées fixées.

---

## Limites et Améliorations futures

### Ce qui n’a pas été fait (par manque de temps)

- [ ] Utilisation d’une librairie CSV (ex. `csv-parse`) pour gérer les guillemets et virgules dans les champs.
- [ ] Fichiers de configuration externes (JSON/YAML) pour CONFIG au lieu d’un objet dans le code.
- [ ] Tests d’intégration avec plusieurs jeux de données (petits/gros volumes, cas limites).
- [ ] Découpage en plusieurs modules (par ex. `loaders/`, `calculators/`, `report/`) au lieu d’un seul fichier.

### Compromis assumés

- **Un seul fichier refactoré** : le découpage est logique (fonctions) mais tout reste dans `orderReportLegacy.js` / `.ts` pour limiter la divergence avec le legacy et faciliter la comparaison Golden Master.
- **Comportement legacy préservé à l’identique** : règles métier (paliers, bonus week-end, plafonds) et “bugs” intentionnels du legacy sont conservés pour que le test Golden Master reste vert.
- **Double implémentation JS + TS** : les deux versions sont maintenues en parallèle ; une migration progressive vers le seul TypeScript serait plus propre à long terme.

### Pistes d’amélioration future

- Migrer entièrement vers TypeScript et supprimer la version JS une fois les tests et la CI stabilisés.
- Introduire un vrai module de parsing CSV et des schémas de validation (ex. Zod) pour les entrées.
- Exposer `run(baseDir)` et les loaders pour permettre des rapports sur d’autres répertoires (CLI avec argument `--data-dir`).
- Ajouter une sortie HTML ou PDF en plus du texte et du JSON.
