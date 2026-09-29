# M0 完了報告（求人マップ／コード名 WORKLENS）

作成日：2026-09-28（2026-09-29 追記：§10）　対象ブランチ：`claude/job-search-m0-implementation-sk1wtc`

M0（架空データで動く主要画面の完成）を実装しました。実求人の取得・公開、本番課金、デプロイ、クラウド契約は行っていません。表示している求人・企業・金額はすべて架空です。

## 1. 実装した範囲

| ID | 画面・機能 | URL | 状態 |
|---|---|---|---|
| S01 | ホーム（検索フォーム・職種8分類・比較の説明・最近の求人・データの扱い） | `/` | 実装 |
| S02 | 検索一覧（キーワード・勤務地・共通条件・職種専用条件・給与単位・並び替え・20件ページング・比較トレー・スマホのボトムシート） | `/jobs` | 実装 |
| S03 | 職種ハブ（専用条件ショートカット・比較のポイント・求人の抜粋・空ハブ） | `/occupations/[slug]` | 実装 |
| S04 | 求人詳細（facts_link／full_authorized、給与内訳、他の掲載元、PCのstickyサマリー、スマホの固定CTA、掲載終了・非公開） | `/jobs/[id]` | 実装 |
| S05 | 比較（最大3件、違いだけ表示、対象外、列ごとの削除・保存・元ページ） | `/compare?ids=` | 実装 |
| S06 | 保存（localStorageにIDのみ、保存順・情報確認順、掲載終了・非公開の最小表示） | `/saved` | 実装 |
| S07 | 訂正・削除の申請・お問い合わせ（受付番号、CSRF・レート制限・スパム対策。サービスへの問い合わせは対象の求人なしで送信可） | `/report?jobId=` | 実装（申請内容は保存・送信しない） |
| S08 | 運営会社・収集方針・情報の取扱い・利用規約 | `/about` `/sources` `/privacy` `/terms` | 運営会社は確定情報。ほかは草案（法務確認前） |
| A01/A02 | ソース一覧・詳細（公開停止／再開・収集ON/OFF・表示方式・審査条件・操作履歴） | `/admin/sources` `/admin/sources/[id]` | デモ（このブラウザのCookieに保存） |
| B01 | 採用ご担当者へ（訂正・停止の案内、広告は準備中） | `/employers` | 非課金の案内のみ |
| API | `GET /api/jobs` `GET /api/jobs/:id` `GET /api/jobs/lookup` `GET /api/compare` `POST /api/reports` `GET /out/:listingId` 管理API | — | 実装（fixture） |

デモ帯（「画面確認用デモ／求人・企業・金額はすべて架空」）は全ページに常時表示しています。A03〜A05、B02〜B03 は M1〜M3 の範囲です。

## 2. 構成

```
apps/web/          Next.js 16 App Router（画面・公開API・管理デモ・e2e）
packages/domain/   型・Zodスキーマ・給与/職種条件ルール・公開ゲート・検索・SEO判定（フレームワーク非依存）
packages/data/     Repositoryインターフェイスとfixture実装（M1でDB/検索エンジン実装に差し替え）
config/ contracts/ fixtures/ prototype/ docs/   受け取った仕様パッケージ（fixturesに端境ケース・架空ソース・PRを追加）
index.html script.js styles.css                 既存のLP（変更なし）
```

## 3. 起動方法

リポジトリのフォルダ（`package.json` のある場所）で、1行ずつ実行します。手元のMacでの準備（Node.js・リポジトリの取得・フォルダへの移動）と画面のURLの一覧は README.md の「手元のMacで画面を見る」にあります。

```bash
npm ci
```

```bash
npm run dev
```

- ブラウザで http://localhost:3000 を開きます。本番ビルドで確認する場合は `npm run build` のあと `npm run start`、全チェックは `npm run check`（lint → typecheck → unit → build → e2e）です。
- 環境変数は任意です（`apps/web/.env.example` を `apps/web/.env.local` にコピーして変更。既定値のままで起動できます）。
- Node.js は 22 系を推奨します（24・26 系でも起動を確認済み。`npm ci` で EBADENGINE の警告が出ます）。
- 外部サービスのキーは不要です。e2e は Playwright の Chromium を使います（未導入なら `npx playwright install chromium`）。
- 管理画面デモは `/admin/sources` →「デモ管理者としてログイン」。操作はそのブラウザだけに反映され、「デモの操作をリセット」で戻せます。
- DB・検索エンジン・workerのスクリプト（`db:migrate` `db:seed:demo` `worker`）は M1 で追加します（M0では未実装）。

