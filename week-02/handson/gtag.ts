// GA4 イベント送信ヘルパー関数（Week 2 拡張版）
// このファイルは lib/gtag.ts として配置する（Week 1 版を上書きする）
//
// Week 1 から追加したもの:
//   - GaItem 型（GA4 eコマース商品情報）
//   - sendViewItem()  — 商品詳細閲覧イベント
//   - sendAddToCart() — カート追加イベント
//   - sendPurchase()  — 購入完了イベント（Measurement Protocol 版は purchase_webhook.ts）
//
// 使い方（クライアントコンポーネントから）:
//   import { sendViewItem, sendAddToCart } from '@/lib/gtag'
//   sendViewItem({ item_id: 'prod_123', item_name: '名入れTシャツ', price: 3800, quantity: 1, item_category: 'tshirt' })

// ==============================
// window.gtag の型宣言
// ==============================

// Next.js の App Router では TypeScript の型チェックが window.gtag を知らないため、
// グローバル型として宣言する必要がある。これがないと `window.gtag(...)` の呼び出しで
// TypeScript エラーが発生する。
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params?: Record<string, any>
    ) => void
    dataLayer: unknown[]
  }
}

// ==============================
// 型定義
// ==============================

/**
 * GA4 eコマース商品情報の型
 *
 * GA4 の仕様で定められたフィールド名を使う。
 * 独自の名前（productId, productName など）は使わないこと。
 * GA4 レポートが商品を正しく認識できなくなる。
 */
export type GaItem = {
  item_id: string        // 商品ID（例: 'prod_123'）             ★ 必須
  item_name: string      // 商品名（例: '名入れTシャツ'）         ★ 必須
  price: number          // 単価・円（例: 3800）
  quantity: number       // 数量（例: 1）
  item_category?: string // カテゴリ（例: 'tshirt'）            任意
  item_brand?: string    // ブランド名                           任意
  discount?: number      // 割引額・円（例: 380）               任意
}

/**
 * GA4 汎用イベントパラメータの型（Week 1 互換）
 * Week 2 以降は GaItem を使うことが多いが、汎用 event() 関数で使う
 */
export type GtagEventParams = Record<string, string | number | boolean>

// ==============================
// ページビュー送信（Week 1 から引き継ぎ）
// ==============================

/**
 * page_view イベントを GA4 に送信する
 *
 * @param gaId - GA4 測定ID（G-XXXXXXXXXX 形式）
 * @param path - 現在のパス（例: '/products/123'）
 *
 * 呼び出しタイミング:
 *   GoogleAnalytics.tsx の RouteChangeTracker から、
 *   usePathname の変化のたびに自動的に呼び出される
 */
export function pageview(gaId: string, path: string): void {
  // window.gtag が存在しない場合（SSR時や gtag.js 未読み込み時）は何もしない
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  window.gtag('config', gaId, {
    page_path: path,
  })
}

// ==============================
// 汎用イベント送信（Week 1 から引き継ぎ）
// ==============================

/**
 * 任意の GA4 イベントを送信する汎用関数
 *
 * @param eventName - イベント名（例: 'click_banner'）
 * @param params    - イベントパラメータ
 *
 * eコマースイベントには sendViewItem / sendAddToCart / sendPurchase を使うこと。
 * この関数は標準外のカスタムイベント用に残している。
 */
export function event(eventName: string, params?: GtagEventParams): void {
  // window.gtag が存在しない場合は何もしない
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  window.gtag('event', eventName, params)
}

// ==============================
// eコマースイベント送信（Week 2 新規追加）
// ==============================

/**
 * view_item イベントを送信する — 商品詳細ページ表示時
 *
 * @param item - 閲覧した商品情報
 *
 * 使用例（商品詳細ページ）:
 *   useEffect(() => {
 *     sendViewItem({
 *       item_id: product.id,
 *       item_name: product.name,
 *       price: product.price,
 *       quantity: 1,
 *       item_category: product.category,
 *     })
 *   }, [product.id])
 *
 * ⚠ 注意: 必ず 'use client' コンポーネントの useEffect 内で呼ぶこと。
 *   Server Component や SSR のタイミングでは window が存在しないため失敗する。
 */
export function sendViewItem(item: GaItem): void {
  // SSR / gtag.js 未読み込み時のガード
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  // GA4 eコマース仕様: view_item には currency・value・items が必要
  window.gtag('event', 'view_item', {
    currency: 'JPY',        // 通貨コード。日本円は 'JPY'
    value: item.price,      // 商品の価格。GA4 の「商品別収益」に使われる
    items: [item],          // 配列で渡す。view_item は通常1件
  })
}

/**
 * add_to_cart イベントを送信する — カートに追加ボタン クリック時
 *
 * @param item - カートに追加した商品情報（quantity を正しく設定すること）
 *
 * 使用例（AddToCartButton コンポーネント）:
 *   const handleClick = () => {
 *     addToCartApi(item.id, quantity)   // API 呼び出し
 *     sendAddToCart({                    // GA4 イベント送信
 *       item_id: item.id,
 *       item_name: item.name,
 *       price: item.price,
 *       quantity: quantity,             // ← ユーザーが選んだ数量
 *       item_category: item.category,
 *     })
 *   }
 *
 * ⚠ value は「単価 × 数量」で計算する。単価だけを渡すと GA4 のレポートが不正確になる。
 */
export function sendAddToCart(item: GaItem): void {
  // SSR / gtag.js 未読み込み時のガード
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  // value = 単価 × 数量（合計金額）
  // GA4 の「カートへの追加 収益」レポートに使われる
  const totalValue = item.price * item.quantity

  window.gtag('event', 'add_to_cart', {
    currency: 'JPY',
    value: totalValue,  // ← 合計額（単価ではない）
    items: [item],
  })
}

/**
 * purchase イベントを送信する — クライアントサイドから送る場合（簡易版）
 *
 * @param orderId - 注文ID（Stripe checkout.session.id を推奨）
 * @param items   - 購入した商品一覧
 * @param total   - 購入総額（税込・送料込み）
 * @param coupon  - 使用したクーポンコード（なければ省略）
 *
 * ⚠ 本番環境では Stripe webhook からサーバーサイドで送ることを強く推奨。
 *   クライアントからの送信は「購入完了ページへの到達」しか計測できず、
 *   ページリロードで重複計測のリスクがある（transaction_id で排除されるが）。
 *   詳細: handson/purchase_webhook.ts を参照。
 *
 * transaction_id が重要な理由:
 *   GA4 は同一の transaction_id を持つ purchase イベントを1回のみカウントする。
 *   これにより、ページリロードや Webhook 再送による二重計測を防ぐ。
 */
export function sendPurchase(
  orderId: string,
  items: GaItem[],
  total: number,
  coupon?: string
): void {
  // SSR / gtag.js 未読み込み時のガード
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  window.gtag('event', 'purchase', {
    transaction_id: orderId, // ★ 必須。重複排除のキー。Stripe session.id を使う
    currency: 'JPY',
    value: total,            // 購入総額（税込・送料込み）
    items,                   // 購入した全商品の配列
    ...(coupon ? { coupon } : {}), // クーポンがあれば追加
  })
}
