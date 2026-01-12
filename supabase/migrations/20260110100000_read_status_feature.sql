-- 既読ステータス表示機能
-- 各ユーザーが相手に既読を見せるかどうかを制御

-- room_membersに既読表示設定を追加
ALTER TABLE room_members 
ADD COLUMN IF NOT EXISTS show_read_status BOOLEAN NOT NULL DEFAULT true;

-- 既読ステータス変更時のシステムメッセージ用にmessage_kindを更新
-- (既存のenumにはsystemがないかもしれないので確認が必要)

-- last_read_message_idの更新時にタイムスタンプも記録
ALTER TABLE room_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- 既読更新用のRPC関数
CREATE OR REPLACE FUNCTION update_read_status(
    p_room_id UUID,
    p_message_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE room_members
    SET 
        last_read_message_id = p_message_id,
        last_read_at = NOW()
    WHERE room_id = p_room_id
    AND user_id = auth.uid();
END;
$$;

-- 既読表示設定変更用のRPC関数
CREATE OR REPLACE FUNCTION toggle_read_status_visibility(
    p_room_id UUID,
    p_show BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
BEGIN
    -- 現在のユーザーの表示名を取得
    SELECT display_name INTO v_display_name
    FROM profiles
    WHERE user_id = auth.uid();

    -- 設定を更新
    UPDATE room_members
    SET show_read_status = p_show
    WHERE room_id = p_room_id
    AND user_id = auth.uid();

    -- システムメッセージを挿入
    INSERT INTO messages (room_id, sender_user_id, kind, content)
    VALUES (
        p_room_id,
        auth.uid(),
        'system',
        CASE 
            WHEN p_show THEN v_display_name || 'が既読を表示する設定にしました'
            ELSE v_display_name || 'が既読を非表示にしました'
        END
    );
END;
$$;
