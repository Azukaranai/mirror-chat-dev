-- Change user_llm_keys specific primary key to allow multiple providers per user

-- 1. Drop existing primary key
ALTER TABLE user_llm_keys DROP CONSTRAINT user_llm_keys_pkey;

-- 2. Add new composite primary key
ALTER TABLE user_llm_keys ADD PRIMARY KEY (user_id, provider);

-- 3. Update RLS policies because valid usage might change? 
-- The existing policies use auth.uid() = user_id, which is still valid for all rows belonging to user.
-- So RLS usually doesn't need change if checks are just on user_id column.
-- Let's double check standard policy:
-- CREATE POLICY "Users can view own keys" ON user_llm_keys FOR SELECT USING (auth.uid() = user_id);
-- This works fine for multiple rows.

-- 4. Just in case, ensure provider is checked/valid? (App layer responsibility usually)
