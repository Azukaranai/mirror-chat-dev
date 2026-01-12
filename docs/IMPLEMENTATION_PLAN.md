# Mirror Chat - 実装計画書（再設計版）

## ⚠️ 重要設定: 開発環境の接続先について
**ローカル開発時も、Docker（ローカルSupabase）ではなく、リモートのSupabaseプロジェクト（本番/開発環境）に直接接続します。**
- `npx supabase start` は使用しません。
- `.env.local` にはリモートSupabaseのURLとANON KEYを設定してください。

## 目的と前提
- 目的: 要件定義で指定された機能を全て維持しつつ、データ取得・UI・リアルタイムの設計を安定運用向けに再設計する。
- インフラ: 現行の Supabase + Cloudflare Pages を継続利用。
- 料金: 無料枠で運用可能な構成を優先。
- 想定規模: 初期は10人程度（仲間内で利用）。
- AI: ユーザ個別APIキー継続。
- 通知: アプリ内のみ（Push/メールは後回し）。

## 重要方針
- 取得ロジックは「N+1削減」「一覧は集計済みを読む」を基本にする。
- リアルタイムは Supabase Realtime（postgres_changes + broadcast）で賄う。
- 画面遷移で再マウントしない構成（RoomListはレイアウトで固定）。
- エラーはUIに表示して利用者に原因が見える状態にする。

---

## 機能スコープ（維持）
- 認証: 登録/ログイン/プロフィール/アバター
- 友達: 申請・承認・一覧・検索
- トーク: DM/グループ、メッセージ送受信、既読、返信、添付
- AI: スレッド作成、送受信、共有、介入、オーバーレイ/スプリット
- システム通知: Mirror運営アカウントからの配信

---

## システム構成（無料枠前提）
- Frontend: Next.js App Router
- Backend: Supabase (PostgREST + Realtime + Edge Functions)
- Storage: Supabase Storage（avatars / chat-attachments）
- Hosting: Cloudflare Pages
- Realtime
  - メッセージ: `postgres_changes` on `messages`
  - タイピング: `broadcast` event
  - 友達申請/承認: `postgres_changes` on `friendships`
  - AIストリーム: `postgres_changes` on `ai_stream_events`

---

## データ設計（重要変更点）
### 1) 参照の安定化
- `messages.sender_user_id` は `auth.users` にFKがあるが、`profiles` へのJOINで失敗するため、
  追加のFKを用意して PostgRESTの埋め込みを安定化する。
  - 追加案: `ALTER TABLE messages ADD CONSTRAINT messages_sender_profile_fkey FOREIGN KEY (sender_user_id) REFERENCES profiles(user_id);`

### 2) ルーム一覧の軽量化
- **room_summaries（テーブル or view）** を導入
  - 各ユーザ×ルームの「最後のメッセージ」「未読数」「相手情報」を集計済みで保持
  - `messages` 追加時に trigger で更新

### 3) 既読
- `room_members.last_read_message_id` を更新
- 未読数は `room_summaries.unread_count` を保持（triggerで更新）

### 4) 添付ファイル
- `message_attachments` は別取得（必要時のみ）

---

## API / 取得パターン（目標）
### ルーム一覧
- RPCまたは `room_summaries` を直接読み込む
- 画面遷移で再ロードせず、リアルタイム差分だけ反映

### メッセージ一覧
- 初期: 最新N件取得
- 追加: ページネーション
- リアルタイム: `messages` insert を購読して末尾に追加

### 送信
- `messages` insert -> triggerで room_summaries 更新
- 失敗時は UI にエラーを表示

---

## リアルタイム設計（無料枠優先）
- メッセージ本文: `postgres_changes` を購読
- 既読: クライアント側で last_read を更新し、RoomListは差分更新
- タイピング: `broadcast` のみ（DB書き込み無し）
- 大量通知は不要（初期10人規模）

---

## セキュリティ / RLS
- RLSは現状維持
- profilesは現状通り全員参照可（検索/表示用途）
- 重要処理は Edge Functions へ寄せる（AI/キー管理）

---

## 移行計画（段階導入）
### Step 1: DB補強
- [ ] `messages -> profiles` のFK追加
- [ ] `room_summaries` テーブル or view 作成
- [ ] `messages` insert trigger で room_summaries 更新

### Step 2: 取得ロジック刷新
- [ ] RoomList: `room_summaries` を読むように修正
- [ ] ChatRoom: 埋め込みJOINを使える構成に整理
- [ ] 既読更新と未読数の一致を検証

### Step 3: UI/UX修正
- [ ] 返信UI/吹き出し幅/アイコン欠け等の微調整
- [ ] 再読み込みで履歴が消える問題の解消

---

## 課題とスタックタスク
- [ ] メール認証必須化（Auth設定 + UI/フロー更新）
- [ ] AIスレッドの統合動作テスト（共有/介入/ストリーム）
- [ ] パフォーマンス改善（クエリ回数削減・キャッシュ）

---

## 進捗管理
- 現行の実装は機能単位で完了しているが、
  **取得方式とリアルタイム設計が再設計の対象**。
- 実装は「Step 1 → Step 2 → Step 3」の順で進める。

---

## 運用マニュアル（手動操作）

### 1. 開発サーバーの起動（ローカルで確認）
```bash
# アプリのディレクトリへ移動
cd apps/web

# 開発サーバー起動 (localhost:3000)
npm run dev
```

### 2. Cloudflare Pages へのデプロイ（手動）
コードの変更を本番環境（Web）へ反映させる手順です。
```bash
# プロジェクトルートで実行
cd apps/web

# ビルドしてデプロイ
npm run pages:build && npx wrangler pages deploy .vercel/output/static --project-name mirror-chat
```

### 3. Edge Functions のデプロイ
Supabase Edge Functions（AI機能など）を変更した場合の手順です。
```bash
# 特定の関数をデプロイする場合（例：ai_send_message）
npx supabase functions deploy ai_send_message

# 環境変数を設定する場合
npx supabase secrets set --env-file ./supabase/.env.local
```

### 4. データベース定義の更新
マイグレーションファイルを作成した場合の手順です。
```bash
# リモートDBへ反映
npx supabase db push
```

---

## Telegram-Clone 参照による改善ポイント（全体設計）
以下は Telegram-Clone の構成を参照し、Mirror Chat に合わせて再設計する改善点。

### フロントエンド（状態管理/表示）
- **チャット履歴キャッシュ**: ルームID単位でメッセージ履歴を保持し、ルーム切替で再取得しない。
- **一覧と詳細の分離**: chatList と chatHistory を分離し、一覧更新で詳細を巻き込まない。
- **入力体験**: 下書き保存（ルーム単位）、送信直後の楽観表示、再送制御。
- **描画最適化**: メッセージリストの差分更新（既存IDは上書きしない）。

### バックエンド（取得/リアルタイム/整合性）
- **room_summaries 経由**で一覧を取得し、N+1を排除。
- **メッセージ取得のページング**: 初期は最新N件、スクロールで過去分取得。
- **ルーム作成の一括処理**: RPCでルーム＋メンバー追加を原子的に実行。

### 実装タスク（追加）
- [ ] Chat Storeに `messageCache` / `chatListCache` を追加
- [ ] ルーム切替時はキャッシュ優先で描画、差分だけフェッチ
- [ ] 入力下書きの保存/復元（ルーム単位）
- [ ] メッセージ取得をページング化（最新N件 + 過去取得）
- [x] モバイル版でチャットで改行できない (Fixed)
- [x] モバイル: キーボード表示時のスクロール調整とタブバー非表示 (Fixed)