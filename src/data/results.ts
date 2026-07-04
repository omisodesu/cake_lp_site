// 導入実績サマリーの数値（修正指示書 2026-06-10 タスク3-2に基づき差し替え）
// value は「0→152」「月30〜40」など数値型で表せない表現を含むため表示用文字列で持つ
// href がある項目はリンク付きで描画される（タスク10: 「0→152件」から /christmas/ への内部リンク）
export const results = [
  {
    value: '51',
    unit: '%',
    title: '導入店の予約のうち営業時間外の割合',
    href: null,
    navName: null,
  },
  {
    value: '月30〜40',
    unit: '件',
    title: '休業日に入った注文（導入店実績）',
    href: null,
    navName: null,
  },
  {
    // TODO(福井さん確認): /christmas/ の公開タイミング（指示書タスク10）。未公開のまま本番反映するとリンク切れになるため公開日を確認する
    value: '0→152',
    unit: '件',
    title: 'クリスマスWEB予約の増加（導入初年度）',
    href: '/christmas/',
    navName: 'results-christmas',
  },
] as const;
