// Stripe webhook → GA4 purchase イベント送信
//
// 配置先: app/api/webhook/stripe/route.ts
//
// このファイルの役割:
//   Stripe の決済完了通知（checkout.session.completed）を受け取り、
//   GA4 Measurement Protocol を使って purchase イベントをサーバーから直接送信する。
//
// ★ なぜサーバーサイドで送るのか?
//   フロントエンドからの purchase 送信は「購入完了ページへの到達」しか計測できない。
//   サーバーサイドで Stripe webhook を起点にすることで:
//   - 通信エラーによる未計測を防ぐ
//   - Stripe 側で決済が確定したことを確認してから送れる
//   - クライアントが直接制御できるため改ざんリスクが低い
//
// ==============================
// 必要な環境変数
// ==============================
// .env.local に以下を設定すること:
//
//   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx    # Stripe ダッシュボードで取得
//   NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX         # GA4 測定ID
//   GA4_API_SECRET=xxxxxxxxxxxxxxxx         # GA4 管理画面 → データストリーム → Measurement Protocol API シークレット
//
// ⚠ GA4_API_SECRET は絶対にクライアントに露出させない。
//   NEXT_PUBLIC_ プレフィックスをつけないこと。

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ==============================
// 型定義
// ==============================

/**
 * Measurement Protocol に渡す商品情報の型
 * GA4 仕様に準拠したフィールド名を使う
 */
type MpItem = {
  item_id: string
  item_name: string
  price: number
  quantity: number
  item_category?: string
}

/**
 * Measurement Protocol のイベントペイロード型
 */
type MpPurchaseEvent = {
  name: 'purchase'
  params: {
    transaction_id: string
    currency: string
    value: number
    items: MpItem[]
    coupon?: string
  }
}

// ==============================
// Stripe クライアントの初期化
// ==============================

// Stripe シークレットキーは環境変数から読み込む
// STRIPE_SECRET_KEY は .env.local に設定すること
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// ==============================
// GA4 Measurement Protocol 送信関数
// ==============================

/**
 * GA4 Measurement Protocol で purchase イベントを送信する
 *
 * @param clientId     - GA4 クライアントID（Cookie の _ga 値）
 * @param purchaseData - 購入データ
 *
 * Measurement Protocol の仕組み:
 *   GA4 の Measurement Protocol は HTTP POST でイベントを直接受け付ける。
 *   ブラウザ経由（window.gtag）ではなくサーバーから直接送信できる。
 *
 *   エンドポイント:
 *     POST https://www.google-analytics.com/mp/collect
 *       ?measurement_id=G-XXXXXXXXXX
 *       &api_secret=XXXXXXXXXXXXXXXX
 *
 * client_id について:
 *   GA4 はユーザーを識別するために client_id を使う。
 *   ブラウザが設定する _ga Cookie の値（GA1.2.XXXXXXXXXX.XXXXXXXXXX 形式）から
 *   数字部分を抽出したもの。
 *   Webhook には client_id がないため、注文作成時にフロントから送って
 *   データベースに保存しておく必要がある。
 *
 * 本番実装での client_id の取得方法:
 *   1. フロントエンドで document.cookie から _ga の値を取得
 *   2. チェックアウト開始時に API に送信して Orders テーブルに保存
 *   3. Webhook で注文を取得する際に一緒に取得する
 */
