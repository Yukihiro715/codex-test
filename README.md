# WORKLENS（開発仮称）

職種ごとに必要な条件をそろえて、公開求人を横断比較できる求人検索サービスです。現在は **M0：架空データで動く主要画面** の段階で、表示している求人・企業・金額はすべて架空です。実データの取得・応募受付・請求は行いません。

- 仕様：`CLAUDE.md`（実装ルール）→ `START_HERE.md` → `docs/01〜06`
- M0の完了報告（範囲・テスト結果・未実施）：`docs/M0_REPORT.md`
- 判断の記録：`docs/DECISIONS_LOG.md`

## 起動

```bash
npm ci                 # Node.js 22.22 以上（.nvmrc）
npm run dev            # http://localhost:3000
```

本番ビルドで確認する場合は `npm run build && npm run start`。環境変数は `apps/web/.env.example` を参照してください（既定値のままで起動できます）。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run lint` | ESLint（全ワークスペース） |
| `npm run typecheck` | TypeScript（strict） |
| `npm run test` | 単体テスト（Vitest） |
| `npm run test:e2e` | e2e・受入テスト（Playwright、本番ビルドを起動して実行） |
| `npm run check` | 上記すべて＋ビルド |

e2e には Playwright の Chromium が必要です（`npx playwright install chromium`）。

## 構成

```
apps/web/          Next.js App Router（画面・公開API・管理画面デモ・e2e）
packages/domain/   型・スキーマ・給与/職種条件ルール・公開ゲート・検索（フレームワーク非依存）
packages/data/     Repositoryとfixture実装（M1でDB・検索エンジンに差し替え）
config/            職種定義・デザイントークン・収集元レジストリ（例）
contracts/         型契約（packages/domain が互換性を型検査）
fixtures/          架空の求人・ソース・PR（本番掲載禁止）
prototype/         画面プロトタイプ（視覚の参考）
docs/              仕様・判断ログ・M0報告
```

管理画面デモは `/admin/sources` から「デモ管理者としてログイン」で開けます（操作はそのブラウザだけに反映）。

## このリポジトリの既存ファイル

ルート直下の `index.html` `script.js` `styles.css` は、以前から置かれている別のランディングページ（静的HTML）です。WORKLENS とは独立しており、変更していません。
