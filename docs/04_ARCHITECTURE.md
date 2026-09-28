# 04｜技術・データ・処理設計

## 1. 推奨構成
本項は設計提案。新規構築はNext.js App Router + TypeScript strict + Tailwind CSS、UIプリミティブはshadcn/ui相当。Node.jsは実装時の現行LTSと依存の互換性を確認して固定する。Next.js公式の現行初期設定を参照し、過去の設定を推測で流用しない。[S10]

APIはNext.jsのRoute Handlerで開始。PostgreSQLを正本とし、Meilisearchで日本語検索と絞り込みを提供。収集/抽出/索引更新はWebリクエストから切り離したNode worker、Redis + BullMQを利用。Meilisearchのfilterable/sortable設定は明示し、設定変更時はtask完了を待つ。[S11]

M0は同じRepositoryインターフェイスに対するfixture実装。M1でDB/検索/workerを差し替える。ローカルはDocker ComposeでDB/Redis/検索を起動。クラウドの契約・本番構成は本仕様で勝手に確定しない。

LLMはモデル非依存のExtractionProvider。APIキー未設定ならルール抽出のみ。モデルの名称・価格は仮で固定しない。LLMを検索の必須経路にせず、構造化データ/ルールを優先する。

## 2. 想定ディレクトリ
```
apps/web/                  # 求職者UI、公開API、管理UI
apps/worker/               # 収集、抽出、終了判定、検索投影
packages/domain/           # 型、スキーマ、policy gate、給与/資格ルール
packages/data/             # DB、repository、検索adapter
packages/ui/               # 共通UI
config/                    # 職種・source scope・design tokens
fixtures/                  # 架空の求人/HTML/失敗ケース
infra/                     # ローカルCompose
```
小規模な既存repoではモノレポ化を強制せず、同じ責務をフォルダで分けてもよい。

## 3. 正本データモデル
### Source / SourceScope / SourceReview
Sourceは運営元単位、SourceScopeはhost/path/企業単位。クロール上限はhostでも共有する。Reviewはterms URL/hash、robotsの状態、レーン、判断根拠、判断者、有効期限、利用可能フィールドを記録。

policyは `fetch_allowed`、`storage_mode`、`display_mode`、`public_enabled`、`seo_index_allowed`、`jobposting_allowed`、`image_allowed`、`commercial_promotion_allowed` を分離。公開レーンと契約状態を混同しない。

### Employer
id、表示名、正規化名、法人番号（確認できる場合のみ）、公式URL、住所の必要範囲、公式URLの確認根拠。社名だけで同一企業と断定しない。

### SourceListing（ソース上の募集1件）
source scope、source job ID、canonical URL、元の募集職種、employer、occupation、locations[]、employmentTypes[]、salary、facts、sourcePostedAt、firstSeenAt、lastFetchedAt、lastChangedAt、validThrough、state、contentHash、evidence refs。

### JobCluster（横断的な同一募集の束）
複数SourceListingを束ねる。元の求人と出典は失わない。雇用先・職種・勤務地・雇用形態・勤務条件・求人番号を照合し、初期は保守的に重複判定。紹介会社が異なる、給与が矛盾する、勤務地が異なる場合は無理に合体しない。

### FieldEvidence / ExtractionRun
field、value、元ページhash、取得日時、抽出手法、根拠位置、必要最小限の根拠、review状態。LLM confidenceは確率としてユーザーへ表示しない。原文を保持できない場合はフィールドの出典・ハッシュを残し、根拠の再確認が難しい条件は限定表示。

### CrawlRun / FetchAttempt
日時、URL、HTTP status、robots判定、取得サイズ、ETag/Last-Modified、解析状態、失敗原因、再試行予定、source policy version。機密や原稿全文は通常ログに入れない。

### Report / Suppression / AuditLog
訂正/削除の依頼、対象範囲、暫定停止、処理結果、再取得抑止。URLとsource job ID、必要な企業scopeにtombstoneを保持する。

