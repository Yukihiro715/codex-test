# 07｜インフラ設計（推奨）

確認日：2026-09-29。価格はUSD・税別で、各社の公式ページ・公式の価格表で確認した時点の値です（為替・税は含みません）。「概算」は公式の単価に稼働時間を掛けた見積もりです。アカウント作成・契約・課金・デプロイは行っていません（CLAUDE.md：新規クラウド課金・本番デプロイは人の判断で行う）。

## 1. 結論：検証期（M1〜M2）の推奨構成

東京に集約し、運用の手間が少ないマネージドサービスを中心にします。PostgreSQL を正本にし、検索インデックスとキューはいつでも作り直せる前提にします。

| 役割 | 推奨 | 選んだ理由 | 月額の目安 |
|---|---|---|---|
| Web（Next.js 16） | Vercel Pro。Functions のリージョンを東京 `hnd1` に変更 | Next 16 の `proxy.ts`・キャッシュ無効化にそのまま対応。停止・削除をキャッシュまで即時に反映しやすい。Hobby は非商用に限られるため使えない | $20〜40 |
| DB（PostgreSQL） | Supabase Pro（東京 `ap-northeast-1`）、Small から | 東京にあり、標準の PostgreSQL なので将来 RDS へ移しやすい。日次バックアップ7日を含む | $25〜30（PITR を足すと +$100） |
| 検索 | Meilisearch Cloud（`JPN` リージョン）、XS から | 運用不要。日本語は `localizedAttributes` に `jpn` を指定する。リージョンは作成後に変更できない | $23〜60 |
| キュー（BullMQ 用 Redis） | Upstash の固定プラン 250MB（東京） | BullMQ はキューが空でも定期的にアクセスするため、従量課金は割高（公式も固定プランを推奨）。eviction は既定で無効 | $10 |
| worker（収集・抽出・索引） | Fly.io 東京 `nrt` に常駐1台（shared-cpu-2x・4GB）＋固定の送信元 IPv4 | 東京で安く、Playwright（Chromium）を載せられる。送信元IPを固定すると、取得先に対して身元を明らかにできる（IP を変えて回避しない方針と合う） | $30〜45 |
| エラー監視 | Sentry Developer（複数人になったら Team）。まずサーバー側だけ | Next.js 公式の SDK。データの保存先（US/EU）は作成時に選び、後から変えられない | $0〜26 |
| 死活監視 | UptimeRobot Free（5分間隔） | 現行の規約で商用利用が可能 | $0 |
| バックアップの保管 | AWS S3 東京 | 国内に保存できる | $1〜3 |
| メール（M2 後半。申請への返信用） | Amazon SES 東京 | 国内リージョン、DKIM に対応。本番利用には申請が必要 | $0〜5 |
| 合計 | | | 約 $110〜250/月 |

さらに費用を抑える場合は、worker・Redis・Meilisearch を Fly.io 東京の1〜2台で自分で運用すると約 $60〜100/月になります（障害対応・更新・バックアップを自分で持つため、検証期には勧めません）。

### 採用しなかったもの
- Neon：東京リージョンがない。
- Railway・Render：東京リージョンがない（アジアはシンガポールのみ）。
- AWS App Runner：新規の受付を終了。
- Koyeb：東京はあるが、2026年2月の買収発表後に提供基盤の移行が予定されており、長期利用に不確実性がある。
- Vercel 上での BullMQ worker：関数は要求駆動で、実行時間の上限（Pro で800秒）があり、常駐処理に向かない。
- ElastiCache Serverless：`maxmemory-policy` を変えられず、BullMQ の要件（`noeviction`）を満たせない。

## 2. 構成

```
利用者 ──HTTPS── Vercel（東京 hnd1）：画面・公開API・proxy.ts（管理画面の認可）
                   │ 読み取り（検索専用キー）        │ 読み書き（公開状態の再確認・申請の保存・outbox）
                   ▼                                  ▼
          Meilisearch Cloud（JPN）         Supabase PostgreSQL（東京）＝正本
                   ▲ 索引の更新                        ▲ │ outbox（再取得の指示など）
                   │                                  │ ▼
          Fly.io worker（東京 nrt・固定送信元IP）── Upstash Redis（東京）：BullMQ（ジョブIDだけ）
                   │ 共通の取得層（URL allowlist・SSRF対策・robots・ホスト単位のレート制限・サイズ/時間制限）
                   ▼
          取得先サイト（User-Agent：KyujinMapBot/0.1 (+https://kyujinmap.jp/sources)）

          夜間：pg_dump → S3 東京（暗号化・バージョニング・期限付き削除）
```

