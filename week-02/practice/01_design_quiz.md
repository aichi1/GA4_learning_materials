# Week 2 確認問題 — イベント設計

> **このクイズの目的**
> `lecture/01_ecommerce_events.md` の内容が理解できているか確認する。
> handson に進む前に、設計の判断基準を固めておく。
>
> **所要時間**: 約20分
>
> 答えは `01_design_quiz_answers.md` にある。ただし**まず自分で考えること**。

---

## Q1. イベント名の命名ルール

次のうち、GA4 eコマースイベントとして**正しい**イベント名はどれか。すべて選べ。

```
(A) viewItem
(B) view_item
(C) ViewItem
(D) add_to_cart
(E) addToCart
(F) purchase
```

> **ヒント**: GA4 はイベント名に大文字小文字を区別する。
> Google が定義した標準イベント名のフォーマットを確認しよう。

---

## Q2. `items` 配列の設計

EC サイトで「名入れTシャツ（税込3,800円）を2枚カートに追加した」場合、
`add_to_cart` イベントの `items` 配列と `value` を正しく書け。

```typescript
// 空欄を埋めよ
window.gtag('event', 'add_to_cart', {
  currency: '___',
  value: ___,       // (1) いくらを渡すべきか？
  items: [
    {
      item_id: 'tshirt_001',
      item_name: '名入れTシャツ',
      price: 3800,
      quantity: ___,  // (2) いくつ？
    }
  ]
})
```

---

## Q3. `transaction_id` の目的

`purchase` イベントに `transaction_id` が**必須**な理由を1文で説明せよ。

---

## Q4. SSR と Client Component

次のコードを見て、問題がある行を指摘し、修正方法を答えよ。

```tsx
// app/products/[id]/page.tsx

// ← 'use client' ディレクティブはない

import { sendViewItem } from '@/lib/gtag'

export default async function ProductPage({ params }) {
  const product = await getProduct(params.id)

  // 商品ページ表示時に view_item を発火
  sendViewItem({
    item_id: product.id,
    item_name: product.name,
    price: product.price,
    quantity: 1,
  })

  return <h1>{product.name}</h1>
}
```

---

## Q5. イベント送信のタイミング設計

「カートに追加」ボタンをクリックしたとき、次の2つのアプローチのうち
**どちらが正しいか**、その理由とともに答えよ。

**アプローチA:**
```typescript
const handleClick = async () => {
  sendAddToCart(item)         // 先に GA4 送信
  await addToCartApi(item.id) // その後 API 呼び出し
}
```

**アプローチB:**
```typescript
const handleClick = async () => {
  await addToCartApi(item.id) // 先に API 呼び出し
  sendAddToCart(item)         // 成功後に GA4 送信
}
```

---

## Q6. フロントエンド vs サーバーサイドの判断

次の3つのイベントを「フロントエンドから送る」か「サーバーサイドから送る」か分類し、
その理由を答えよ。

| イベント | 送信場所 | 理由 |
|---|---|---|
| `view_item` | ? | ? |
| `add_to_cart` | ? | ? |
| `purchase` | ? | ? |

---

## Q7. カスタムディメンションの必要性

`gtag.ts` で以下のコードを実装し、イベントを送っているとする。

```typescript
sendViewItem({
  item_id: 'tshirt_001',
  item_name: '名入れTシャツ',
  price: 3800,
  quantity: 1,
  item_category: 'tshirt',  // ← カスタムパラメータ
})
```

このとき、GA4 レポートで `item_category` ごとの売上を分析するには
コード実装以外に**何をする必要があるか**を答えよ。

---

## Q8. Measurement Protocol の用途

Stripe webhook から `purchase` イベントを GA4 に送るために使う
`https://www.google-analytics.com/mp/collect` というエンドポイントの名称と、
このエンドポイントを使う理由を説明せよ。

---

## Q9. Webhook のローカルテスト

`http://localhost:3000/api/webhook/stripe` に Stripe webhook を送るためには
どのような方法があるか。2つ以上答えよ。

> **ヒント**: Stripe webhook は公開 URL にしか届かない。

---

## Q10. 設計の一貫性チェック

`handson/event_design.md` を参照し、次の実装コードに問題がないか確認せよ。
問題があれば指摘し、修正案を示せ。

```typescript
// カート追加ボタンの onClick
const handleClick = () => {
  window.gtag('event', 'addToCart', {   // イベント名
    currency: 'JPY',
    totalPrice: item.price * quantity,  // パラメータ名
    productList: [                       // パラメータ名
      {
        id: item.id,                    // フィールド名
        name: item.name,                // フィールド名
        unitPrice: item.price,          // フィールド名
        qty: quantity,                  // フィールド名
      }
    ]
  })
}
```

> 問題は1つではない。設計書と照らし合わせて、すべて列挙すること。

---

## 答え合わせ

`practice/01_design_quiz_answers.md` を確認する。

全問正解したら `handson/README.md` に進んで実装を開始しよう。