## 4. 実行したコマンドと結果（最終実行）

| コマンド | 結果 |
|---|---|
| `npm run lint` | 3ワークスペースともエラー・警告なし |
| `npm run typecheck` | エラーなし（`next typegen` → `tsc --noEmit`） |
| `npm run test` | 120件成功（domain 82・data 21・web 17） |
| `npm run build` | 成功（Next.js 16.3.6 / Turbopack） |
| `npm run test:e2e` | 104件成功（PC 1440×900・スマホ 375×812 のChromium。axe-coreによるWCAG A/AA自動検査11画面×2を含む） |
| REL01 手動確認 | `APP_ENV=production DATA_MODE=demo next start` → 起動前検査で終了（exit 1）。`ENABLE_BILLING=true` も終了（exit 1） |

e2e は M0 の最終変更の前に3回連続で全件成功しました。2026-09-29 の追記後も `npm run check`（lint → typecheck → unit → build → e2e）が全件成功しています。

## 5. 画面の検証サイズ

375・390・768・1440px で主要10画面（ホーム、検索、条件付き検索、詳細、職種ハブ、比較、保存、申請、管理一覧、管理詳細）を撮影し、40通りすべてでページ全体の横はみ出しなし・JavaScriptエラーなしを確認しました（比較表は表の中だけ横スクロール）。375pxと1440pxは画像を目視確認しています。

## 6. 受入テストの対応（docs/05_DELIVERY_ACCEPTANCE.md）

| ID | 対応 | 検証 |
|---|---|---|
| UI01〜UI12 | 実装 | e2e（全件）＋一部は単体テスト |
| DATA02 | 給与の単位なし・逆転を公開の給与フィルターに入れない判定まで | 単体。抽出後のreview振り分けはM1 |
| DATA06・DATA07 | 掲載終了は検索・CTAから除外、stale は終了と断定せず注意表示 | 単体・e2e。HTTP 404/410/500 の判定はM1 |
| DATA08・DATA09・DATA10 | 実装 | 単体・e2e |
| DATA01・03〜05・11〜15 | 未実装（収集・抽出・重複管理は M1） | — |
| SEC02・SEC04 | 実装（公開画面のエスケープと危険URLの拒否、管理APIの認可） | 単体・e2e。管理画面での原文プレビュー（A03）はM1 |
| SEC01・SEC03 | 未実装（M0はサーバー側の外部取得・LLMなし） | — |
| OPS01 | デモ実装（このブラウザのソース停止を検索・詳細・保存・比較・API・外部遷移に即時反映） | e2e。キャッシュ層はまだない |
| OPS03 | 実装（レート制限・CSRF・申請内容をログに出さない） | 単体・e2e |
| OPS02 | 未実装（再取得時のtombstoneはM1） | — |
| SEO01〜SEO04 | 実装（デモは全ページnoindex、JobPostingは許可・必須項目・フラグが揃う場合だけ） | 単体・e2e |
| BILL01 | GET `/out` は常に課金対象外 | e2e |
| BILL02〜BILL08 | 未実装（M3） | — |
| REL01・REL02 | 実装 | 単体・e2e・起動確認 |

## 7. 実データを使った範囲

なし。すべて架空fixture（`.example` ドメイン）で、実サイトへのアクセスはしていません。`config/source_registry.example.json` の実ソース候補は初期OFFのまま、審査記録がないため管理画面からも有効化できません。

## 8. 未実施・既知の制約

- M1以降：PostgreSQL・Meilisearch・Redis/BullMQ、収集worker、HTML/JSON-LD抽出、重複管理、再取得時のtombstone、SSRF対策の取得層、管理のA03〜A05、正式な認証・RBAC・監査ログ。
- 管理画面デモの状態はブラウザのCookie、レート制限と受付記録はプロセス内メモリです（複数プロセス・再起動で共有・保持されません）。
- 検索性能目標（10万件で p95 800ms）は未計測（fixtureは36 listing・公開表示32件）。
- 仕様ではWebフォントを同梱しない方針のため、日本語フォントは端末依存です。
- GitHub Actions のCIは課金の可能性があるため追加していません（承認後に `npm run check` を実行するワークフローを追加できます）。

