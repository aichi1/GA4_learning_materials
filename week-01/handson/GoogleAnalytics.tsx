'use client'

// GA4 初期化コンポーネント
// - layout.tsx に配置することで、全ページで GA4 計測が有効になる
// - usePathname でルート変化を監視し、SPA でも page_view を送信する
// - 'use client' が必要な理由: usePathname / useEffect はクライアント専用フック

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { pageview } from '@/lib/gtag'

// window.gtag の型を TypeScript に認識させる
// 宣言しないと `window.gtag` 参照時に型エラーになる
declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void
    dataLayer: unknown[]
  }
}

// Props 型: GA4 測定ID（G-XXXXXXXXXX 形式）を受け取る
interface GoogleAnalyticsProps {
  gaId: string
}

export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  // gaId が空の場合は何もレンダリングしない（開発環境など）
  if (!gaId) return null

  return (
    <>
      {/*
        gtag.js スクリプトの読み込み
        strategy="afterInteractive":
          ページのインタラクティブ化後に読み込む。
          "beforeInteractive" や "lazyOnload" ではなく
          afterInteractive を使うのが GA4 の推奨。
          忘れると計測が遅延したり、SSR エラーが起きることがある。
      */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />

      {/*
        gtag 初期化スクリプト
        id="google-analytics" を付与することで Next.js が重複読み込みを防ぐ
      */}
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}', {
            // debug_mode: true にすると DebugView に表示される
            // 本番環境では削除またはコメントアウトすること
            debug_mode: true
          });
        `}
      </Script>

      {/* ルート変化監視 */}
      <RouteChangeTracker gaId={gaId} />
    </>
  )
}

// SPA のルート変化を監視して page_view を送信するサブコンポーネント
// Next.js App Router では usePathname でパス変化を検知する
function RouteChangeTracker({ gaId }: { gaId: string }) {
  const pathname = usePathname()

  useEffect(() => {
    // pathname が変化するたびに page_view イベントを送信
    // 初回マウント時にも実行され、最初のページビューも計測される
    pageview(gaId, pathname)
  }, [gaId, pathname])

  // このコンポーネントは DOM を出力しない（null を返す）
  return null
}
