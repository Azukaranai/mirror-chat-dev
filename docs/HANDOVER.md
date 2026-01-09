# Mirror Chat - 引き継ぎ資料 (Handover Document)

## 1. プロジェクトの核心コンセプト
**「TelegramのようなUI/UXを持つ高機能チャット」×「マルチLLM参加型AIスレッド」**

本プロジェクトのユニークな価値は、以下のAI連携機能にあります。
- **Bring Your Own Key (BYOK)**: ユーザー各自がOpenAI等のAPIキーを登録して利用。
- **AIスレッドの共有**: AIとの対話スレッドを、友人とリアルタイムで共有（Read/Write権限管理）。
- **介入機能**: AIと誰かの会話に、第三者が横から口出し（介入）できる独自の体験。

---

## 2. 直近の進捗状況 (2026-01-10 更新)

### ✅ 解決済み (Resolved)
1. **API Key保存機能の修正**:
   - `key_set` Edge Functionおよびフロントエンド (`settings/page.tsx`) の認証処理を修正。
   - Frontendから明示的に `Authorization` ヘッダーを送信し、Edge Function側も手動でJWT検証を行うように変更 (`--no-verify-jwt`)。
2. **AIメッセージ送信機能の修正**:
   - `ai_send_message` Edge Functionの認証問題を同様に修正。
   - `gemini-3.0` (存在しないモデル) を `gemini-2.5-flash` に変更し、404エラーを解消。
3. **Gemini APIの実装**:
   - 不安定だったストリーミング (`streamGenerateContent`) を一時的に非ストリーミング (`generateContent`) に変更し、応答の確実性を向上。
4. **UI/UXの改善**:
   - **メッセージ重複の修正**: 楽観的更新とリアルタイム受信によるメッセージの二重表示を解消 (`AIThreadView.tsx`)。
   - **キャンセル機能の実装**: 応答待ち中に送信ボタンを「✕」ボタンに変更し、スタックした処理をフロントエンド側でキャンセル可能に。
   - **タイムアウト警告**: 応答に30秒以上かかった場合に警告メッセージを表示。

### ⚠️ 現在の課題 (Current Issues)
1. **履歴が表示されない問題**:
   - メッセージ送信・保存は成功しているが、ページリロード後に履歴が表示されない（または消える）現象が発生。
   - 原因: 恐らくRLSポリシーの問題か、Edge Functionが `service_role` で書き込んだデータを `auth.uid()` で読み取れていない可能性。
   - **対応策**: `20260110000001_fix_ai_messages_insert.sql` マイグレーションを作成したが、適用待ちの状態。

2. **Gemini ストリーミング**:
   - 現在は非ストリーミング動作のため、応答が完了するまで「考え中」のままとなり、UXが良くない。
   - ストリームパース処理 (`ai_send_message/index.ts`) のバグを修正し、ストリーミングに戻す必要がある。

3. **スタックしたRunの処理**:
   - タイムアウトなどで `status: running` のまま残ったレコードが原因で、新規メッセージが送れない場合がある。
   - 定期的なクリーンアップ処理（pg_cron等）か、タイムアウト時の自動失敗処理が必要。

---

## 3. 次のステップ (Next Steps)

### 優先度: 高 (Immediate Actions)
1. **マイグレーションの適用**:
   - 現在保留中の `20260110000001_fix_ai_messages_insert.sql` を適用する。
   - コマンド: `npx supabase db push`

2. **履歴表示のデバッグ**:
   - マイグレーション適用後も履歴が出ない場合、ブラウザコンソールの `Fetching messages...` ログを確認し、SupabaseのRLSポリシー (`ai_messages`) を見直す。

3. **Geminiストリーミングの復帰**:
   - `ai_send_message` 内のGemini実装を `streamGenerateContent` に戻し、より堅牢なJSONストリームパーサーを実装する。

### 優先度: 中 (Optimizations)
- `ai_process_queue` を活用した非同期処理の安定化。
- AIスレッドの共有機能の権限周りのテスト。

---

## 4. 技術的詳細 (Technical Details)

### Edge Functions
全てのAI関連Functionは現在 `--no-verify-jwt` でデプロイされています。
- `ai_send_message`
- `ai_process_queue`
- `ai_duplicate_thread`
- `key_set`

認証はFunction内で `supabase.auth.getUser(token)` を使って手動で行っています。これは、Supabase GatewayとFunction間の認証ヘッダー受け渡し問題を回避するための一時的な措置ですが、現状安定しています。

### Database Schema
- `ai_threads`, `ai_messages`, `ai_runs` が主要テーブル。
- `user_llm_keys` は複合主キー `(user_id, provider)` に移行済み。