## 9. 本番公開の前に必要な外部設定（2026-09-29 時点）

| 項目 | 状態 |
|---|---|
| ブランド名・ドメイン | 「求人マップ」・kyujinmap.jp に決定し画面に反映。ドメインは取得済み、商標はこれから出願 |
| 運営会社・所在地・問い合わせ窓口 | 株式会社プロセント（Prosent,Inc.）／〒104-0054 東京都中央区勝どき1-3-1-43F／電話番号 03-6732-9992 を表示。問い合わせの主な窓口は申請・お問い合わせフォーム。英文社名の表記揺れ（Prosent,Inc.／Prosent.Inc／株式会社Prosent）の確認が必要 |
| 利用規約・情報の取扱い・収集方針 | 草案を作成（法務確認前）。施行日を `SITE.legal` に設定すると草案表示が外れる。保存期間・委託先と保存国は本番の構成に合わせて確定 |
| 運営会社のプライバシーポリシー | リリース前に更新する（利用目的の具体的な記載、共用の問い合わせ先、社名表記の統一、委託先と保存先の国、外部送信の扱い） |
| 募集情報等提供事業の届出 | 出願中。受理番号を `SITE.notification.number` に設定すると運営会社のページに表示 |
| ホスティング・DB・検索・キュー・バックアップ・エラー通知 | 推奨構成を設計（docs/07）。契約・設定は未実施 |
| 実ソースの審査記録 | 形式・検査・3件の下書き（いずれも保留）を作成（docs/08、config/source_reviews）。ハローワークは電話番号の掲示を解消済みで、本番UAでの robots の再取得・対象パス・取消の反映手順・法務確認が残る |
| `ADMIN_SESSION_SECRET` と正式な管理者認証 | M1 |
| アクセス解析 | 導入する場合は送信項目・保存期間を決め、/privacy に記載してから |
| 広告の契約・料金・請求 | M3（料金・違約金・解除方法の書面等での事前明示が必要） |

詳細な判断は `docs/DECISIONS_LOG.md` に記録しています。

## 10. 2026-09-29 の追記（運営情報・規約・インフラ・ソース審査）

- 画面：サイト名「求人マップ」とデモ表示、運営会社・所在地（電話番号なし）、運営会社のプライバシーポリシーへのリンク、canonical（`SITE_URL`、既定 https://kyujinmap.jp）、本番の robots.txt への sitemap の記載、ハローワーク経由の求人を含むページの「このページの運営事業者」。
- ページ：利用規約（全17条・草案）、求人マップにおける情報の取扱い（利用目的・保存期間・Cookie・外部送信・委託）、収集方針に収集・更新の頻度・表示順の主な要素・収集用 User-Agent（KyujinMapBot）・苦情の窓口を追加。
- 申請フォーム：「サービスについてのお問い合わせ（個人情報の取扱い・広告掲載を含む）」を追加。対象の求人なしで送信できる。
- ソース審査：`sourceReviewSchema`・`reviewPolicyViolations`（packages/domain）、審査記録 `config/source_reviews/`（ハローワーク・エンゲージ・ATS の下書きと記入例）、ソース設定が審査の範囲内であることの単体テスト（packages/data）。
- インフラ：docs/07（Vercel 東京＋Supabase 東京＋Meilisearch Cloud JPN＋Upstash 固定プラン＋Fly.io 東京の worker＋Sentry＋S3 東京、月 $110〜250 の概算）。Node.js の指定を `22.x` に変更。
- 電話番号（03-6732-9992）をフッターと運営会社のページに表示（ハローワーク求人の転載条件の1つを満たす）。ドメインは取得済み、商標はこれから出願、運営会社のプライバシーポリシーはリリース前に更新。
- Node.js 24・26（npm 12）でも `npm ci`・lint・単体テスト・ビルド・`npm run dev` の全画面表示を確認（EBADENGINE の警告のみ）。
