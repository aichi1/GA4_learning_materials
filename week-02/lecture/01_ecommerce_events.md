# GA4 eコマースイベント仕様解説

> **このレクチャーの目標**
> GA4 の eコマース計測モデルを理解し、「なぜこのイベントをこのタイミングで送るのか」を
> 説明できるようになる。コードは handson で書く。ここでは概念を固める。

---

## 1. GA4 の eコマース計測モデルとは

GA4 には eコマースサイトの購買行動を分析するための**標準イベント**が定義されている。
Google がこれらのイベント名とパラメータの仕様を決めているため、
正しい名前で送ることで GA4 の管理画面が自動的に「購入レポート」「商品レポート」を生成してくれる。

### 標準 eコマースイベントの全体像

GA4 が定義する eコマースイベントは購買ジャーニー全体をカバーする。

| ステージ | イベント名 | 概要 |
|---|---|---|
| 認知 | `view_item_list` | 商品一覧の閲覧 |
| 検討 | `view_item` | 商品詳細の閲覧 |
| 意向 | `add_to_cart` | カートへの追加 |
| 意向 | `remove_from_cart` | カートから削除 |
| 購入開始 | `begin_checkout` | チェックアウト開始 |
| 支払 | `add_payment_info` | 支払情報の入力 |
| **完了** | **`purchase`** | **購入完了（最重要）** |
| 返品 | `refund` | 返金処理 |

今回のプロジェクトでは、まずコアとなる3つ（`view_item` / `add_to_cart` / `purchase`）から実装する。

---

## 2. `items` 配列の構造

eコマースイベントには必ず `items` という配列を含める。
これが GA4 の「商品別分析」の基本データになる。

### `items` に含めるフィールド

| フィールド名 | 必須 | 型 | 説明 |
|---|---|---|---|
| `item_id` | 必須 | string | 商品を一意に識別するID |
| `item_name` | 必須 | string | 商品名 |
| `price` | 推奨 | number | 単価（税込み） |
| `quantity` | 推奨 | number | 数量 |
| `item_category` | 任意 | string | カテゴリ（例: 'tshirt'） |
| `item_brand` | 任意 | string | ブランド名 |
| `discount` | 任意 | number | 割引額 |

### なぜ `item_id` と `item_name` が両方必須なのか

GA4 のレポートでは `item_id` と `item_name` が別々の軸として使われる。
例えば「商品名を変更したが同じ商品を追いたい」ときは `item_id` で継続的に計測できる。
片方だけ送るとレポートの名寄せが崩れるため、**両方を常に含める**ことが重要。

---

## 3. `currency` と `value` の役割

### `currency`

ISO 4217 の通貨コード（3文字）を使う。日本円なら `'JPY'`。

GA4 は複数通貨をサポートしているが、**`currency` を省略するとレポートの収益計算が狂う**ことがある。
必ず明示的に渡す。

### `value`

`value` はイベント全体の「金銭的価値」を表す数値。

- `view_item` の場合: 閲覧した商品の価格（商品1つの `price`）
- `add_to_cart` の場合: 追加した商品の合計（`price × quantity`）
- `purchase` の場合: 注文の総額（税込・送料込み）

GA4 の「収益」レポートは `purchase` イベントの `value` を合算して表示する。
`view_item` や `add_to_cart` の `value` は直接売上に計上されないが、
ファネル分析での「損失した潜在収益」として活用できる。

---

## 4. `purchase` イベントの特別な仕様

`purchase` だけが持つ必須パラメータが `transaction_id`。

### `transaction_id` が必要な理由

GA4 は同一の `transaction_id` を持つ `purchase` イベントを**1回のみカウント**する。
これを「冪等性（べきとうせい）」という。

EC サイトでよくある問題:
- ユーザーが購入完了ページをリロードした → `purchase` が2回発火してしまう
- Webhook が再送されてきた → `purchase` が2回発火してしまう

`transaction_id` があれば GA4 側で重複を自動排除してくれる。

> 実装時は Stripe の `checkout.session.id` をそのまま `transaction_id` に使う。
> セッションIDはグローバルに一意であり、再送時も同じ値になるため最適。

---

## 5. フロントエンド vs サーバーサイドでの発火

eコマースイベントはどこから送るかが重要。

### フロントエンドで送る（`view_item` / `add_to_cart`）

ユーザーのアクション（ページ表示・ボタンクリック）に連動するため、
**ブラウザ側から `window.gtag()` を呼ぶ**のが自然。

ただし SSR（サーバーサイドレンダリング）の注意点がある。
Next.js の App Router では Server Components がデフォルト。
Server Components はサーバー上で実行されるため `window` オブジェクトが存在しない。
`view_item` を発火するには `'use client'` ディレクティブと `useEffect` が必要になる。

### サーバーサイドで送る（`purchase`）

購入完了は決済システム（Stripe）が確認してから送るのが正しい。
フロントエンドで送ると以下のリスクがある:

- 決済完了ページに到達できなかった場合（通信エラー）に未計測になる
- ユーザーが「戻る」→「進む」でページを再表示すると重複計測される
- Stripe 側で決済が取り消されても計測が残ってしまう

サーバーサイドから GA4 に送信するには **Measurement Protocol** という API を使う。
Stripe webhook を受け取った `app/api/webhook/stripe/route.ts` から直接送信する。

---

## 6. Measurement Protocol の仕組み

`window.gtag()` はブラウザ専用。サーバーから GA4 にデータを送るには
Measurement Protocol という HTTP API を使う。

```
サーバー → POST https://www.google-analytics.com/mp/collect
           ?measurement_id=G-XXXXXXXXXX
           &api_secret=XXXXXXXXXXXXXXXX
         body: { client_id, events: [...] }
```

`client_id` は GA4 がブラウザに設定する Cookie（`_ga`）の値。
Stripe webhook にはブラウザ情報がないため、`client_id` はセッション作成時に
あらかじめ取得してデータベースに保存しておく必要がある。

> Week 2 の handson では簡易的に固定の `client_id` を使う例で実装する。
> 本番環境では Order テーブルに `ga_client_id` カラムを追加して保存する。

---

## 7. カスタムディメンションとは

GA4 の標準パラメータに含まれない情報を分析軸として使いたい場合、
「カスタムディメンション」として登録する必要がある。

例えば `item_category` は `items` 配列の中に含まれるが、
GA4 の標準レポートで「カテゴリ別の購入数」を見るには
GA4 管理画面でカスタムディメンションとして明示的に登録する。

**コードでパラメータを送るだけでは不十分**。GA4 は未登録のパラメータを
収集しているが、レポートの軸として使えない。

カスタムディメンションの詳細な登録手順は `handson/custom_dimensions.md` を参照。

---

## まとめ

- GA4 eコマースイベントは名前・パラメータが Google に定義されている
- `items` 配列に `item_id` と `item_name` は必ず含める
- `currency` と `value` は常に明示的に渡す
- `purchase` には `transaction_id` が必須（重複除外のため）
- `view_item` / `add_to_cart` はクライアントサイド、`purchase` はサーバーサイドで送る
- カスタムディメンションは管理画面での登録が必要

次のステップ → `practice/01_design_quiz.md` で理解を確認してから handson へ進む。
