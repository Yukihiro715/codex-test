# M0 完了報告（WORKLENS 開発仮称）

作成日：2026-09-28　対象ブランチ：`claude/job-search-m0-implementation-sk1wtc`

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
| S07 | 訂正・削除の申請（受付番号、CSRF・レート制限・スパム対策） | `/report?jobId=` | 実装（申請内容は保存・送信しない） |
| S08 | 運営者・収集方針・プライバシー・利用規約（草案） | `/about` `/sources` `/privacy` `/terms` | 草案 |
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

```bash
npm ci                                  # Node.js 22.22 以上
cp apps/web/.env.example apps/web/.env.local   # 任意（既定値で起動可能）
npm run dev                             # http://localhost:3000
npm run build && npm run start          # 本番ビルドで起動
npm run check                           # lint → typecheck → unit → build → e2e
```

- 外部サービスのキーは不要です。e2e は Playwright の Chromium を使います（未導入なら `npx playwright install chromium`）。
- 管理画面デモは `/admin/sources` →「デモ管理者としてログイン」。操作はそのブラウザだけに反映され、「デモの操作をリセット」で戻せます。
- DB・検索エンジン・workerのスクリプト（`db:migrate` `db:seed:demo` `worker`）は M1 で追加します（M0では未実装）。

## 4. 実行したコマンドと結果（最終実行）

| コマンド | 結果 |
|---|---|
| `npm run lint` | 3ワークスペースともエラー・警告なし |
| `npm run typecheck` | エラーなし（`next typegen` → `tsc --noEmit`） |
| `npm run test` | 103件成功（domain 68・data 18・web 17） |
| `npm run build` | 成功（Next.js 16.3.6 / Turbopack） |
| `npm run test:e2e` | 85件成功（PC 1440×900・スマホ 375×812 のChromium。axe-coreによるWCAG A/AA自動検査9画面×2を含む） |
| REL01 手動確認 | `APP_ENV=production DATA_MODE=demo next start` → 起動前検査で終了（exit 1）。`ENABLE_BILLING=true` も終了（exit 1） |

e2e は最終変更の前に3回連続で全件成功し、最終の `npm run check` でも全件成功しています。

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

## 9. 本番公開の前に必要な外部設定

- 正式なブランド名・商標・ドメイン、運営法人名・所在地・電話番号・問い合わせ窓口（フッター・運営者情報は現在「未設定」表示）。
- 利用規約・プライバシー・収集方針の確定、募集情報等提供事業の届出要否の確認。
- ホスティング・DB・検索エンジン・キュー・バックアップ・エラー通知の契約と設定、`ADMIN_SESSION_SECRET` と正式な管理者認証。
- 実ソースごとの審査記録（規約・robots・取得範囲・表示範囲）とoperatorによる有効化。
- アクセス解析を導入する場合の送信項目・保存期間の決定。
- 広告の契約・料金・請求（M3）。

詳細な判断は `docs/DECISIONS_LOG.md` に記録しています。
