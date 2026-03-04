// GA4 イベント送信ヘルパー関数
// このファイルは lib/gtag.ts として配置する
//
// 使い方:
//   import { pageview, event } from '@/lib/gtag'
//   pageview(gaId, '/products/123')
//   event('add_to_cart', { item_id: 'abc', value: 1000 })

// ==============================
// 型定義
// ==============================

// GA4 イベントのパラメータ型
// GA4 では任意のキー・バリューを送信できる
export type GtagEventParams = Record<string, string | number | boolean>

// ==============================
// ページビュー送信
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
// 汎用イベント送信
// ==============================

/**
 * 任意の GA4 イベントを送信する汎用関数
 *
 * @param eventName - イベント名（例: 'add_to_cart', 'purchase'）
 * @param params    - イベントパラメータ（任意のキー・バリュー）
 *
 * 使用例:
 *   // 商品詳細を見たとき
 *   event('view_item', { item_id: 'shirt-001', item_name: 'Tシャツ', value: 3000 })
 *
 *   // カートに追加したとき
 *   event('add_to_cart', { item_id: 'shirt-001', value: 3000, currency: 'JPY' })
 *
 * Week 2 では、ECサイト固有のイベント（view_item / add_to_cart / purchase）を
 * この関数を使って実装する
 */
export function event(eventName: string, params?: GtagEventParams): void {
  // window.gtag が存在しない場合は何もしない
  if (typeof window === 'undefined' || typeof window.gtag === 'undefined') {
    return
  }

  window.gtag('event', eventName, params)
}

// ==============================
// 【参考】Week 2 で追加予定のイベント
// ==============================
//
// 以下は Week 2 の handson で実装する。今は読むだけでOK。
//
// export function viewItem(item: { id: string; name: string; price: number }) {
//   event('view_item', {
//     currency: 'JPY',
//     value: item.price,
//     items: [{ item_id: item.id, item_name: item.name, price: item.price }],
//   })
// }
//
// export function addToCart(item: { id: string; name: string; price: number; quantity: number }) {
//   event('add_to_cart', {
//     currency: 'JPY',
//     value: item.price * item.quantity,
//     items: [{ item_id: item.id, item_name: item.name, price: item.price, quantity: item.quantity }],
//   })
// }
