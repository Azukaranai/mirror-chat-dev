---
description: Supabase DBの状態を確認するワークフロー
---

# Supabase DB確認ワークフロー

## 前提条件
- psql がインストール済み（`/opt/homebrew/opt/postgresql@14/bin/psql --version`）
- Supabase プロジェクトの接続文字列が必要

---

## セットアップ（初回のみ）

### 1. DATABASE_URLを設定
Supabaseダッシュボードから接続文字列を取得：
- Project Settings → Database → Connection string → URI

```bash
# ~/.zshrcに追加
export SUPABASE_DB_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].supabase.co:5432/postgres"
```

### 2. エイリアス設定（便利）
```bash
# ~/.zshrcに追加
alias psql-supabase='/opt/homebrew/opt/postgresql@14/bin/psql $SUPABASE_DB_URL'
```

---

## よく使うクエリ

### 1. テーブル一覧
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "\dt public.*"
```

### 2. 最近のユーザー
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "SELECT user_id, display_name, handle, created_at FROM profiles ORDER BY created_at DESC LIMIT 10"
```

### 3. 最近のメッセージ
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "SELECT id, room_id, LEFT(content, 50) as content, created_at FROM messages ORDER BY created_at DESC LIMIT 10"
```

### 4. AIスレッド一覧
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "SELECT id, title, model, created_at FROM ai_threads ORDER BY created_at DESC LIMIT 10"
```

### 5. グループ一覧
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "SELECT g.id, g.name, COUNT(gm.user_id) as members FROM groups g LEFT JOIN group_members gm ON g.id = gm.group_id GROUP BY g.id ORDER BY g.created_at DESC LIMIT 10"
```

### 6. RLSポリシー確認
// turbo
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename"
```

### 7. テーブル定義確認
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "\d profiles"
```

### 8. インデックス一覧
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "\di public.*"
```

---

## カスタムクエリ実行
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL" -c "YOUR_SQL_HERE"
```

## 対話モード
```bash
/opt/homebrew/opt/postgresql@14/bin/psql "$SUPABASE_DB_URL"
```

---

## 便利なメタコマンド（対話モード内で使用）
| コマンド | 説明 |
|---------|------|
| `\dt` | テーブル一覧 |
| `\d tablename` | テーブル定義 |
| `\di` | インデックス一覧 |
| `\df` | 関数一覧 |
| `\dp` | 権限一覧 |
| `\q` | 終了 |

---

## 注意事項
- `SUPABASE_DB_URL` 環境変数を設定してから使用
- 本番DBへの書き込みクエリは必ずユーザーに確認を取ること
- パスワードは接続文字列に含まれる（漏洩注意）
