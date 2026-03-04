# Week 1 Handson — GA4 組み込み + DebugView 確認

## 完了条件

**Week 1 の handson は、以下の条件をすべて満たしたときに完了です。**

```
[ ] GA4 プロパティが作成され、測定ID（G-XXXXXXXXXX）を取得した
[ ] .env.local に NEXT_PUBLIC_GA_ID が設定されている
[ ] GoogleAnalytics.tsx と gtag.ts がプロジェクトに配置されている
[ ] layout.tsx に <GoogleAnalytics gaId={gaId} /> が組み込まれている
[ ] next dev でエラーなく起動する
[ ] ブラウザコンソールに CSP エラーが出ていない
[ ] GA4 の DebugView に自分のデバイスが表示されている
[ ] DebugView で page_view イベントが確認できる
[ ] 別ページに遷移すると page_view が追加で発火することを確認した
```

**最重要**: DebugView で `page_view` が見えること = Week 1 完了

---

## 手順の概要

| ステップ | ドキュメント | 内容 |
|---------|------------|------|
| 1 | `01_ga4_setup.md` | GA4 プロパティ作成・測定ID取得 |
| 2 | `01_ga4_setup.md` | `GoogleAnalytics.tsx` と `gtag.ts` をプロジェクトに配置 |
| 3 | `01_ga4_setup.md` | `.env.local` に測定ID を設定 |
| 4 | `layout.tsx.patch` | `layout.tsx` に `<GoogleAnalytics>` を組み込む |
| 5 | `01_ga4_setup.md` | `next.config.js` で CSP ヘッダーを設定 |
| 6 | `02_debugview_check.md` | 開発サーバーを起動して DebugView で動作確認 |

---

## 配置するファイル

このディレクトリにあるファイルを、以下の通りプロジェクトに配置します。

| このディレクトリのファイル | プロジェクトでの配置先 |
|--------------------------|----------------------|
| `GoogleAnalytics.tsx` | `app/components/GoogleAnalytics.tsx` |
| `gtag.ts` | `lib/gtag.ts` |
| `layout.tsx.patch` | 差分として `app/layout.tsx` に手動適用 |

---

## 必要な知識・前提

- TypeScript の基本的な読み書きができること
- Next.js App Router の基本構成（`app/layout.tsx` の役割）を理解していること
- Google アカウントを持っていること

---

## 所要時間の目安

- GA4 プロパティ作成: 10〜15分
- コードの配置・修正: 15〜20分
- 動作確認・トラブルシュート: 10〜30分（環境による）
- 合計: 35〜65分

---

## よくある詰まりポイント（事前に把握しておくこと）

1. **`strategy="afterInteractive"` の記述漏れ**
   `Script` コンポーネントに `strategy` 属性を付けないと、GA4 の読み込みタイミングがずれて
   計測が不安定になることがあります。`GoogleAnalytics.tsx` のコメントを必ず確認してください。

2. **CSP の設定忘れ**
   さくらVPS 環境では CSP を手動で設定しないと、ブラウザが GA4 へのリクエストをブロックします。
   ローカル開発中でも CSP を設定している場合は同様です。
   `01_ga4_setup.md` の Section 3 を参照してください。

3. **SPA のページビュー計測**
   Next.js App Router では `usePathname` を使ったルート変化監視が必要です。
   これがないと最初のページビューしか計測されません。
   `GoogleAnalytics.tsx` の `RouteChangeTracker` コンポーネントを確認してください。

---

## 完了後の確認コマンド

```bash
# TypeScript エラーがないか確認
npx tsc --noEmit

# 開発サーバー起動
npm run dev
```

---

## 次のステップ

Week 1 が完了したら Week 2 に進みます。

Week 2 では、今週実装した `event()` 関数（`lib/gtag.ts`）を使って、
EC サイト固有のカスタムイベントを実装します。

- `view_item`: 商品詳細ページを閲覧したとき
- `add_to_cart`: カートに商品を追加したとき
- `purchase`: Stripe で購入が完了したとき
