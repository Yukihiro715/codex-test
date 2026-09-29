# 求人マップ（kyujinmap.jp）

運営：株式会社プロセント。リポジトリ内のコード名は WORKLENS（パッケージ名 `@worklens/*`）です。

職種ごとに必要な条件をそろえて、公開求人を横断比較できる求人検索サービスです。現在は **M0：架空データで動く主要画面** の段階で、表示している求人・企業・金額はすべて架空です。実データの取得・応募受付・請求は行いません。

- 仕様：`CLAUDE.md`（実装ルール）→ `START_HERE.md` → `docs/01〜06`
- M0の完了報告（範囲・テスト結果・未実施）：`docs/M0_REPORT.md`
- 判断の記録：`docs/DECISIONS_LOG.md`
- インフラの推奨構成：`docs/07_INFRASTRUCTURE.md`
- 実ソースの審査記録の運用と現状：`docs/08_SOURCE_REVIEWS.md`（記録は `config/source_reviews/`）

## 手元のMacで画面を見る

ユーザー向けの画面と管理画面（デモ）は、同じ1つのWebアプリに入っています。

1. Node.js を用意します。ターミナルで `node -v` を実行し、`v22.` で始まれば次へ進みます。入っていない・古い場合は https://nodejs.org/ja/download から 22 系を入れます（24・26 系でも起動しますが、`npm ci` のときに EBADENGINE の警告が出ます）。
2. このリポジトリを手元に置きます。GitHub のリポジトリの画面でブランチ `claude/job-search-m0-implementation-sk1wtc` を選び、「Code」→「Download ZIP」で保存して展開します（git を使う場合は `git clone` のあと `git switch claude/job-search-m0-implementation-sk1wtc`）。
3. ターミナルで、展開したフォルダに移動します。ダウンロードフォルダに展開した場合は、次の1行を実行します（`cd` とフォルダの場所は必ず同じ行に書きます）。

```bash
cd ~/Downloads/codex-test-claude-job-search-m0-implementation-sk1wtc
```

   別の場所に展開した場合は、`cd ` と入力して（cd の後ろに半角スペース）、Enter を押さずに Finder からフォルダをターミナルへドラッグし、そのあと Enter を押します。`ls` で `package.json` が見えれば正しい場所です。
4. 次の2つを1行ずつ実行します。

```bash
npm ci
```

```bash
npm run dev
```

5. ブラウザで http://localhost:3000 を開きます。止めるときはターミナルで Control + C を押します。

`npm ci` はホームフォルダ（`~`）など、`package.json` のない場所で実行すると失敗します。3000番ポートを別のアプリが使っている場合は、`cd apps/web` のあと `npx next dev --port 3001` で起動し、http://localhost:3001 を開きます。

### 画面のURL（`npm run dev` の実行中）

| 画面 | URL |
|---|---|
| ホーム | http://localhost:3000/ |
| 求人を探す | http://localhost:3000/jobs |
| 求人の詳細（例） | http://localhost:3000/jobs/demo-driver-1 |
| 職種から探す（例） | http://localhost:3000/occupations/driver |
| 比較（例） | http://localhost:3000/compare?ids=demo-driver-1,demo-driver-2,demo-driver-3 |
| 保存した求人 | http://localhost:3000/saved |
| 訂正・削除の申請・お問い合わせ | http://localhost:3000/report |
| 運営会社・利用規約・情報の取扱い・収集方針・採用ご担当者へ | `/about` `/terms` `/privacy` `/sources` `/employers` |
| ログイン・会員登録（デモ） | http://localhost:3000/login （どのボタンでも架空の会員としてログイン） |
| マイページ（デモ） | http://localhost:3000/mypage |
| 管理画面（デモ）：ソース一覧・詳細 | http://localhost:3000/admin/sources （「デモ管理者としてログイン」を押す） |

本番ビルドで確認する場合は `npm run build` のあと `npm run start`。環境変数は `apps/web/.env.example` を参照してください（既定値のままで起動できます）。

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
config/            職種定義・デザイントークン・収集元レジストリ（例）・ソース審査記録（source_reviews/）
contracts/         型契約（packages/domain が互換性を型検査）
fixtures/          架空の求人・ソース・PR（本番掲載禁止）
prototype/         画面プロトタイプ（視覚の参考）
docs/              仕様・判断ログ・M0報告・インフラ設計・審査記録の運用
```

管理画面デモは `/admin/sources` から「デモ管理者としてログイン」で開けます（操作はそのブラウザだけに反映）。

## このリポジトリの既存ファイル

ルート直下の `index.html` `script.js` `styles.css` は、以前から置かれている別のランディングページ（静的HTML）です。求人マップとは独立しており、変更していません。