### 広告関連（M3）
Advertiser、AuthorityVerification、Agreement、Campaign、CampaignJob、AdImpression、ClickEvent、LedgerEntry、Invoice。
課金クリックは元の求人とは別の台帳で記録。請求額の通貨はJPYの整数。税抜/税込は別フィールド。広告契約と求人の掲載権限を区別する。

## 4. 状態遷移
Source：`unreviewed → sample_only → active → paused/review_required → blocked`
SourceListing：`discovered → fetched → parsed → review_required/eligible → published → stale/expired/suppressed`
`published`への移行条件：source public enabled、表示根拠、必須事実項目、鮮度、矛盾なし、削除対象でない。ソース側がactiveでも個別求人の公開は独立判定。

expiredは募集終了、staleは確認できない状態。404/410は終了候補として即非表示。単なるHTTP 500で募集終了と断定しない。期限が存在せずページも残っている求人は、取得成功だけで無期限の募集継続保証を付けない。

## 5. 収集パイプライン
1. 登録済みscopeとpolicyを読む。
2. URLのscheme/host/path、DNS、robots、レート、再試行時刻を判定。
3. HTTP条件付き取得。20秒timeout、レスポンス上限5MBを初期値とする。
4. HTML/JSON-LDを解析。`@graph`、配列、複数JobPostingを扱う。
5. 正規化。給与・資格・勤務地はルール検査。
6. 足りない項目だけLLM抽出。モデルにrawページ内の指示を実行させない。
7. 矛盾チェック→人のレビューまたは公開候補。
8. SourceListingと証跡をトランザクション保存。
9. 公開可能フィールドだけのPublicJobProjectionを作る。
10. 検索indexを更新し、非同期taskの完了と失敗を記録。

リトライは冪等。`source_scope_id + source_job_id`を一意、IDがない場合は正規化URLを採用。クエリ削除はsource固有ルールで行い、求人IDがqueryに入るサイトを壊さない。

## 6. セキュリティ・外部コンテンツ
- 管理APIのURL指定をそのままfetchしない。HTTP(S)以外、localhost、private/reserved/link-local IP、メタデータサービス、ユーザー情報付きURLを拒否。
- DNS解決後、接続先IPと各redirect先も検査。未知hostへのredirectは再審査。
- 自社外部遷移もDBに登録済みdestinationだけを使い、任意URLへのopen redirectを作らない。
- 原稿中のscript、HTML event handler、危険なURLは実行しない。管理プレビューもsandbox化。
- 外部APIキーはworker側だけ。NEXT_PUBLICに入れない。
- 外部原稿はプロンプトインジェクションの入力。JSON Schema外の出力やtool要求を拒否。
- 管理UIと広告主UIにサーバ側RBAC。隠したボタンだけでアクセス制御しない。

## 7. 抽出と正規化の必須ルール
salary：amountMin/Max、currency、unit、basis、fixedOvertime。単位不明はUNKNOWN。賞与や夜勤回数を推測して年収化しない。base payと総支給例を混ぜない。

資格：required/preferred/none_stated/unknownを区別。「介護福祉士必須」から「資格不要」を生成しない。「看護師または准看護師」と「看護師かつ運転免許」のOR/AND関係を保持する。

勤務：day_only/night_shift/on_call/remote/hybridは独立項目。日勤求人でもオンコールがあり得るため同一条件にしない。

住所：企業本社ではなく実勤務地。複数勤務地を複数求人として水増ししない。完全在宅と一部在宅を区別。

未記載：falseでなくnull。明記された「なし」と記載なしを分ける。選択した条件に不明の求人を紛れ込ませない。

## 8. 公開API
| Method / Path | 役割 | 注意 |
|---|---|---|
| GET /api/jobs | 検索、facet、ページング | queryをZod等で検証、最大limit制限 |
| GET /api/jobs/:id | 公開projection | raw bodyや許可外フィールドを返さない |
| GET /api/compare?ids=... | 最大3件の比較 | 各求人の公開状態を再検査 |
| POST /api/reports | 訂正/削除 | レート制限、入力検査、受付ID |
| POST /api/outbound | 明示クリックを記録して遷移 | サーバ管理のdestination、idempotency |
| GET /out/:id | JSなしの無料遷移 | GETは計測補助のみ、課金しない |
| GET/POST /api/admin/sources | source管理 | 認可、監査、公開/停止の分離 |
| POST /api/admin/sources/:id/pause | 停止 | 公開拒否フラグを先に書き込む |
| POST /api/admin/review/:id | 条件訂正 | 元値と変更根拠を監査保存 |