- 管理画面からの再取得・停止の指示は、Web から Redis に直接入れず、DB の outbox に書いて worker が拾います。Redis が止まっても Web は止まらず、停止（公開拒否フラグ）は DB に先に書き込みます（04 §8）。
- Redis のジョブには ID だけを入れ、原文の HTML や個人情報は入れません。
- 検索は Meilisearch の結果をそのまま返さず、候補の公開状態・停止フラグを DB で再確認します（04 §8）。検索インデックスは DB から作り直せるようにし、作り直しのスクリプトを M1 で用意します。
- 外部ページの取得は worker だけが行います（CLAUDE.md：サーバー側のみ）。Web からは取得しません。

## 3. 環境

| 環境 | 用途 | データ | 置き場所 |
|---|---|---|---|
| local | 開発 | demo（fixture） | 各自の端末 |
| preview | PR ごとの画面確認 | demo のみ（実データを入れない） | Vercel Preview（Deployment Protection で限定公開、noindex） |
| staging | 収集・抽出の検証、リリース前の確認 | live（承認済みソースの小範囲） | Vercel（別プロジェクト）＋Supabase・Meilisearch・Upstash・Fly は本番と別に作成 |
| production | 公開 | live | 上記の推奨構成 |

- `APP_ENV` で判定します（`NODE_ENV` では判定しない）。production で demo データを読み込むと起動を止めます（REL01、実装済み）。
- `SITE_URL` は環境ごとに設定します（静的に生成するページがあるため、ビルド時と実行時の両方に同じ値）。

## 4. バックアップと復旧

| 対象 | 方式 | 目標 |
|---|---|---|
| PostgreSQL | Supabase の日次バックアップ（7日）＋夜間の `pg_dump` を S3 東京へ（30日保持、バージョニング、期限付き削除） | 検証期：RPO 24時間・RTO 4時間 |
| PostgreSQL（広告の請求を始めたら） | PITR（最悪時の RPO 2分）を追加。請求台帳は法定の保存期間に合わせて別に保管 | RPO 5分・RTO 1時間 |
| Meilisearch | DB から作り直す（正本は DB）。週1回の dump は任意 | 作り直しの時間を計測して記録 |
| Redis | 失ってもよい設計（DB の outbox から再投入） | — |
| 審査記録・設定 | Git（config/source_reviews・source_registry） | — |

- 四半期に1回、staging に本番のバックアップを戻す復旧訓練を行い、手順と所要時間を記録します。
- 削除依頼の tombstone（URL・ソースの求人ID）はバックアップから戻したときも有効であるよう、復旧手順に「tombstone の再適用」を入れます。

## 5. 監視と通知

- エラー：Sentry をサーバー側（Route Handler・Server Component・worker）から始めます。
  - 申請フォームの内容・メールアドレス・IP アドレスは送らない設定にします（SDK の個人情報の送信を無効化し、サーバー側のスクラブも使う）。
  - ブラウザ側の SDK を入れると、利用者の端末から第三者への情報送信になり、電気通信事業法の外部送信規律に沿った公表が必要です。入れる場合は先に /privacy に送信先・送信内容・目的を記載します。
  - Next 16 と Turbopack で `proxy.ts` が自動で計装されない問題が報告されていたため（修正済みとされる）、導入時に proxy のエラーが届くことを確認します。
- 死活：トップ・検索API・求人詳細を5分間隔で確認。worker は「最後にジョブが成功した時刻」を DB に書き、一定時間更新がなければ通知します。
- 収集の健全性（管理画面 A01 に表示）：ソースごとの取得成功率、401/403/CAPTCHA（検知したらそのソースを自動停止）、429（Retry-After に従って休止）、抽出失敗、確認できない求人の件数。
- 通知先：まずメール。運用が複数人になったら Slack などを追加します。

## 6. セキュリティと秘密情報

- 秘密情報は Vercel と Fly.io の環境変数（secrets）に置き、リポジトリには置きません。Production と Preview の値を分けます。
- `ADMIN_SESSION_SECRET` は32バイト以上の乱数。M1 で正式な管理者認証（2要素認証つき）と権限（RBAC）・監査ログに置き換えます。
- DB は役割ごとにユーザーを分けます（Web：公開用の読み取りと申請の書き込み、worker：収集データの書き込み、管理：審査・停止）。
- Meilisearch は Web に検索専用のキーだけを渡します。
- worker の取得層は URL allowlist・SSRF 対策（プライベートIP・メタデータ用アドレスの拒否、リダイレクト先の再検査）・応答サイズと時間の上限を共通で持ちます（04・CLAUDE.md）。

