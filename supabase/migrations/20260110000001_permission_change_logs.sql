-- 権限変更時にシステムメッセージを挿入するトリガー

-- トリガー関数
CREATE OR REPLACE FUNCTION log_permission_change()
RETURNS TRIGGER AS $$
DECLARE
    member_name TEXT;
    permission_text TEXT;
BEGIN
    -- 権限が変更された場合のみ
    IF OLD.permission IS DISTINCT FROM NEW.permission THEN
        -- メンバーの表示名を取得
        SELECT display_name INTO member_name
        FROM profiles
        WHERE user_id = NEW.user_id;
        
        -- 権限テキストを設定
        IF NEW.permission = 'INTERVENE' THEN
            permission_text := '介入';
        ELSE
            permission_text := '閲覧のみ';
        END IF;
        
        -- システムメッセージを挿入
        INSERT INTO ai_messages (
            thread_id,
            role,
            content,
            sender_kind
        ) VALUES (
            NEW.thread_id,
            'system',
            member_name || ' の権限が「' || permission_text || '」に変更されました',
            'system'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを作成
DROP TRIGGER IF EXISTS on_permission_change ON ai_thread_members;
CREATE TRIGGER on_permission_change
    AFTER UPDATE ON ai_thread_members
    FOR EACH ROW
    EXECUTE FUNCTION log_permission_change();

-- メンバー追加時のシステムメッセージ
CREATE OR REPLACE FUNCTION log_member_added()
RETURNS TRIGGER AS $$
DECLARE
    member_name TEXT;
    permission_text TEXT;
BEGIN
    -- メンバーの表示名を取得
    SELECT display_name INTO member_name
    FROM profiles
    WHERE user_id = NEW.user_id;
    
    -- 権限テキストを設定
    IF NEW.permission = 'INTERVENE' THEN
        permission_text := '介入';
    ELSE
        permission_text := '閲覧のみ';
    END IF;
    
    -- システムメッセージを挿入
    INSERT INTO ai_messages (
        thread_id,
        role,
        content,
        sender_kind
    ) VALUES (
        NEW.thread_id,
        'system',
        member_name || ' がスレッドに追加されました（権限: ' || permission_text || '）',
        'system'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを作成
DROP TRIGGER IF EXISTS on_member_added ON ai_thread_members;
CREATE TRIGGER on_member_added
    AFTER INSERT ON ai_thread_members
    FOR EACH ROW
    EXECUTE FUNCTION log_member_added();

-- メンバー削除時のシステムメッセージ
CREATE OR REPLACE FUNCTION log_member_removed()
RETURNS TRIGGER AS $$
DECLARE
    member_name TEXT;
BEGIN
    -- メンバーの表示名を取得
    SELECT display_name INTO member_name
    FROM profiles
    WHERE user_id = OLD.user_id;
    
    -- システムメッセージを挿入
    INSERT INTO ai_messages (
        thread_id,
        role,
        content,
        sender_kind
    ) VALUES (
        OLD.thread_id,
        'system',
        member_name || ' がスレッドから削除されました',
        'system'
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- トリガーを作成
DROP TRIGGER IF EXISTS on_member_removed ON ai_thread_members;
CREATE TRIGGER on_member_removed
    AFTER DELETE ON ai_thread_members
    FOR EACH ROW
    EXECUTE FUNCTION log_member_removed();
