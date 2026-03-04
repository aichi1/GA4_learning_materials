// 商品詳細ページへの view_item イベント組み込みコード
//
// 配置先: app/products/[id]/page.tsx または
//         app/products/[id]/_components/ProductViewTracker.tsx（推奨）
//
// ★ なぜ別コンポーネントに分けるのか?
//   Next.js App Router では page.tsx をサーバーコンポーネントのままにすると
//   SEO（メタデータ生成）や静的最適化の恩恵を受けられる。
//   GA4 イベントはブラウザ側でのみ発火できるため、
//   'use client' が必要な部分を分離するのがベストプラクティス。

'use client'
// ↑ これがないと useEffect / useState は使えない。
//   'use client' を書くと「このファイル以下のコンポーネントツリーはクライアントで実行する」という宣言になる。

import { useEffect } from 'react'
import { sendViewItem, type GaItem } from '@/lib/gtag'

// ==============================
// 型定義
// ==============================

/**
 * ProductViewTracker コンポーネントの Props
 * 親（Server Component）から商品データを受け取る
 */
type Props = {
  item: GaItem
}

// ==============================
// コンポーネント（推奨パターン）
// ==============================

/**
 * 商品詳細ページ表示時に view_item を発火するトラッカーコンポーネント
 *
 * 使い方（app/products/[id]/page.tsx）:
 *
 * ```tsx
 * import { ProductViewTracker } from './_components/ProductViewTracker'
 *
 * export default async function ProductPage({ params }: { params: { id: string } }) {
 *   const product = await getProduct(params.id)   // Server Component でデータ取得
 *   return (
 *     <main>
 *       <h1>{product.name}</h1>
 *       <p>{product.price}円</p>
 *       {/* GA4 計測用トラッカー（見た目なし）*\/}
 *       <ProductViewTracker
 *         item={{
 *           item_id: product.id,
 *           item_name: product.name,
 *           price: product.price,
 *           quantity: 1,
 *           item_category: product.category,
 *         }}
 *       />
 *     </main>
 *   )
 * }
 * ```
 */
export function ProductViewTracker({ item }: Props) {
  useEffect(() => {
    // useEffect はブラウザでのマウント後に実行される
    // = window.gtag が確実に存在するタイミング
    //
    // 依存配列に item.item_id を指定することで:
    // - ページ表示時に1回発火
    // - 別の商品ページに遷移した場合も正しく再発火
    // - 同じページのリロードでも1回だけ発火（ブラウザが再マウントするため）
    sendViewItem(item)
  }, [item.item_id]) // item.item_id が変わったときだけ再実行

  // このコンポーネントは見た目を持たない（トラッキング専用）
  // null を返すことで DOM に何も追加しない
  return null
}

// ==============================
// 別パターン: ページコンポーネントに直接組み込む場合
// ==============================

/**
 * ページ全体を Client Component にする場合の実装パターン
 *
 * ⚠ このパターンの欠点:
 *   - 'use client' によりサーバーサイドレンダリングが無効になる
 *   - generateMetadata() が使えなくなる（SEO に影響する可能性）
 *   - データ取得が CSR になり初期表示が遅くなる可能性がある
 *
 * 小規模なプロジェクトや SEO を気にしない場合は使っても問題ない。
 * ただし推奨は上記の ProductViewTracker を分離するパターン。
 *
 * 使い方例:
 * ```tsx
 * 'use client'
 * import { useEffect } from 'react'
 * import { sendViewItem } from '@/lib/gtag'
 *
 * export default function ProductPage({ product }: { product: Product }) {
 *   useEffect(() => {
 *     sendViewItem({
 *       item_id: product.id,
 *       item_name: product.name,
 *       price: product.price,
 *       quantity: 1,
 *     })
 *   }, [product.id])
 *
 *   return <div>{product.name}</div>
 * }
 * ```
 */

// ==============================
// DebugView での確認方法
// ==============================

/*
 * view_item イベントが正しく送信されているか確認する手順:
 *
 * 1. Chrome で GA4 デバッグ拡張機能を有効にする
 *    (または URL に ?gtm_debug=... を追加する)
 *
 * 2. GA4 管理画面 → [管理] → [DebugView] を開く
 *
 * 3. 商品詳細ページを開く
 *
 * 4. DebugView に 'view_item' が表示されることを確認
 *    表示されるパラメータ:
 *    - currency: "JPY"
 *    - value: 3800  (商品の価格)
 *    - items: [{item_id: "...", item_name: "...", price: 3800, quantity: 1}]
 *
 * よくあるミス:
 * - 'use client' を忘れていると useEffect が使えずエラーになる
 * - useEffect の依存配列が空([])だと商品ページ遷移時に再発火しない
 * - sendViewItem を useEffect の外で呼ぶと SSR 時にエラーになる
 */
