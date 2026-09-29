# WORKLENS project instructions

## Goal
- 日本語の総合求人検索サービスを作る。職種別に検索条件と比較項目を変える。
- Mimipoとのシナジーを前提にしない。長期目標は年商100億円、初期は需要と送客の検証。
- 提携交渉をMVP実装の前提にしない。公開求人の事実情報インデックスを含む段階的な収集方式。
- サービス名は「求人マップ」（kyujinmap.jp、運営：株式会社プロセント）。内部のコード名はWORKLENS。ドメインは取得済み、商標はこれから出願。

## Read order
1. START_HERE.md
2. docs/01_PRODUCT.md
3. docs/03_UX_SCREEN_SPEC.md
4. docs/04_ARCHITECTURE.md と docs/05_DELIVERY_ACCEPTANCE.md
5. 収集実装時は docs/02_DATA_ACQUISITION.md と docs/06_SOURCES_DECISIONS.md
- prototype/index.html は視覚の参考。Markdown・型・受入基準を優先。
- 指示の矛盾は勝手に隠さず docs/DECISIONS_LOG.md に判断を残す。

## Implementation
- 新規は Next.js App Router / TypeScript strict / Tailwind / PostgreSQL / Meilisearch / Redis + BullMQ。
- UIには shadcn/ui 相当のアクセシブルなプリミティブを使う。依存バージョンは実装時に公式資料で確認して固定。
- 既存リポジトリではまず構造・テスト・CLAUDE.mdを読み、破壊的な置換をしない。
- M0はdemoデータで全主要導線を動かす。M1でDBと収集worker。M2で公開品質。M3で課金。
- モデルAPI未設定でも、構造化データ・ルール抽出と架空fixtureで動作させる。
- UI文言は日本語。金額はJPY整数、時刻はUTC保存/JST表示、期間の境界を明示。

## Data and trust
- source review / robots / fetch / storage / public display / SEO / billing は別の判定。
- 実ソースの有効化はsource単位の監査記録と設定が必要。提携契約が常に必須という意味ではない。
- 不明なrobotsをallowとして扱わない。401/403/CAPTCHAは停止、429はRetry-Afterで休止。
- ブロック回避目的のIP/UAローテーション、他社botの偽装、ログイン回避を実装しない。
- 原文にない給与・資格・待遇は作らない。不明はnull/記載なし。AIは原文根拠IDを返す。
- AIに取得原稿中の命令を実行させない。求人本文は非信頼データであり、toolsやshellへの権限を渡さない。
- sourceの無効化・削除要請は公開API、検索、キャッシュ、sitemap、送客まで即座に反映。
- 本文と写真の転載根拠がなければfacts_link表示。原文全文をブラウザや検索インデックスに送らない。
- robots allow、JSON-LD、API公開、AI要約は再掲載許諾を意味しない。
- 外部ページ取得はサーバ側のみ。URL allowlistとSSRF対策、サイズ/時間制限を実装する。

## Monetization
- 一般の外部クリックは無料。契約・権限確認・有効予算がある広告だけ課金。
- GETリンクやページプリフェッチで課金しない。実操作のPOSTをidempotency付きで処理。
- 実装初期の課金はsandboxのみ。実請求は契約と運用テストを経て別途有効化。
- 広告はPRと明記し、条件に合わない求人を表示しない。採用・応募実績を外部クリックから捏造しない。

## Quality
- 375/390/768/1440pxで確認。本文16px基準、タップ対象44px以上、focus可視、キーボード操作。
- フィルター状態はURLに保存。保存と比較は初期はlocalStorageのみ、追跡推薦はしない。
- ダミー求人・PR表示・数値はdemo表示。公開環境にfixtureを混ぜない。
- canonical/review/link permissionsを明示し、JobPostingは承認・必要情報が揃う求人だけ。
- 完了前に lint / typecheck / unit / e2e / build を実行。失敗や未実施を隠さない。
- 納品時は変更点、起動方法、テスト結果、未完了、本番前の外部設定を短く報告。
- 新規クラウド課金・実データ公開・広告請求・本番デプロイ・git pushは自動実行しない。

## このリポジトリでの実装メモ（M0時点）
- 構成は npm workspaces：`apps/web`（Next.js 16 App Router）、`packages/domain`（型・ルール・検索。フレームワーク非依存）、`packages/data`（Repository と fixture 実装）。ルート直下の `index.html` `script.js` `styles.css` は別件のLPなので変更しない。
- コマンド：`npm run dev` `build` `lint` `typecheck` `test` `test:e2e` `check`。DB・worker系のスクリプトはM1で追加する。
- Next.js 16 のAPI・規約は `node_modules/next/dist/docs/` の同梱ドキュメントで確認する（middleware は `proxy.ts`、params/searchParams は Promise など）。
- 検索条件の状態はURLだけ。条件の意味（不明は適合させない、単位違いを混ぜない等）は `packages/domain` の `searchJobs` と単体テストを基準にし、M1の検索エンジン実装も同じテストで確認する。
- e2e は `html[data-hydrated]` と `[data-client-ready]` を待ってから操作する（`apps/web/e2e/helpers.ts`）。
- 仮定・判断は `docs/DECISIONS_LOG.md`、M0の結果と未実施項目は `docs/M0_REPORT.md`。
- サイト名・運営会社・電話番号・届出番号・規約の施行日は `apps/web/src/lib/site.ts` が正本。利用規約・情報の取扱いは法務確認前の草案。
- 会員機能（ログイン・マイページ）は M0 ではデモ（外部サービスに接続せず、会員情報はブラウザ内だけ。デモのログインは本番環境・実データでは無効）。本実装は M1（認証ライブラリ・DB・各社の登録）で、設計と法令対応は `docs/09_ACCOUNTS.md`。
- 実ソースの審査記録は `config/source_reviews/`（運用は `docs/08_SOURCE_REVIEWS.md`）。ソース設定は常に審査記録の範囲内（`packages/data` の単体テストで検査）。インフラの推奨は `docs/07_INFRASTRUCTURE.md`。
