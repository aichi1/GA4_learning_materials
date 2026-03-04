# イベント設計書 — EC_project_sdd_v7 × GA4

> **このドキュメントの目的**
> EC サイトで計測するイベントの仕様を一箇所にまとめ、実装・分析・レポートを通して
> 同じ定義を使えるようにする。コードを書く前に必ずここを確認すること。

---

## 1. 計測するイベント一覧

| イベント名 | 発火タイミング | 必須パラメータ | 任意パラメータ |
|------------|---------------|---------------|---------------|
| `view_item` | 商品詳細ページ表示直後 | `currency`, `value`, `items` | — |
| `add_to_cart` | カートに追加ボタン クリック時 | `currency`, `value`, `items` | — |
| `purchase` | Stripe `checkout.session.completed` webhook 受信時 | `transaction_id`, `currency`, `value`, `items` | `coupon` |

---

## 2. イベント別パラメータ仕様

### 2-1. `view_item` — 商品詳細ページ表示

**目的**: どの商品が何回閲覧されたかを計測する。購入コンバージョン率の分母になる。

**発火場所**: `app/products/[id]/page.tsx` に配置する Client Component

**パラメータ**:

| パラメータ名 | 型 | 値の例 | 説明 |
|---|---|---|---|
| `currency` | `string` | `'JPY'` | 通貨コード（ISO 4217） |
| `value` | `number` | `3800` | 商品価格（円） |
| `items` | `GaItem[]` | 下記参照 | 商品情報の配列（1件） |

**`GaItem` オブジェクト**:

```
item_id       : string   — 商品ID（例: 'prod_123'）       ★ 必須
item_name     : string   — 商品名（例: '名入れTシャツ'）  ★ 必須
item_category : string   — カテゴリ（例: 'tshirt'）
price         : number   — 単価（例: 3800）
quantity      : number   — 数量（view_item は 1 固定）
```

**発火タイミングの詳細**:
- SSR ページは初回レンダリング時にサーバー側で実行されるため `window.gtag` にアクセスできない
- `useEffect` を使って **ブラウザ側マウント後** に発火する
- ページキャッシュが効いていてもマウントごとに1回発火する（正しい動作）

---

### 2-2. `add_to_cart` — カート追加

**目的**: 購買意向の強いユーザー行動を計測する。`view_item` との比率で「カート追加率」を算出できる。

**発火場所**: `app/components/AddToCartButton.tsx` の `onClick` ハンドラ

**パラメータ**:

| パラメータ名 | 型 | 値の例 | 説明 |
|---|---|---|---|
| `currency` | `string` | `'JPY'` | 通貨コード |
| `value` | `number` | `7600` | 追加した商品の合計金額（価格 × 数量） |
| `items` | `GaItem[]` | 下記参照 | 追加した商品情報 |

**`GaItem` オブジェクト**（add_to_cart 時）:

```
item_id       : string   — 商品ID
item_name     : string   — 商品名
item_category : string   — カテゴリ
price         : number   — 単価
quantity      : number   — カートに追加した数量（例: 2）
```

**注意**:
- `value` は `price × quantity` で計算する（単価ではなく合計額を渡す）
- ユーザーが数量を変更した場合は変更後の数量を使う

---

### 2-3. `purchase` — 購入完了

**目的**: 売上・コンバージョンの最終計測。GA4 の「収益」レポートに自動集計される。

**発火場所**: `app/api/webhook/stripe/route.ts`（サーバーサイド）

**発火方法**: Stripe webhook → サーバーで受信 → **Measurement Protocol** でGA4に送信

> **重要**: `purchase` は決済完了後にサーバー側で確実に発火させる。
> フロントエンドでの発火は「決済完了ページに到達したか」しか計測できず、
> 画面遷移失敗や重複クリックで誤計測が起きる。

**パラメータ**:

| パラメータ名 | 型 | 値の例 | 説明 |
|---|---|---|---|
| `transaction_id` | `string` | `'cs_live_abc123'` | ★ 必須。Stripe の `session.id` を使う |
| `currency` | `string` | `'JPY'` | 通貨コード |
| `value` | `number` | `5800` | 購入総額（税込・送料込み） |
| `items` | `GaItem[]` | 下記参照 | 購入した商品一覧 |
| `coupon` | `string` | `'SUMMER10'` | クーポン使用時のみ（任意） |

**`transaction_id` について（重要）**:

GA4 は同一 `transaction_id` のイベントを **1件のみカウント** する。
これにより、Webhook が2回届いた場合でも購入が二重計測されない。
Stripe の `checkout.session.id` は冪等性が保証されているため、これを使うのが最適。

---

## 3. カスタムディメンション

GA4 の標準パラメータに含まれない情報をレポートで使うには、
管理画面でカスタムディメンションとして登録する必要がある。

| ディメンション名 | スコープ | 対応パラメータ | 用途 |
|---|---|---|---|
| `item_category` | イベント | `items[].item_category` | カテゴリ別の売上分析 |

> GA4 の無料プランでは **イベントスコープ** のカスタムディメンションは最大 50 個まで。

---

## 4. ファネル設計

このプロジェクトで追うコンバージョンファネル：

```
page_view（商品一覧）
    ↓
view_item（商品詳細閲覧）
    ↓
add_to_cart（カート追加）
    ↓
purchase（購入完了）
```

Week 3 では GA4 のファネル探索レポートでこの流れを可視化する。

---

## 5. 測定 ID と環境変数

```bash
# .env.local（Gitにコミットしない）
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX   # GA4 測定ID
GA4_API_SECRET=XXXXXXXXXXXXXXXX   # Measurement Protocol 用シークレット
```

- `NEXT_PUBLIC_` プレフィックスはクライアントサイドから参照可能
- `GA4_API_SECRET` はサーバーサイド専用（フロントに露出させない）
