# Mirror Chat

AIチャット共有アプリ - LINE/Discord風チャット + ChatGPT風AIスレッド

## 機能

- **通常チャット**: DM/グループチャット、既読、入力中表示、リアクション、添付、引用返信
- **AIスレッド**: ChatGPT風の会話、ストリーミング応答
- **共有カード**: AIスレッドをトークに共有し、リアルタイムで閲覧・介入可能
- **介入機能**: 権限を持つユーザーがAI会話に口出しできる

## 技術スタック

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth, Database, Realtime, Storage, Edge Functions)
- **State Management**: Zustand
- **Hosting**: Vercel

## セットアップ

### 1. Supabaseプロジェクト作成

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. プロジェクトURLとAnon Keyを取得

### 2. データベース設定

Supabase SQL Editorで以下を順番に実行:

```bash
supabase/migrations/00001_initial_schema.sql
supabase/migrations/00002_rls_policies.sql
supabase/migrations/00003_storage_buckets.sql
supabase/migrations/00004_realtime_publication.sql
```

### 3. 環境変数設定

```bash
cd apps/web
cp .env.example .env.local
```

`.env.local`を編集:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 4. 開発サーバー起動

```bash
cd apps/web
npm install
npm run dev
```

http://localhost:3000 でアクセス

### 5. Cloudflare Pages デプロイ（検証用）

1. Cloudflare Pages で新規プロジェクト作成（Git連携）
2. ルートディレクトリ: `apps/web`
3. ビルドコマンド: `npm run pages:build`
4. 出力ディレクトリ: `.vercel/output/static`
5. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. Functions の Compatibility Flags に `nodejs_compat` を追加（`apps/web/wrangler.toml` にも設定済み）

## プロジェクト構造

```
mirror-chat-dev/
├── apps/web/                    # Next.js フロントエンド
│   ├── src/
│   │   ├── app/                 # App Router ページ
│   │   ├── components/          # UIコンポーネント
│   │   ├── lib/                 # ユーティリティ、ストア
│   │   └── types/               # 型定義
│   └── ...
├── supabase/
│   ├── migrations/              # DBマイグレーション
│   └── functions/               # Edge Functions
└── docs/                        # ドキュメント
```

## 開発状況

### Phase 1: 基盤構築 ✅
- [x] Next.js + Tailwind 初期化
- [x] ディレクトリ構造
- [x] DBマイグレーション作成
- [x] 基本ナビゲーション
- [x] 認証ページ

### Phase 2-8: 開発中
- 詳細は `docs/IMPLEMENTATION_PLAN.md` を参照

## ライセンス

Private - 身内用
