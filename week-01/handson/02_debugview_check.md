# DebugView 確認手順

## 完了条件

- [ ] GA4 の DebugView に自分のデバイスが表示されている
- [ ] `page_view` イベントが DebugView に表示されている
- [ ] ページを遷移すると `page_view` が追加で発火することを確認できた

---

## DebugView とは（再確認）

DebugView は GA4 管理画面内のリアルタイム確認ツールです。
デバッグモードを有効にしたデバイスからのイベントだけが表示されるため、
本番データを汚さずに実装の動作確認ができます。

---

## Section 1: デバッグモードを有効化する

`GoogleAnalytics.tsx` の gtag 設定に `debug_mode: true` が含まれているか確認します。

```tsx
// GoogleAnalytics.tsx 内の Script
gtag('config', '${gaId}', {
  debug_mode: true  // ← これが必要
});
```

`debug_mode: true` が設定されていると、このデバイスからのイベントが
DebugView の専用ビューに表示されるようになります。

**注意**: `debug_mode: true` は開発・確認が終わったら削除またはコメントアウトしてください。
本番データと混在すると分析が難しくなります。

---

## Section 2: DebugView を開く

1. [https://analytics.google.com/](https://analytics.google.com/) を開く
2. 対象のプロパティを選択
3. 左側のメニューから「管理」（歯車アイコン）をクリック
4. 「DebugView」をクリック

### DebugView の画面構成

```
┌─────────────────────────────────────────────────────────┐
│ DebugView                                                │
│                                                          │
│ [デバイス一覧]    [タイムライン]    [イベント詳細]          │
│                                                          │
│ デバイス: Chrome/Desktop  ← 自分のデバイスが表示される    │
│                                                          │
│ タイムライン（時系列）:                                    │
│  10:30:01  page_view                                     │
│  10:30:01  session_start                                 │
│  10:30:01  first_visit                                   │
│                                                          │
│ イベント詳細（クリックで展開）:                            │
│  page_location: http://localhost:3000/                   │
│  page_path:     /                                        │
│  page_title:    EC Site                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Section 3: イベントを確認する

### 3-1. 最初のページビューを確認

1. `http://localhost:3000` をブラウザで開く（または再読み込みする）
2. DebugView を確認する
3. 以下のイベントが表示されれば成功

| イベント名 | 意味 |
|-----------|------|
| `page_view` | ページが表示された |
| `session_start` | セッションが開始した |
| `first_visit` | 初回訪問（Cookie がない状態のみ） |

### 3-2. ページ遷移のページビューを確認

SPA（Next.js）でのルート変化が正しく計測されているか確認します。

1. 別のページへ移動する（例: `/products` や `/cart`）
2. DebugView を確認する
3. 新しい `page_view` イベントが追加されれば成功

### 3-3. イベントの詳細を確認

DebugView でイベントをクリックすると、送信されたパラメータが確認できます。

`page_view` イベントの主なパラメータ:

| パラメータ名 | 値の例 | 説明 |
|-------------|--------|------|
| `page_location` | `http://localhost:3000/products` | フルURL |
| `page_path` | `/products` | パス部分 |
| `page_title` | `Products - EC Site` | ページタイトル |
| `session_id` | `1709123456` | セッションID |
| `engagement_time_msec` | `100` | エンゲージメント時間（ミリ秒） |

---

## Section 4: よくあるトラブルと解決方法

### DebugView に自分のデバイスが表示されない

**確認手順**:

1. `GoogleAnalytics.tsx` に `debug_mode: true` が設定されているか確認
2. 開発サーバーを再起動する（環境変数の反映に必要な場合がある）
3. ブラウザの広告ブロッカーを無効化する
4. シークレットウィンドウで試してみる

```bash
# 開発サーバー再起動
npm run dev
```

### page_view が1回しか飛ばない（ページ遷移で増えない）

App Router での `usePathname` 監視が機能していない可能性があります。

**確認ポイント**:

1. `GoogleAnalytics.tsx` に `RouteChangeTracker` コンポーネントが含まれているか
2. `'use client'` ディレクティブが `GoogleAnalytics.tsx` の先頭にあるか
3. `usePathname` のインポートが正しいか（`from 'next/navigation'`）

```tsx
// 確認: インポートが正しいか
import { usePathname } from 'next/navigation'  // ← 'next/router' ではなく 'next/navigation'
```

### CSP エラーでスクリプトがブロックされている

ブラウザのコンソールに以下のようなエラーが表示される場合:

```
Refused to load script 'https://www.googletagmanager.com/gtag/js?id=G-XXXXX'
because it violates the following Content Security Policy directive...
```

`next.config.js` の CSP 設定を確認してください（`01_ga4_setup.md` の Section 3 参照）。

### Network タブでリクエストが見えない

1. 開発者ツールの Network タブで `disable cache` を有効化
2. フィルタに `google-analytics` または `collect` を入力
3. ページをリロード

---

## Section 5: 動作確認チェックリスト

以下をすべてチェックできたら Week 1 の handson は完了です。

```
基本動作:
[ ] DebugView に自分のデバイスが表示される
[ ] page_view イベントが DebugView に表示される
[ ] session_start イベントが表示される

SPA 動作:
[ ] 別ページに移動すると page_view が追加で発火する
[ ] page_path パラメータに正しいパスが入っている

実装確認:
[ ] エラーなく next dev が起動する
[ ] ブラウザコンソールに CSP エラーが出ていない
[ ] TypeScript の型エラーが出ていない
```

---

## Week 1 完了おめでとうございます！

DebugView に `page_view` が表示されれば、GA4 の基盤実装は完了です。

### 次のステップ（Week 2 の予告）

Week 2 では、EC サイト固有のカスタムイベントを実装します。

- `view_item`: 商品詳細ページを見たとき
- `add_to_cart`: カートに商品を追加したとき
- `purchase`: 購入が完了したとき（Stripe webhook と連携）

今週実装した `event()` 関数（`lib/gtag.ts`）を使って、
これらのイベントを各コンポーネントに追加していきます。
