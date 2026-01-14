-- Restore profile creation on signup (email confirmation disabled)

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
DROP FUNCTION IF EXISTS handle_user_confirmed();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_handle TEXT;
    fallback_handle TEXT;
BEGIN
    base_handle := COALESCE(NEW.raw_user_meta_data->>'handle', 'user_' || SUBSTR(NEW.id::TEXT, 1, 8));
    fallback_handle := 'user_' || SUBSTR(NEW.id::TEXT, 1, 8);

    BEGIN
        INSERT INTO public.profiles (user_id, display_name, handle)
        VALUES (
            NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
            base_handle
        )
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION
        WHEN unique_violation THEN
            INSERT INTO public.profiles (user_id, display_name, handle)
            VALUES (
                NEW.id,
                COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
                fallback_handle
            )
            ON CONFLICT (user_id) DO NOTHING;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
