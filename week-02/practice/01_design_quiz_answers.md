# Week 2 確認問題 解答

> このファイルは自分で答えを考えてから開くこと。
> すぐに答えを見ると handson で詰まりやすくなる。

---

## A1. イベント名の命名ルール

**正解: (B) `view_item`、(D) `add_to_cart`、(F) `purchase`**

GA4 の標準 eコマースイベント名は**スネークケース（小文字 + アンダースコア）**で定義されている。
`viewItem`（キャメルケース）や `ViewItem`（パスカルケース）は GA4 に届くが、
標準レポートの「eコマース」タブに自動集計されない。

**重要**: GA4 はイベント名の大文字小文字を区別する。
`View_Item` を送っても `view_item` として認識されない。

---

## A2. `items` 配列の設計

```typescript
window.gtag('event', 'add_to_cart', {
  currency: 'JPY',     // ← ISO 4217 通貨コード
  value: 7600,         // (1) 3800 × 2 = 7600（単価ではなく合計）
  items: [
    {
      item_id: 'tshirt_001',
      item_name: '名入れTシャツ',
      price: 3800,
      quantity: 2,     // (2) 追加した数量
    }
  ]
})
```

**解説**:
- `value` は `price × quantity` の合計額（7,600円）
- `price` は単価（3,800円）のまま
- `quantity` はカートに追加した数量（2）
- この設定で GA4 は「3,800円の商品を2個追加した」と正しく解釈できる

---

## A3. `transaction_id` の目的

**解答例**: `purchase` イベントの `transaction_id` は、GA4 が同一の購入を重複してカウントしないようにするための冪等キーであり、ページリロードや Webhook 再送による二重計測を防ぐ。

**補足**:
- GA4 は同一 `transaction_id` の `purchase` を1回のみカウントする
- Stripe の `checkout.session.id` を使うと、再送時も同じ値になるため最適

---

## A4. SSR と Client Component

**問題のある行**: `sendViewItem(...)` の呼び出し箇所

**問題の説明**:
`'use client'` がない `page.tsx` はサーバーコンポーネントとして実行される。
サーバー上では `window` オブジェクトが存在しないため、`sendViewItem` 内の
`window.gtag(...)` を呼び出すとエラーになる。

（`sendViewItem` 内のガード `if (typeof window === 'undefined') return` があれば
エラーにはならないが、イベントは発火しない = 計測されない）

**修正方法**:

推奨パターン（Server Component を維持する）:
```tsx
// app/products/[id]/page.tsx（Server Component のまま）
import { ProductViewTracker } from './_components/ProductViewTracker'

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id)
  return (
    <>
      <h1>{product.name}</h1>
      {/* 'use client' の ProductViewTracker に委ねる */}
      <ProductViewTracker
        item={{
          item_id: product.id,
          item_name: product.name,
          price: product.price,
          quantity: 1,
        }}
      />
    </>
  )
}
```

```tsx
// app/products/[id]/_components/ProductViewTracker.tsx
'use client'
import { useEffect } from 'react'
import { sendViewItem } from '@/lib/gtag'

export function ProductViewTracker({ item }) {
  useEffect(() => {
    sendViewItem(item)
  }, [item.item_id])

  return null
}
```

---

## A5. イベント送信のタイミング設計

**正解: アプローチB**

```typescript
const handleClick = async () => {
  await addToCartApi(item.id) // 先に API 呼び出し（成功を確認）
  sendAddToCart(item)         // 成功後に GA4 送信
}
```

**理由**:
- アプローチA は API が失敗した場合でも GA4 に「カートに追加された」と記録してしまう
- 在庫切れ・認証エラー・ネットワーク障害などで API が失敗するケースは現実に起こる
- 「実際にカートに入った」場合のみ計測することで、GA4 データの精度が上がる

**注意**: `addToCartApi` が例外を投げた場合は `sendAddToCart` が呼ばれないよう、
エラーハンドリングも必要。

```typescript
const handleClick = async () => {
  try {
    await addToCartApi(item.id)
    sendAddToCart(item) // API 成功時のみ到達する
  } catch {
    // エラー処理（ユーザーへの通知など）
  }
}
```

---

## A6. フロントエンド vs サーバーサイドの判断

