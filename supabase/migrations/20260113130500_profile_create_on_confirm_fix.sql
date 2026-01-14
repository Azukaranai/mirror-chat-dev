-- Avoid confirmation failure when handle is already taken

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_handle TEXT;
    fallback_handle TEXT;
BEGIN
    IF NEW.email_confirmed_at IS NULL THEN
        RETURN NEW;
    END IF;

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

CREATE OR REPLACE FUNCTION handle_user_confirmed()
RETURNS TRIGGER AS $$
DECLARE
    base_handle TEXT;
    fallback_handle TEXT;
BEGIN
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