検索は非同期indexの結果をそのまま返さず、候補job IDsの公開状態/停止フラグをDBまたは即時denylistで再チェックする。停止済み求人がキャッシュに残ってもユーザーへ漏らさない。source停止後の再index処理で復活しないようpolicy versionを照合する。

## 9. クリック課金設計（M3）
初期は固定CPC＋予算で開始し、オークションは不要。単価は契約データから取得し、clientの金額を信用しない。

手順：広告表示時にcampaign/job/policy version/expiry/nonceを署名した短命tokenを発行→ユーザーの明示操作でPOST→token、求人、契約、期間、予算、重複、不正兆候を検査→DB transactionで残予算を確保し台帳記帳→固定の登録URLへ303 redirect。

free clickの場合は請求台帳へ入れない。GET・prefetch・crawler・広告主自身のテストはbillable=false。同じidempotency keyは同一結果を返す。重複クリックの窓は契約で定義し、初期案は同じsession/job/campaignの30分以内を除外。IPだけで個人を決めつけない。

予算切れでは課金しない。求人自体を無料として掲載する場合はPR枠から外す。短時間の競合リクエストでも予算上限を超えないtransactionテストを必須にする。

serverの303送出は応募完了や相手ページ到達の保証ではない。契約上の課金地点を「有効な外部遷移操作」と定義し、到達保証型と混同しない。後日判明した不正クリックはledgerの相殺で対応し、過去記録を破壊的に書き換えない。

## 10. 計測と個人情報
初期イベント：search_submitted、filter_applied、job_viewed、saved_toggled、compare_opened、outbound_clicked、report_submitted。
属性：job ID、source ID、occupation、page、位置、PR区分、フィルターのコード。自由記述検索はPIIを含む可能性があるため標準analyticsへそのまま送らない。元URLに個人情報・トークンがある場合も除去。

保存はjob IDを端末内だけに保つ。通知、メール、個人化推薦、履歴書収集は初期OFF。機能を追加する場合は特定募集情報等提供事業の届出や個人情報の取扱いを再確認する。[S07]

Cookie規制・第三者解析ツールへのデータ送信は導入前に確認。M0は外部analyticsなし。クリックの不正防止情報は必要最小限、HMAC等を用い、raw IPの長期保有を既定にしない。保存期間を設定し、法定保管対象になる請求書等は別の保存ルールで管理。

## 11. SEO
- facts_link求人は初期noindex。サイト内検索には利用できる。
- 検索queryの組合せページは原則noindex。公開する職種/地域ハブはallowlist。
- JobPostingは1求人の詳細に限定し、承認/必要情報/表示内容/期限/応募導線を検査。baseSalaryはGoogleの雇用主向け指定条件を確認し、第三者集約の初期出力からは外す。[S05]
- canonical、公開日、lastmodを偽装しない。AIで類似説明を量産して固有ページと装わない。[S06]
- 自社サイトのrobotsは検索エンジンがnoindexを読み取れるよう設計し、robots遮断とnoindexを無計画に併用しない。

## 12. ローカル実行・CI
Claude Codeは次のscriptsを実装：`dev` `build` `lint` `typecheck` `test` `test:e2e` `db:migrate` `db:seed:demo` `worker`。実装していないコマンドを起動方法として書かない。

`.env.example`にダミー値と説明を入れ、キーは含めない。`DATA_MODE=demo`、`ENABLE_LIVE_CRAWL=false`、`ENABLE_BILLING=false`、`ENABLE_JOBPOSTING=false`が初期値。NODE_ENVだけでfixture混入防止を判定せず、本番起動時のfixture存在検査を入れる。

CIはunit/integration/e2e/build。ネットワークテストとfixtureテストを分離し、CIから勝手に外部サイトへ連続アクセスしない。