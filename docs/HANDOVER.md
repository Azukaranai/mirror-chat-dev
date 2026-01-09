# Mirror Chat - 引き継ぎ資料 (Handover Document)

## 1. プロジェクトの核心コンセプト
**「TelegramのようなUI/UXを持つ高機能チャット」×「マルチLLM参加型AIスレッド」**

本プロジェクトのユニークな価値は、単なるチャット機能ではなく、以下のAI連携機能にあります。
- **Bring Your Own Key (BYOK)**: ユーザー各自がOpenAI等のAPIキーを登録して利用。
- **AIスレッドの共有**: AIとの対話スレッドを、友人とリアルタイムで共有（Read/Write権限管理）。
- **介入機能**: AIと誰かの会話に、第三者が横から口出し（介入）できる独自の体験。

## 2. 現状の振り返りと方針転換 (The Pivot)

### 課題: "チャットアプリを一から作るのは重すぎる"
これまでの開発では、メッセージの送受信、リアルタイム同期、ルーム一覧、未読管理などの「一般的なチャット機能」の実装に多くの時間を費やしました。しかし、これらは既に世の中に最適解（CloneアプリやUIキット）が多数存在します。

### 新しい方針: "Clone & Inject"
今後の開発（またはリスタート）においては、**「チャット機能は既存の優れたClone/Templateを流用し、独自のAI機能の実装のみに集中する」** という戦略を推奨します。

---

## 3. 次のステップへの提案 (How to proceed)

### A案: 現在のコードベースを維持しつつ「Clone思考」を取り入れる場合
現在の `mirror-chat-dev` を継続する場合でも、手動でチャットUIを作るのをやめ、ライブラリで代替します。
- **UIコンポーネント**: `shadcn/ui` のChatコンポーネントや、`chat-ui-kit-react` などを導入し、デザイン調整工数を削減する。
- **データ構造**: 現在進めている `room_summaries` (Telegram方式のデータ構造) への移行を完遂する。これがパフォーマンスの鍵です。

### B案: 新規にCloneベースで作り直す場合 (推奨)
もしリファクタリングのコストが過大であれば、以下の条件を満たすOSSのCloneを探し、そこに `ai_threads` のロジックだけを移植します。
- **条件**: Next.js (App Router) + Supabase 対応
- **検索キーワード**: `nextjs supabase chat starter`, `telegram clone nextjs`, `shadcn chat template`
- **移植すべき独自の資産**:
    1. **AI Supabase Edge Functions**: `ai_send_message` (OpenAI Stream処理)
    2. **DB Schema**: `ai_threads`, `ai_stream_events` テーブル
    3. **State Logic**: ユーザーごとのAPIキー管理ロジック

---

## 4. 現在の実装状況 (Current Status)

### Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend / DB**: Supabase (PostgreSQL, Auth, Realtime)
- **Functions**: Supabase Edge Functions (Deno) for AI logic
- **Infrastructure**: Cloudflare Pages

### 完了している機能
- ユーザー認証 (Supabase Auth)
- 基本的なルーム作成・メッセージ送信・リアルタイム受信
- AIスレッドのデータモデル設計 (`ai_threads`)
- OpenAI APIへのストリーミングリクエスト処理 (Edge Functions)

### 残っている課題 (Technical Debt)
- **N+1問題**: ルーム一覧取得時に毎回全メッセージやプロフィールを見に行っている（`room_summaries`導入で解決予定）。
- **AIストリームのUI反映**: バックエンドのイベントをフロントで綺麗に吹き出しとして表示する部分の結合。

## 5. 独自のAI機能設計 (資産)
以下の設計はCloneアプリには存在しないため、引き継ぎ対象として重要です。

### DB Schema: AI Threads (抜粋)
通常の `rooms` とは別に、AI専用のコンテキストを持つテーブルを設計しています。
```sql
-- AI Thread: どのモデルを使うか、誰がオーナーか
CREATE TABLE ai_threads (
    id UUID PRIMARY KEY,
    owner_id UUID REFERENCES auth.users,
    model_config JSONB, -- { "model": "gpt-4", "temperature": 0.7 }
    is_public BOOLEAN DEFAULT false
);

-- AI Stream Events: ストリーミングのチャンクを保存しRealtimeで配信
CREATE TABLE ai_stream_events (
    id UUID PRIMARY KEY,
    thread_id UUID REFERENCES ai_threads,
    content TEXT,
    event_type TEXT -- 'token', 'start', 'end'
);
```

### Edge Function Logic
ユーザーのAPIキーをセキュアに扱うため、クライアントから直接OpenAIを叩かず、必ずEdge Functionを経由させ、ヘッダーのAPIキーを注入する構成にしています。

---

> **要約**: 汎用的なチャット部分は「作る」のではなく「探して使う」に切り替え、我々は「AIと人間がどうコラボレーションするか」という体験作り（AI Thread機能）に全リソースを注ぐべきです。
