/** デモ環境の常時表示。本番ではこの帯を消し、fixtureも除く（REL01）。 */
export function DemoBanner() {
  return (
    <div className="bg-ink px-4 py-1.5 text-center text-xs leading-relaxed tracking-wide text-white" role="note" data-testid="demo-banner">
      画面確認用デモ／求人・企業・金額はすべて架空です。実データの取得・応募受付・請求は行いません。
    </div>
  );
}
