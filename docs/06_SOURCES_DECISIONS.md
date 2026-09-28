# 06｜出典・決定事項・未確認

確認日：2026-09-29。公開資料の記載と本パッケージの提案は区別する。下記の資料は、対象サイトの求人を今回実際に収集・公開した証拠ではない。

## 一次資料
### S01 ハローワーク：サイトポリシー
https://www.hellowork.mhlw.go.jp/info/sitepolicy.html
確認事項：公開求人の転載に関する条件、対象外の情報、運営者・出典表示、更新・削除、目的外営業の禁止。実際の自動取得可否は別判定。robots.txtは今回の取得ツールで確認できず、許可とは判定していない。

### S02 エンゲージ：企業用利用規約
https://en-gage.net/company/privacy/
確認事項：第2条の適用、第9条の知的財産利用、第11条の権利帰属、第12条の自動アクセス禁止等。企業用規約の未登録第三者への法的適用は今回結論を出していない。公開求人パスやrobotsの一括利用可否も未確認。

### S03 文化庁：他人の著作物を利用したい場合など
https://www.bunka.go.jp/seisaku/chosakuken/seidokaisetsu/chosakukensha_fumei/
確認事項：著作物該当性・権利制限・許諾等を検討する枠組みと、他の権利・法令・利用条件の確認の必要性。本資料は特定求人サイトの収集を適法と認めるものではない。

### S04 IETF：RFC 9309 Robots Exclusion Protocol
https://www.rfc-editor.org/rfc/rfc9309.html
確認事項：robotsの形式・取得・キャッシュ等の仕様。robotsのルールはアクセスの認可を意味するものではない。本サービスは不明な取得結果を許可とせず、独自の厳しめの停止設定を置く。

### S05 Google：求人情報の構造化データ
https://developers.google.com/search/docs/appearance/structured-data/job-posting?hl=ja
確認事項：個別求人ページへの適用、完全な説明、求人企業の承認に関する規定、期限終了、応募導線。給与のbaseSalaryには雇用主向けの制約がある。第三者のfacts_link一覧に付ければ自動的に求人検索へ載るわけではない。

### S06 Google：検索のスパムポリシー
https://developers.google.com/search/docs/essentials/spam-policies?hl=ja
確認事項：付加価値のない大量コンテンツ生成等。AIを使うこと自体を一律禁止する規定として解釈しない。

### S07 厚生労働省：募集情報等提供事業
https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/boshuujouhouteikyou.html
確認事項：求職者情報を収集して提供に利用する事業の事前届出等、情報提供と職業紹介の区別への案内、2025年4月施行の料金明示等。機能や実態ごとの判断が必要。

### S08 Anthropic：Claude Codeのプロジェクト記憶
https://code.claude.com/docs/en/memory
確認事項：CLAUDE.mdによるプロジェクト指示、簡潔な構造化、詳細文書の分割。CLAUDE.mdは指示であって、実行を強制的に遮断するセキュリティ境界ではない。

### S09 Anthropic：Claude Codeのベストプラクティス
https://code.claude.com/docs/en/best-practices
確認事項：具体的な文脈・検証方法の提示、探索・計画・実装、テストによる完了確認。本パッケージの段階分けと受入基準はこの考え方に沿う設計提案。

### S10 Next.js：導入
https://nextjs.org/docs/app/getting-started/installation
確認事項：現行App Routerの初期構築、TypeScript/Tailwind等の設定。依存は実装時点の互換性を確認し、lockfileで固定する。

### S11 Meilisearch：日本語を含むtokenization／filter設定
https://www.meilisearch.com/docs/capabilities/indexing/advanced/tokenization
https://www.meilisearch.com/docs/capabilities/filtering_sorting_faceting/how_to/configure_granular_filters
確認事項：tokenizationと属性別のfilter設定。採用技術の提案であり、実データの日本語検索精度はfixtureと本番の両方で検証する。

## 確定しているユーザー方針
- 既存のMimipoとの相性ではなく、100億円規模の成長可能性で評価する。
- クリック課金モデルを目指す。
- 総合基盤＋職種別UXを検討する。
- 提携交渉は実績後にし、公開求人を中心に初期サービスを作る。
- Claude Codeへ仕様を渡して実装を進める。

## 本パッケージで置いた仮定
- 100億円は年商。初期ブランドWORKLENSは仮称。
- 4職種の高度UI、8職種の共通分類、比較3件、保存は端末内。
- 外部送客クリックで課金。入札方式より固定CPCを先行。
- 初期のsource上限、72時間raw保持、7日stale、5分停止伝播、精度/速度目標は設計上の仮値。
- 主な実装技術とデザイントークンは提案。ユーザーの既存repo環境は未確認。

## 未確認・納品に含まれないこと
- 個々の企業採用ページやATSの収集・再掲載条件、実求人件数、継続取得成功率。
- エンゲージ/ハローワークの対象パスのrobots判定。ツールで読み取れなかったものを許可と見なしていない。
- ジョブモアの全データ供給契約や内部収集経路。
- ブランド商標、ドメイン、運営者連絡先、開発repo、実広告単価、予算。
- スクレイピングを含む個別の適法性判断。本書のレーンは内部リスク管理であり法的認定ではない。
- 本番クローラー・請求処理の実装完了、デプロイ、実データの公開。

## 原則
出所を書けば全文転載できる、robotsがallowなら権利問題がない、AIで書き換えれば別原稿になる、削除要請に応じれば過去の利用が免責される、という前提は置かない。一方で、提携がない情報は一切検討しない、という前提も置かない。