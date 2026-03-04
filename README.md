# GA4 Learning — Next.js × EC サイト 自前実装カリキュラム

**計測設計 → 実装 → Looker Studio 可視化を一気通貫で習得する4週間プログラム**

[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Google Analytics](https://img.shields.io/badge/Google_Analytics-4-orange)](https://analytics.google.com/)
[![Looker Studio](https://img.shields.io/badge/Looker_Studio-Free-blue)](https://lookerstudio.google.com/)

---

## 概要 / Overview

このリポジトリは、**EC サイト（Next.js + さくらVPS）への GA4 自前実装**を
副業・フリーランス提案で使えるポートフォリオとして仕上げるための4週間カリキュラムです。

### 何を証明できるか

- GA4 プロパティ設定から `gtag.js` 実装まで自力でできる
- eコマースイベント（view_item / add_to_cart / purchase）を設計・実装できる
- Stripe webhook と連携して purchase イベントを発火できる
- Looker Studio で KPI ダッシュボードを構築・URL 共有できる

---

## 技術スタック / Tech Stack

| カテゴリ | 技術 | 備考 |
|---------|------|------|
| フレームワーク | Next.js 14 (App Router) + TypeScript | `layout.tsx` に gtag.js を直接組み込み |
| ホスティング | さくらVPS | Vercel 不使用・セルフホスト |
| 計測 | Google Analytics 4 (gtag.js) | GTM 不使用 |
| 決済 | Stripe | webhook → `purchase` イベント連携 |
| 可視化 | Looker Studio | 無料・GA4 と直接接続 |
| スタイル | Tailwind CSS | — |
| DB | PostgreSQL (Supabase/Railway) + Prisma | — |
| 認証 | Auth.js (NextAuth v5) | — |

### 実装の特徴

- **GTM（Google Tag Manager）不使用** — `gtag.js` を `layout.tsx` に直接埋め込む方式
- **Vercel 自動統合なし** — さくらVPS 環境に対応した手動設定
- **CSP ヘッダー設定** — `*.google-analytics.com` の許可設定を含む
- **Stripe webhook 連携** — サーバーサイドで `purchase` イベントを確実に発火

---

## カリキュラム構成 / Curriculum Structure

```
curriculum/
├── week-01/   GA4 基礎・gtag.js 組み込み
│   ├── lecture/    Lecture: 概念・仕組みの解説
│   ├── practice/   Practice: 理解確認・設計演習
│   └── handson/    Handson: 実際に手を動かす実装手順
├── week-02/   eコマースイベント計測設計・実装
├── week-03/   ファネル・チャネル・セグメント分析
└── week-04/   Looker Studio ダッシュボード・ポートフォリオ化
```

各 Week は `lecture（読む）< practice（考える）< handson（書く）` の比率で構成されています。

---

## 主要な成果物 / Key Deliverables

### Week 1: GA4 基礎実装

- `app/components/GoogleAnalytics.tsx` — GA4 初期化コンポーネント
- `lib/gtag.ts` — イベント送信ヘルパー関数
- GA4 DebugView での動作確認

### Week 2: eコマースイベント

- eコマースイベント設計書（`event_spec.md`）
- `view_item` / `add_to_cart` / `purchase` の実装
- Stripe webhook との `purchase` イベント連携

### Week 3: 分析スキル

- ファネル探索レポートの設定と読み方
- チャネル別・セグメント別分析の実施

### Week 4: Looker Studio ダッシュボード

| KPI | 指標 |
|-----|------|
| セッション数・ユーザー数 | アクティブユーザー数・セッション |
| 直帰率 | 直帰率 |
| 売上合計 | 購入による収益 |
| 購入ファネル | view_item → add_to_cart → purchase |
| チャネル別 | セッションのデフォルト チャネル グループ |

---

## ファイル構成（GA4 実装部分）

```
app/
├── layout.tsx              # gtag.js の読み込み・GoogleAnalytics コンポーネント配置
├── components/
│   └── GoogleAnalytics.tsx # GA4 初期化・ページビュー送信
lib/
└── gtag.ts                 # イベント送信ヘルパー（pageview / event）
```

### GoogleAnalytics.tsx（概要）

```tsx
'use client'
import Script from 'next/script'

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  )
}
```

### eコマースイベント実装例（purchase）

```typescript
// Stripe webhook 内での purchase イベント発火
gtag('event', 'purchase', {
  transaction_id: session.id,
  value: session.amount_total / 100,
  currency: 'JPY',
  items: lineItems.map(item => ({
    item_id: item.price?.product as string,
    item_name: item.description,
    price: item.amount_total / 100,
    quantity: item.quantity,
  })),
})
```

---

## 関連ドキュメント / Documentation

| ドキュメント | 内容 |
|-------------|------|
| `docs/requirements.md` | 目的・スコープ・成功条件 |
| `docs/tech-stack.md` | 技術スタック詳細 |
| `docs/constraints.md` | GTM 不使用・さくらVPS 制約 |
| `docs/plan.md` | フェーズ構成・教材フォルダ構成 |
| `docs/portfolio_guide.md` | 副業提案への活用ガイド・提案文テンプレート |

---

## 非スコープ / Out of Scope

以下は本カリキュラムの対象外です:

- GA4 × BigQuery 連携
- サーバーサイド GTM (SST)
- A/B テスト (GA4 Experiments)
- Firebase との統合

---

## ポートフォリオとしての活用

副業・フリーランス提案への活用方法は `docs/portfolio_guide.md` を参照してください。

- 提案文テンプレート（GA4実装経験の書き方）
- Looker Studio ダッシュボードの URL 共有設定
- スクリーンショット戦略（個人情報・実売上の非表示方法）

---

## ライセンス / License

MIT License — 学習・副業ポートフォリオ目的での利用・改変は自由です。
