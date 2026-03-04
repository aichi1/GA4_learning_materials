// カート追加ボタンへの add_to_cart イベント組み込みコード
//
// 配置先: app/components/AddToCartButton.tsx
//
// このコンポーネントの責務:
//   1. カート追加 API を呼び出す
//   2. GA4 に add_to_cart イベントを送信する
//   3. ユーザーに完了フィードバックを表示する
//
// ★ 設計ポイント:
//   onClick ハンドラを使うため必ず 'use client' が必要。
//   カート追加ボタンは必然的に Client Component になる。

'use client'

import { useState } from 'react'
import { sendAddToCart, type GaItem } from '@/lib/gtag'

// ==============================
// 型定義
// ==============================

/**
 * AddToCartButton の Props
 * 親コンポーネント（Server Component）から商品情報を受け取る
 */
type Props = {
  item: GaItem      // 追加する商品情報（item_id, item_name, price, quantity）
  className?: string // Tailwind CSS クラス（スタイルは親が制御）
}

// ==============================
// カート追加 API の呼び出し（実際の EC プロジェクトに合わせて変更）
// ==============================

/**
 * カート追加 API を呼び出す
 * EC_project_sdd_v7 の実際のエンドポイントに合わせて変更すること
 *
 * @param itemId  - 商品ID
 * @param quantity - 数量
 * @throws Error  - API 呼び出し失敗時
 */
async function addToCartApi(itemId: string, quantity: number): Promise<void> {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, quantity }),
  })

  if (!res.ok) {
    // API エラーの場合は GA4 イベントを送信しない（後述）
    throw new Error(`カート追加に失敗しました: ${res.status}`)
  }
}

// ==============================
// コンポーネント
// ==============================

/**
 * カートに追加ボタンコンポーネント
 *
 * 使い方（商品詳細ページ）:
 *
 * ```tsx
 * import { AddToCartButton } from '@/components/AddToCartButton'
 *
 * export default async function ProductPage({ params }) {
 *   const product = await getProduct(params.id)
 *   return (
 *     <div>
 *       <h1>{product.name}</h1>
 *       <AddToCartButton
 *         item={{
 *           item_id: product.id,
 *           item_name: product.name,
 *           price: product.price,
 *           quantity: 1,           // ← 実際には数量セレクタと連動させる
 *           item_category: product.category,
 *         }}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */
export function AddToCartButton({ item, className }: Props) {
  // ボタンの状態管理
  // 'idle': 通常状態 / 'loading': API呼び出し中 / 'success': 追加完了 / 'error': エラー
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleClick = async () => {
    // 二重クリック防止（API 呼び出し中は無効）
    if (status === 'loading') return

    setStatus('loading')

    try {
      // ステップ1: カート追加 API を呼び出す
      await addToCartApi(item.item_id, item.quantity)

      // ステップ2: API 成功後に GA4 イベントを送信する
      //
      // ★ なぜ API 成功後に送るのか?
      //   API 失敗（在庫なし・認証エラーなど）の場合にまで
      //   「カート追加した」と GA4 に記録するのは誤計測になる。
      //   実際にカートに入った場合のみイベントを送る。
      sendAddToCart(item)

      setStatus('success')

      // 2秒後に通常状態に戻す
      setTimeout(() => setStatus('idle'), 2000)

    } catch (err) {
      // API エラーの場合は GA4 に送信しない（何も呼ばずにエラー状態へ）
      console.error('カート追加エラー:', err)
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  // ==============================
  // ボタンのラベルを状態に応じて切り替え
  // ==============================

  const buttonLabel = {
    idle: 'カートに追加',
    loading: '追加中...',
    success: '追加しました ✓',
    error: 'エラーが発生しました',
  }[status]

  // ==============================
  // レンダリング
  // ==============================

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      className={className}
      aria-busy={status === 'loading'}
      // aria-live でスクリーンリーダーに状態変化を通知
      aria-label={buttonLabel}
    >
      {buttonLabel}
    </button>
  )
}

// ==============================
// 発展: 数量セレクタ付きバージョン
// ==============================

/**
 * 数量を選んでカートに追加するコンポーネント（発展版）
 *
 * 使い方:
 * ```tsx
 * <AddToCartButtonWithQuantity
 *   baseItem={{
 *     item_id: product.id,
 *     item_name: product.name,
 *     price: product.price,
 *     quantity: 1,  // ← 初期値（ユーザーが変更可能）
 *   }}
 * />
 * ```
 */
export function AddToCartButtonWithQuantity({ baseItem }: { baseItem: GaItem }) {
  const [quantity, setQuantity] = useState(1)

  // quantity が変わるたびに item オブジェクトを再計算
  const item: GaItem = { ...baseItem, quantity }

  return (
    <div>
      {/* 数量選択 */}
      <label htmlFor="quantity">数量</label>
      <input
        id="quantity"
        type="number"
        min={1}
        max={10}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
      />

      {/* カート追加ボタン（quantity が反映された item を渡す） */}
      <AddToCartButton item={item} />

      {/* 合計金額の表示 */}
      <p>小計: {(item.price * quantity).toLocaleString()}円</p>
    </div>
  )
}

// ==============================
// DebugView での確認方法
// ==============================

/*
 * add_to_cart イベントが正しく送信されているか確認する手順:
 *
 * 1. GA4 DebugView を開いた状態で商品詳細ページを表示
 *
 * 2. 「カートに追加」ボタンをクリック
 *
 * 3. DebugView に 'add_to_cart' が表示されることを確認
 *    表示されるパラメータ:
 *    - currency: "JPY"
 *    - value: 3800  (price × quantity の合計)
 *    - items: [{item_id: "...", item_name: "...", price: 3800, quantity: 1}]
 *
 * よくあるミス:
 * - API 呼び出しの前に sendAddToCart を呼んでしまう（API エラー時も計測されてしまう）
 * - value に単価を渡している（price × quantity の合計を渡すこと）
 * - quantity が常に 1 になっている（数量セレクタと連動させること）
 */