| イベント | 送信場所 | 理由 |
|---|---|---|
| `view_item` | フロントエンド | ユーザーのページ閲覧はブラウザ上の行動。`useEffect` + `window.gtag` で自然に実装できる |
| `add_to_cart` | フロントエンド | ボタンクリックはブラウザ上のユーザーアクション。`onClick` ハンドラから送信する |
| `purchase` | サーバーサイド | Stripe が決済確定を通知する webhook を起点にする。フロントでは通信断や重複クリックのリスクがある |

**補足**: `purchase` をフロントから送ることも技術的には可能だが、
webhook から送ることで「決済が本当に完了した」場合のみ計測できる。

---

## A7. カスタムディメンションの必要性

**解答**: GA4 管理画面の「カスタム定義」で `item_category` をカスタムディメンション（イベントスコープ）として登録する必要がある。

**手順の概要**:
1. GA4 管理画面 → [管理] → [カスタム定義]
2. 「カスタムディメンションを作成」をクリック
3. スコープ: イベント、イベントパラメータ: `item_category` で登録

コードでパラメータを送るだけでは GA4 がそのデータを分析軸として認識しない。
登録後24〜48時間で探索レポートの軸として使えるようになる。

---

## A8. Measurement Protocol の用途

**名称**: GA4 Measurement Protocol（測定プロトコル）

**理由**:
`window.gtag()` はブラウザ専用の API。サーバーサイドには `window` が存在しないため使えない。
Measurement Protocol は HTTP POST でサーバーから直接 GA4 にイベントを送るための API。
Stripe webhook のようにサーバー間通信でのイベント計測に使う。

```
ブラウザ → window.gtag() → GA4
サーバー → Measurement Protocol (HTTP POST) → GA4
```

---

## A9. Webhook のローカルテスト

**方法1: Stripe CLI**（推奨）

```bash
# インストール: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/webhook/stripe

# 別ターミナルでテストイベントを送信
stripe trigger checkout.session.completed
```

Stripe CLI は署名も自動生成してくれるため、`constructEvent` の検証も通る。

**方法2: ngrok**

```bash
# ngrok をインストール: https://ngrok.com/
ngrok http 3000
# → https://xxxx.ngrok.io というURLが発行される

# Stripe ダッシュボードで Webhook を登録:
# エンドポイントURL: https://xxxx.ngrok.io/api/webhook/stripe
```

ngrok は毎回 URL が変わるため（無料プランの場合）、開発のたびに登録し直す必要がある。

---

## A10. 設計の一貫性チェック

問題のあるコードを修正版と比較する：

```typescript
// ★ 問題のあるコード
window.gtag('event', 'addToCart', {   // ❌ イベント名が camelCase
  currency: 'JPY',
  totalPrice: item.price * quantity,  // ❌ パラメータ名は 'value' であるべき
  productList: [                       // ❌ パラメータ名は 'items' であるべき
    {
      id: item.id,                    // ❌ フィールド名は 'item_id' であるべき
      name: item.name,                // ❌ フィールド名は 'item_name' であるべき
      unitPrice: item.price,          // ❌ フィールド名は 'price' であるべき
      qty: quantity,                  // ❌ フィールド名は 'quantity' であるべき
    }
  ]
})
```

**問題の一覧（7箇所）**:

1. `'addToCart'` → `'add_to_cart'`（スネークケースが GA4 仕様）
2. `totalPrice:` → `value:`（GA4 標準パラメータ名）
3. `productList:` → `items:`（GA4 標準パラメータ名）
4. `id:` → `item_id:`（GA4 標準フィールド名）
5. `name:` → `item_name:`（GA4 標準フィールド名）
6. `unitPrice:` → `price:`（GA4 標準フィールド名）
7. `qty:` → `quantity:`（GA4 標準フィールド名）

**修正後**:

```typescript
// ✅ 正しいコード
window.gtag('event', 'add_to_cart', {
  currency: 'JPY',
  value: item.price * quantity,
  items: [
    {
      item_id: item.id,
      item_name: item.name,
      price: item.price,
      quantity: quantity,
    }
  ]
})
```

**この問題から学ぶこと**:
独自の名前でパラメータを送っても GA4 は「受け取る」が、
標準レポートの eコマース集計に使われない。
`event_design.md` に仕様を定義し、実装時に必ず参照する習慣が重要。
