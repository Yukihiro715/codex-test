# 10｜オンラインのデモ環境（Vercel）

確認日：2026-09-29。手元の PC で起動しなくても、URL でデモを見られるようにする手順です。料金は USD・税別で、Vercel の公式ドキュメントで確認した時点の値です。アカウント作成と契約は運営者が行ってください（CLAUDE.md：新規クラウド課金・デプロイは人の判断）。

## 1. 方針

- いまのデモは架空のデータで動くため、データベースなしでそのまま公開できます（`DATA_MODE=demo`）。
- ブランチ `claude/job-search-m0-implementation-sk1wtc` に変更をプッシュするたびに、自動で更新されます。
- 関係者だけが見られるように保護します（Deployment Protection）。デモは全ページ noindex です。
- データベース（M1）は、このデモ環境とは別に準備します（§6）。

## 2. 費用

| 項目 | 料金 | メモ |
|---|---|---|
| Vercel Pro | $20/月（利用枠 $20 分を含む） | Hobby は個人・非商用に限られるため、会社のサービスでは Pro |
| 閲覧だけのメンバー（Viewer） | 無料・人数の上限なし | デプロイ済みの画面の閲覧とコメントができる |
| Vercel Authentication による保護 | 無料 | 見る人は Vercel のアカウントでログインし、チームに招待されている必要がある |
| パスワードによる保護（任意） | $20/月（プロジェクトごと） | Vercel のアカウントを持たない人に見せる場合 |

デモの閲覧程度なら、利用枠 $20 の範囲に収まる見込みです。

## 3. 初回の設定（約15分）

1. https://vercel.com で、会社用の GitHub アカウントでサインアップし、チームを作って Pro にします（支払いは法人カード）。
2. 「Add New…」→「Project」→ GitHub の `Yukihiro715/codex-test` を「Import」します（Vercel の GitHub アプリにこのリポジトリへのアクセスを許可）。
3. 「Root Directory」の「Edit」で `apps/web` を選びます。Framework は Next.js が自動で選ばれます。Build Command・Install Command は既定のままにします。
4. 「Environment Variables」に次を入れます（Production と Preview の両方）。

| 名前 | 値 |
|---|---|
| `APP_ENV` | `staging` |
| `DATA_MODE` | `demo` |
| `ADMIN_SESSION_SECRET` | 32文字以上のランダムな文字列 |
| `MEMBER_SESSION_SECRET` | 32文字以上のランダムな文字列（上とは別の値） |
| `NEXT_TELEMETRY_DISABLED` | `1` |

   ランダムな文字列は、Mac のターミナルで `openssl rand -base64 32` を実行すると作れます（2回実行して別々の値を使う）。

5. 「Deploy」を押します。数分でビルドが終わり、URL が表示されます。
6. 「Settings」→「Deployment Protection」で、方法を「Vercel Authentication」、範囲を「All Deployments」にします（本番用のURLも含めて保護）。
7. 「Settings」→「Build and Deployment」の Node.js Version で `22.x` を選びます（24.x でも動作を確認済み）。
8. 「Settings」→「Git」の Production Branch を `claude/job-search-m0-implementation-sk1wtc` にすると、そのブランチの最新版がいつも同じ URL に出ます。
9. 見てもらう人を「Team」→「Members」から Viewer（無料）で招待します。Vercel のアカウントを持たない人に見せる場合は、パスワードによる保護（有料）か、ブランチごとの共有リンク（Shareable Links）を使います。

関数の実行場所は `apps/web/vercel.json` で東京（`hnd1`）に固定しています。

## 4. 独自ドメインで見る場合（任意）

- 「Settings」→「Domains」で `demo.kyujinmap.jp` などを追加し、表示される DNS の設定（CNAME）を kyujinmap.jp の DNS に登録します。
- 本番の `kyujinmap.jp` はデモに割り当てません（公開時に本番環境で使う）。
- 独自ドメインを使う場合は、環境変数 `SITE_URL` にその URL を入れて再デプロイします。

## 5. 更新と確認

- ブランチにプッシュすると自動で再デプロイされます。プルリクエストごとのプレビュー URL も作られます。
- ビルドに失敗した場合は、Vercel の「Deployments」にログが出ます。内容を共有してもらえれば修正します。
- デモの管理画面は `/admin/sources`、会員のデモは `/login` です。どちらも本番環境（`APP_ENV=production`）では使えません。

## 6. データベースを加えるとき（M1）

- Supabase で東京リージョン（ap-northeast-1）のプロジェクトを作り、接続文字列を Vercel の環境変数（例：`DATABASE_URL`）に設定します。デモ環境用と本番用は別のプロジェクトにします。
- 会員・保存した検索条件・閲覧履歴・申請・管理画面の操作・ソース設定と審査記録を DB に保存するように切り替え、デモ用の架空データは DB の初期データとして入れます（本番には入れない）。
- 詳細は docs/07_INFRASTRUCTURE.md と docs/09_ACCOUNTS.md。