## 7. デプロイと CI

- Vercel の Git 連携で、PR ごとに preview を作ります。本番への反映は手動で昇格させます（自動デプロイしない）。
- GitHub Actions で `npm run check` を PR ごとに実行します（非公開リポジトリでは実行時間が課金対象になりうるため、承認後に追加）。
- Node.js は `package.json` の `engines` を `"22.x"` にして固定しました（Vercel は範囲指定だと最新の 24.x に解決するため）。
- DB のマイグレーションは M1 で導入し、デプロイの前に実行します。

## 8. 個人情報・法令面の注意

- 推奨したサービスの多くは米国の事業者です（Vercel・Supabase・Upstash・Fly.io・Sentry）。保存先は可能な限り東京を選びますが、Sentry の保存先は US か EU だけです。
  - 個人情報保護法上の「外国にある第三者」への提供・委託の整理と、安全管理措置として公表する「外的環境の把握」（事業者の所在国・保存先の国）が必要です。/privacy の「業務の委託と保存場所」を本番公開前に確定します（法務確認）。
  - 各社のデータ処理契約（DPA）と利用規約を契約前に確認します。
- 無料枠の商用可否：Vercel Hobby は非商用のみ、Better Stack の無料枠は個人プロジェクト向けの表記、UptimeRobot は現行の規約で商用可。

## 9. 成長期（月間数百万訪問）の構成

Web は Vercel のまま、データ基盤を AWS 東京に移します。

| 役割 | 構成 | 月額の目安 |
|---|---|---|
| Web | Vercel Pro（必要に応じて Enterprise）＋CDN の上位ティア＋固定IP | $250〜700 |
| DB | RDS for PostgreSQL（または Aurora）Multi-AZ＋読み取りレプリカ、PITR 最大35日 | $400〜700 |
| Redis | ElastiCache for Valkey（ノード型・レプリカつき・`noeviction`）を VPC 内に | $60〜120 |
| worker | ECS Fargate（ARM）で「取得」「描画（Playwright）」「索引の更新」を分け、NAT Gateway で送信元IPを固定 | $150〜400 |
| 検索 | Meilisearch Cloud の上位プラン、または EC2 で自前運用 | $100〜600 |
| 監視・ログ | Sentry Team/Business＋ログ・オンコールの仕組み | $60〜350 |
| バックアップ・メール | S3 東京＋SES 東京 | $10〜50 |
| 合計 | | 約 $1,000〜3,000（キャッシュ率・クロール量で大きく変わる） |

## 10. 契約・設定の手順（検証期）

1. 商標（J-PlatPat で「求人マップ」の区分35・41・42 など）とドメイン kyujinmap.jp の確認・取得（汎用 JP ドメインは国内の住所が必要）。DNS の管理先を決める。
2. Vercel（Pro のチーム）。Functions のリージョンを `hnd1` に。Deployment Protection を有効に。
3. Supabase（Pro・東京）。staging と production を別プロジェクトで。
4. Meilisearch Cloud（JPN）。
5. Upstash（固定プラン・東京）。
6. Fly.io（`nrt`）。固定の送信元 IPv4 を割り当てる。
7. AWS（S3 東京のバックアップ用バケット。後で SES）。
8. Sentry（保存先を選んで作成。個人情報を送らない設定）。
9. UptimeRobot。
10. 法人カード（請求は USD）、各社の DPA の確認、/privacy への委託先・保存国の記載。

いずれも契約と課金を伴うため、実行は運営者の判断で行ってください。設定値（環境変数の一覧）は M1 で `apps/web/.env.example` と worker の設定に追加します。

## 11. 未確認・再確認が必要なこと

- 東京での実額：Meilisearch Cloud（JPN）、Cloud SQL・Cloud Run（GCP にする場合）。
- Meilisearch Cloud のバックアップの仕様と、XS（1GB）で日本語の索引が収まるか（実測が必要）。
- Playwright に必要なメモリ（1ブラウザ 1〜2GB は推定）と、Fly.io で `--ipc=host` 相当が使えない場合の設定。
- 個人情報保護法上の整理（外国の事業者への委託と公表事項）。
