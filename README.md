# Deadlock Build Optimizer

A mobile-first React app that turns local Deadlock aggregate analytics into hero builds. It opens on Infernus, displays two deterministic item paths, offers an item detail sheet, and compares Infernus recommendations against a held-out Zergggy sample.

## Run it

```sh
npm install
npm run fetch-data
npm run generate-builds
npm run dev
```

`npm run build` compiles the static app. After the snapshots are downloaded, the app and production build do not make network requests for data. Item art, hero portraits, and each hero's four ability icons are stored in `public/assets/`; the UI itself has no remote font or API dependency.

## Data snapshots

`npm run fetch-data` saves files under `public/data/`:

- `items.json`: priced shop upgrade assets plus ability assets for real ability names (the live API currently returns 247 shopable upgrades with an image asset).
- `heroes.json`: active, selectable heroes.
- `analytics.json`: per-hero item stats and the top 500 aggregate ability sequences by match count.
- `permutation-stats.json`: up to 2,500 highest-support two-item combinations per hero (the API is queried with a 1,000-match minimum to keep the offline snapshot compact).
- `zergggy-infernus-matches.json`: eligible Infernus match history for account `35187362`.
- `zergggy-infernus-purchases.json`: item purchase events from metadata-backed eligible matches.
- `snapshot-meta.json`: fetch time and source counts.
- `generated-builds.json`: written by `npm run generate-builds` from aggregate snapshots only.

The collector pauses between API requests, retries transient errors, requests metadata with `is_custom=false`, and excludes tutorial/test modes. It retains normal matchmaking matches even when the history endpoint marks their outcome unscored; those matches count at baseline weight, and only known wins receive the win bonus. The latest fetch (2026-10-03) captured purchase metadata for the 30 most recent eligible Infernus matches.

## Build scoring

`src/generator.ts` is the deterministic generator. It reads only the item catalog, hero assets, and aggregate analytics snapshots. It does not import or inspect either Zergggy snapshot. `src/validation.ts` is the only module that reads the held-out purchase snapshot.

Each purchasable upgrade is scored from aggregate win rate, item usage, phase-specific hero pick and win rates when available, stat value per soul, profile affinity, tier, and timing. Stable item-ID tie breaks keep output deterministic. Infernus paths seed supported recurring hero items first, then fill from scored candidates under a larger 32,000-soul allowance; other heroes keep profile-specific budgets and item selection. Buy order uses aggregate average buy time within early/mid/late phases. Running soul totals are recomputed in that final order. Ability order uses the most-played aggregate ability sequence (stable match-count tie break), annotates first points as unlocks, and later points as tier upgrades; it is padded to 16 points when the live sequence is shorter.

No weights were tuned against Zergggy’s outcomes or item choices. Build variants are category profiles: Gun Pressure boosts weapon/fire-rate/bullet cues; Spirit Ignition boosts spirit, burn, ability, and cooldown cues.

## Held-out validation

The validation step runs after the build list exists. An item is in Zergggy’s **core set** when it appears in at least **30% of sampled matches**. Per-match duplicate purchases count once; wins receive 1.35 weight and losses 1.0 for the displayed weighted frequency. Items below the threshold are labeled OTHER and treated as experiments, so they do not enter the core set.

Agreement is `70% × Jaccard item overlap + 30% × pairwise buy-order agreement` for shared core items. The score is a report of how the aggregate-data generator did, not a source used to choose builds. The current report uses 30 recent metadata-backed matches.

## Judgment calls

- “Active hero” means selectable, enabled, not in development, and marked `release` by the assets API.
- For the numeric match-history fields, the collector keeps game mode 1 and matchmaking mode values 1/2/4; it skips other modes (including tutorial/test value 7). It also asks the metadata endpoint for non-custom games. Unscored normal matches are retained at baseline validation weight.
- The current API calls its all-items endpoint `v1/assets/items`; all priced `upgrade` records with a slot and the ability assets are retained. The collector downloads shop images and hero portraits into `public/assets/` so the app remains illustrated offline.
- The two build profiles use the same transparent scoring function with different kit/property affinity. Non-Infernus heroes receive the same generic weapon/spirit profiles and their own aggregate ability sequences.
- No personal match history, item preferences, or player-specific outcomes feed build scoring.
- When current aggregate ability-order data has fewer than 16 point allocations, the sequence is extended using the highest-match aggregate sequence cyclically (or a stable 0/2/1/3 fallback if none exists).

## Layout and accessibility

The shop build uses tier-marked item cards grouped by early, mid, and late game, with color-coded weapon, spirit, and vitality art. The ability order is a four-row point timeline using each hero's actual ability icons; the timeline scrolls horizontally on narrow screens. Lower panels stack at phone widths. Item cards, hero picker options, carousel controls, and item detail controls are buttons. Item details are an accessible dialog with visible close/back controls.
