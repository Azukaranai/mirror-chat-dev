-- Create a function to check valid API keys for thread owners in bulk
create or replace function get_thread_owner_key_status(p_thread_ids uuid[])
returns table (thread_id uuid, has_key boolean)
language plpgsql
security definer
as $$
begin
  return query
  select
    t.id as thread_id,
    exists (
      select 1 from user_llm_keys k
      where k.user_id = t.owner_user_id
        and k.provider = case
          when t.model like 'gemini%' then 'google'
          else 'openai'
        end
    ) as has_key
  from ai_threads t
  where t.id = any(p_thread_ids);
end;
$$;
