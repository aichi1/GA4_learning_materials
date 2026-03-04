# GA4 プロパティ作成 + Next.js への組み込み

## 完了条件

このドキュメントの手順を完了すると、以下の状態になります。

- [ ] GA4 プロパティが作成され、測定ID（G-XXXXXXXXXX）を取得済み
- [ ] `.env.local` に `NEXT_PUBLIC_GA_ID` が設定済み
- [ ] `GoogleAnalytics.tsx` と `gtag.ts` がプロジェクトに配置済み
- [ ] `layout.tsx` に `<GoogleAnalytics>` が組み込まれている
- [ ] `next dev` でローカル起動し、エラーなく動作する

---

## Section 1: GA4 プロパティを作成する

### 1-1. GA4 管理画面にアクセス

1. [https://analytics.google.com/](https://analytics.google.com/) にアクセス
2. Google アカウントでログイン

### 1-2. アカウント作成（初回のみ）

既存のアカウントがある場合はスキップしてください。

1. 左下の「管理」をクリック
2. 「アカウントを作成」をクリック
3. アカウント名を入力（例: `MyECProject`）
4. データ共有設定はデフォルトのままでOK
5. 「次へ」をクリック

### 1-3. プロパティ作成

1. プロパティ名を入力（例: `EC Site - 開発`）
2. タイムゾーン: `日本` を選択
3. 通貨: `日本円 (JPY)` を選択
4. 「次へ」をクリック
5. ビジネスの説明（業種・規模）を選択 → 「次へ」
6. ビジネス目標を選択（「見込み客の発掘」など、どれでもOK）
7. 「作成」をクリック → 利用規約に同意

### 1-4. データストリームの設定

1. 「ウェブ」を選択
2. ウェブサイトのURL を入力
   - ローカル開発の場合: `http://localhost:3000`
   - 本番の場合: 実際のドメイン（例: `https://example.com`）
3. ストリーム名を入力（例: `EC Site Web`）
4. 「ストリームを作成」をクリック

### 1-5. 測定ID を確認・コピー

ストリーム作成後、「測定ID」欄に `G-XXXXXXXXXX` 形式のIDが表示されます。

```
測定ID: G-ABCD1234EF  ← この値をコピーしておく
```

---

## Section 2: Next.js プロジェクトに組み込む

### 2-1. ファイルをプロジェクトに配置

このディレクトリにある以下のファイルを、プロジェクトの指定の場所にコピーします。

| コピー元（handson/） | コピー先（プロジェクト） |
|---------------------|------------------------|
| `GoogleAnalytics.tsx` | `app/components/GoogleAnalytics.tsx` |
| `gtag.ts` | `lib/gtag.ts` |

```bash
# プロジェクトルートで実行
cp curriculum/week-01/handson/GoogleAnalytics.tsx app/components/GoogleAnalytics.tsx
cp curriculum/week-01/handson/gtag.ts lib/gtag.ts
```

### 2-2. 環境変数を設定する

プロジェクトルートの `.env.local` に測定ID を追加します。

```bash
# .env.local
NEXT_PUBLIC_GA_ID=G-ABCD1234EF  # ← 自分の測定IDに書き換える
```

**注意**: `NEXT_PUBLIC_` プレフィックスを付けることで、
クライアントサイド（ブラウザ）のコードからも参照できるようになります。
このプレフィックスがないと `undefined` になります。

`.env.local` は `.gitignore` に含まれているはずです。
測定IDは秘密情報ではありませんが、本番IDを直接コードに書くのは避けましょう。

### 2-3. layout.tsx を修正する

`layout.tsx.patch` を参考に、`app/layout.tsx` を以下のように修正します。

#### 変更前（抜粋）

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
```

#### 変更後（抜粋）

```tsx
import { GoogleAnalytics } from '@/components/GoogleAnalytics'

const gaId = process.env.NEXT_PUBLIC_GA_ID ?? ''

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className={inter.className}>
        <GoogleAnalytics gaId={gaId} />
        {children}
      </body>
    </html>
  )
}
```

---

## Section 3: CSP（コンテンツセキュリティポリシー）の設定

さくらVPS では CSP ヘッダーを手動で設定する必要があります。
設定しないと、GA4 への通信がブラウザにブロックされて計測できません。

### CSP に追加が必要なディレクティブ

```
script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com
connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net
img-src 'self' https://www.google-analytics.com https://www.googletagmanager.com
```

### Next.js での CSP 設定方法

`next.config.js`（または `next.config.mjs`）に以下を追加します。

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net",
              "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

**注意**: `'unsafe-inline'` は Next.js の Script コンポーネントが必要とする設定です。
より厳密な CSP が必要な場合は nonce を使う方法もありますが、今回はシンプルな設定で進めます。

---

## Section 4: 動作確認

### 4-1. 開発サーバーを起動

```bash
npm run dev
```

エラーが出た場合は以下を確認してください。

| エラー内容 | 原因 | 対処 |
|-----------|------|------|
| `Cannot find module '@/lib/gtag'` | gtag.ts の配置場所が違う | `lib/gtag.ts` に配置されているか確認 |
| `Cannot find module '@/components/GoogleAnalytics'` | コンポーネントの配置場所が違う | `app/components/GoogleAnalytics.tsx` に配置されているか確認 |
| `NEXT_PUBLIC_GA_ID is undefined` | 環境変数が設定されていない | `.env.local` を確認、サーバー再起動 |
| TypeScript エラー: `window.gtag` | 型定義がない | `GoogleAnalytics.tsx` の `declare global` 部分が含まれているか確認 |

### 4-2. ブラウザの開発者ツールで確認

1. ブラウザで `http://localhost:3000` を開く
2. 開発者ツール → Network タブを開く
3. フィルタに `google-analytics` または `gtag` を入力
4. ページをリロードすると、`gtag/js?id=G-XXXXXX` へのリクエストが見えるはず

---

## トラブルシューティング

### よくある問題

**計測が飛ばない（DebugView に何も表示されない）**

1. `NEXT_PUBLIC_GA_ID` の値が正しいか確認
2. ブラウザの広告ブロッカー（uBlock Origin など）を無効化して試す
3. CSP エラーがないか、ブラウザのコンソールを確認
4. `debug_mode: true` が `GoogleAnalytics.tsx` の gtag config に含まれているか確認

**SPA でページ遷移しても page_view が増えない**

`GoogleAnalytics.tsx` 内の `RouteChangeTracker` コンポーネントが含まれているか確認してください。
`usePathname` の変化で `pageview()` が呼ばれます。

**CSP エラーが出る**

コンソールに `Refused to load script` や `Refused to connect` が出る場合は、
CSP の設定が不足しています。Section 3 の手順を再確認してください。

---

次のステップ: `02_debugview_check.md` で DebugView に計測データが届いているか確認します。