async function sendPurchaseToGA4(
  clientId: string,
  event: MpPurchaseEvent
): Promise<void> {
  const measurementId = process.env.NEXT_PUBLIC_GA4_ID
  const apiSecret = process.env.GA4_API_SECRET

  // 環境変数が設定されていない場合はログを出して終了
  if (!measurementId || !apiSecret) {
    console.warn('[GA4] 環境変数が設定されていません: NEXT_PUBLIC_GA4_ID または GA4_API_SECRET')
    return
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`

  const payload = {
    client_id: clientId,  // ユーザーを識別するGA4クライアントID
    events: [event],      // 送信するイベントの配列（1回のリクエストに最大25件）
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    // Measurement Protocol は成功時に 204 No Content を返す
    if (res.ok) {
      console.log(`[GA4] purchase イベント送信成功: transaction_id=${event.params.transaction_id}`)
    } else {
      console.error(`[GA4] purchase イベント送信失敗: ${res.status}`)
    }
  } catch (err) {
    // GA4 への送信失敗はログに残すが、Webhook の処理は続行する
    // （GA4 の送信失敗で注文確認メール等の処理を止めてはいけない）
    console.error('[GA4] Measurement Protocol エラー:', err)
  }
}

// ==============================
// Stripe セッションから商品情報を構築する
// ==============================

/**
 * Stripe の checkout.session から GA4 用の items 配列を構築する
 *
 * @param session - Stripe CheckoutSession（line_items を展開した状態）
 * @returns GA4 Measurement Protocol 用の MpItem 配列
 *
 * ★ なぜ line_items を別途取得するのか?
 *   Stripe の webhook イベントに含まれる session オブジェクトは
 *   デフォルトで line_items を含まない。
 *   `stripe.checkout.sessions.retrieve()` で line_items を展開して取得する必要がある。
 */
async function buildItemsFromSession(session: Stripe.Checkout.Session): Promise<MpItem[]> {
  // line_items を展開して取得
  const lineItems = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items.data.price.product'],
  })

  if (!lineItems.line_items?.data) {
    return []
  }

  return lineItems.line_items.data.map((lineItem) => {
    const product = lineItem.price?.product as Stripe.Product | undefined

    return {
      item_id: product?.id ?? 'unknown',
      item_name: product?.name ?? lineItem.description ?? 'unknown',
      // Stripe の金額は最小単位（円の場合は整数）で管理される
      price: (lineItem.price?.unit_amount ?? 0),
      quantity: lineItem.quantity ?? 1,
      item_category: product?.metadata?.category,  // 商品メタデータからカテゴリを取得
    }
  })
}

// ==============================
// Webhook ハンドラ（Next.js App Router）
// ==============================

/**
 * Stripe Webhook エンドポイント
 *
 * 処理フロー:
 *   1. Stripe 署名を検証（改ざん検知）
 *   2. checkout.session.completed イベントのみ処理
 *   3. セッションから購入情報を取得
 *   4. GA4 Measurement Protocol で purchase イベントを送信
 *   5. （実際の EC サイトでは注文確認メール送信などの処理も追加）
 *
 * ⚠ localhost での開発時の注意:
 *   Stripe webhook は公開 URL にしか届かない。
 *   ローカル開発では以下のいずれかを使う:
 *
 *   方法1 - Stripe CLI:
 *     stripe listen --forward-to localhost:3000/api/webhook/stripe
 *
 *   方法2 - ngrok:
 *     ngrok http 3000
 *     → 発行された URL を Stripe ダッシュボードに登録
 *
 *   Stripe CLI を推奨（署名も自動で処理してくれる）。
 */
export async function POST(req: NextRequest) {
  // Stripe の生のリクエストボディが必要（署名検証のため）
  const body = await req.text()

  // リクエストヘッダーから Stripe の署名を取得
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: '署名が見つかりません' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    // ★ 署名検証は必須。これをしないと偽の Webhook を受け入れてしまう
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Stripe 署名検証エラー:', err)
    return NextResponse.json({ error: '署名検証失敗' }, { status: 400 })
  }

  // ==============================
  // イベントタイプに応じて処理
  // ==============================

  // checkout.session.completed = 決済が正常に完了した
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    console.log(`[Stripe] 決済完了: session_id=${session.id}`)

    // ==============================
    // GA4 purchase イベント送信
    // ==============================

    // client_id の取得（本番実装）:
    //   session.metadata に保存しておいた client_id を使う
    //   例: const clientId = session.metadata?.ga_client_id ?? 'anonymous'
    //
    // 今回の handson では固定値で代用（動作確認が目的）
    const clientId = session.metadata?.ga_client_id ?? '555.123456789'

    // Stripe セッションから商品情報を構築
    const items = await buildItemsFromSession(session)

    // GA4 purchase イベントのペイロードを作成
    const purchaseEvent: MpPurchaseEvent = {
      name: 'purchase',
      params: {
        // ★ transaction_id は必須
        //   Stripe の session.id は冪等性が保証されているため最適
        //   同じ session.id で2回送っても GA4 は1回のみカウントする
        transaction_id: session.id,

        currency: session.currency?.toUpperCase() ?? 'JPY',

        // Stripe の金額は最小単位（円は整数、USD はセント）
        // 日本円の場合はそのままの値を使う
        value: (session.amount_total ?? 0),

        items,

        // クーポンが適用されていれば記録
        ...(session.discounts?.[0]?.coupon?.name
          ? { coupon: session.discounts[0].coupon.name }
          : {}),
      },
    }

    // GA4 に送信
    await sendPurchaseToGA4(clientId, purchaseEvent)

    // TODO: ここに注文確認メール送信、在庫更新などの処理を追加
  }

  // Stripe には 200 を返して受信完了を伝える
  // 200 を返さないと Stripe が Webhook を再送し続ける
  return NextResponse.json({ received: true })
}

// ==============================
// 動作確認の手順（handson 用）
// ==============================

/*
 * Stripe Webhook をローカルでテストする手順:
 *
 * 1. Stripe CLI をインストール
 *    https://stripe.com/docs/stripe-cli
 *
 * 2. Stripe ダッシュボードでログイン
 *    stripe login
 *
 * 3. Webhook を localhost に転送
 *    stripe listen --forward-to localhost:3000/api/webhook/stripe
 *
 * 4. 別のターミナルでテストイベントを送信
 *    stripe trigger checkout.session.completed
 *
 * 5. GA4 DebugView で purchase イベントが届いていることを確認
 *    ※ Measurement Protocol は DebugView に表示されないことがある。
 *      その場合は GA4 の「リアルタイム」レポートで確認する。
 *
 * 本番 Webhook の登録方法:
 *   Stripe ダッシュボード → [開発者] → [Webhook] → [エンドポイントを追加]
 *   URL: https://your-domain.com/api/webhook/stripe
 *   イベント: checkout.session.completed を選択
 */
