# Week 2 Handson — eコマースイベント実装

## 完了条件

**GA4 DebugView で以下の3イベントすべてが確認できること**

| # | イベント名 | 確認方法 | 必須パラメータ |
|---|---|---|---|
| 1 | `view_item` | 商品詳細ページを開く | `currency`, `value`, `items[0].item_id` |
| 2 | `add_to_cart` | カート追加ボタンをクリック | `currency`, `value`, `items[0].item_id` |
| 3 | `purchase` | Stripe テスト決済を完了 | `transaction_id`, `currency`, `value` |

> **DebugView の開き方**:
> GA4 管理画面 → [管理] → [DebugView]
> （Chrome 拡張機能「Google Analytics Debugger」を有効にするか、
>   URL に `?_ga_debug=1` を追加する）

---

## このフォルダのファイル構成

```
handson/
├── README.md              ← いまここ
├── event_design.md        ★ 実装前に必ず読む。イベント仕様の定義書
├── gtag.ts                lib/gtag.ts に配置する（Week 1 からの拡張）
├── view_item.tsx          商品詳細ページへの組み込みコード
├── add_to_cart.tsx        カート追加ボタンのコード
├── purchase_webhook.ts    app/api/webhook/stripe/route.ts に配置
└── custom_dimensions.md   GA4 管理画面でのカスタムディメンション設定手順
```

---

## 作業手順

### ステップ 0: 設計書を読む（10分）

実装前に `event_design.md` をすべて読む。
**どのイベントをいつ・どのパラメータで送るか**を把握してから実装する。

### ステップ 1: gtag.ts を更新する（15分）

Week 1 で作成した `lib/gtag.ts` を `handson/gtag.ts` の内容で上書きする。

```bash
cp curriculum/week-02/handson/gtag.ts lib/gtag.ts
```

追加された関数:
- `GaItem` 型（eコマース商品情報）
- `sendViewItem(item: GaItem)` — view_item イベント送信
- `sendAddToCart(item: GaItem)` — add_to_cart イベント送信
- `sendPurchase(orderId, items, total)` — purchase イベント送信（クライアント版）

### ステップ 2: view_item を実装する（20分）

`handson/view_item.tsx` を参考に商品詳細ページに組み込む。

**ポイント**:
- `'use client'` ディレクティブが必要
- `useEffect` の中で `sendViewItem` を呼ぶ
- 依存配列は `[item.item_id]`

```tsx
// app/products/[id]/_components/ProductViewTracker.tsx を新規作成
// view_item.tsx の ProductViewTracker コンポーネントをコピーして配置
```

**DebugView で確認**: 商品詳細ページを開いて `view_item` イベントを確認

### ステップ 3: add_to_cart を実装する（20分）

`handson/add_to_cart.tsx` を参考に AddToCartButton コンポーネントを更新する。

**ポイント**:
- `onClick` ハンドラの中で API 呼び出し**成功後**に `sendAddToCart` を呼ぶ
- `value` に `price × quantity` を渡す（単価ではない）

**DebugView で確認**: カート追加ボタンをクリックして `add_to_cart` イベントを確認

### ステップ 4: purchase webhook を実装する（30分）

`handson/purchase_webhook.ts` を `app/api/webhook/stripe/route.ts` に配置する。

**環境変数の設定**:

```bash
# .env.local に追記
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx  # Stripe ダッシュボードで取得
GA4_API_SECRET=xxxxxxxxxxxxxxxxxx     # GA4 管理画面 → データストリーム → Measurement Protocol
```

**ローカルテストの準備** (Stripe CLI を使う場合):

```bash
# Stripe CLI インストール（まだの場合）
# https://stripe.com/docs/stripe-cli#install

# ローカルサーバーへ転送開始
stripe listen --forward-to localhost:3000/api/webhook/stripe

# 別ターミナルでテストイベントを送信
stripe trigger checkout.session.completed
```

> **Stripe CLI がない場合**: ngrok を使って公開 URL を作り、Stripe ダッシュボードに登録する
> `ngrok http 3000`

**DebugView での確認注意**:
Measurement Protocol のイベントは DebugView に表示**されない**場合がある。
その場合は GA4 の「リアルタイム」レポートで確認する。

### ステップ 5: カスタムディメンションを登録する（15分）

`custom_dimensions.md` の手順に従い、GA4 管理画面で `item_category` を登録する。

---

## トラブルシューティング

### `view_item` が DebugView に表示されない

1. Chrome 拡張機能「Google Analytics Debugger」が有効になっているか確認
2. `'use client'` が書かれているか確認
3. `useEffect` の中で `sendViewItem` を呼んでいるか確認
4. ブラウザのコンソールでエラーが出ていないか確認

### `add_to_cart` が DebugView に表示されない

1. カート追加 API が成功しているか確認（コンソールでエラーを確認）
2. API **成功後**に `sendAddToCart` を呼んでいるか確認（順序の問題）
3. `value` に `price × quantity` を渡しているか確認

### Stripe webhook がローカルで受け取れない

1. `stripe listen` コマンドが実行中か確認
2. `STRIPE_WEBHOOK_SECRET` が `.env.local` に正しく設定されているか確認
3. Next.js サーバーが起動しているか確認（`npm run dev`）

### purchase イベントが GA4 に届かない

1. `NEXT_PUBLIC_GA4_ID` と `GA4_API_SECRET` が設定されているか確認
2. サーバーのコンソールで `[GA4] purchase イベント送信成功` のログが出ているか確認
3. Measurement Protocol は DebugView に出ないため、「リアルタイム」レポートを確認

---

## 完了チェックリスト

```
[ ] lib/gtag.ts を Week 2 版に更新した
[ ] 商品詳細ページで ProductViewTracker が組み込まれている
[ ] DebugView で view_item イベントを確認した
    - currency: "JPY"
    - value: (商品価格)
    - items[0].item_id: (商品ID)

[ ] AddToCartButton に sendAddToCart が組み込まれている
[ ] DebugView で add_to_cart イベントを確認した
    - currency: "JPY"
    - value: (price × quantity)
    - items[0].item_id: (商品ID)

[ ] app/api/webhook/stripe/route.ts を実装した
[ ] STRIPE_WEBHOOK_SECRET と GA4_API_SECRET を .env.local に設定した
[ ] stripe trigger checkout.session.completed で purchase イベントが GA4 に届くことを確認した

[ ] GA4 管理画面でカスタムディメンション (item_category) を登録した
```

**全項目にチェックが入ったら Week 3 に進む。**
