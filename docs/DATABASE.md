# Mirror Chat - Database Schema Documentation

*Last Updated: 2026-01-10*

## Overview

This document describes the database schema for Mirror Chat, a messaging application with AI thread functionality.

---

## Tables (16 total)

### User Management

| Table | Description | RLS Policies |
|-------|-------------|--------------|
| `profiles` | User profile information | 3 |
| `friendships` | Friend relationships with nicknames | 4 |
| `user_llm_keys` | Encrypted LLM API keys per user | 4 |

### Groups

| Table | Description | RLS Policies |
|-------|-------------|--------------|
| `groups` | Group metadata (name, avatar, owner) | 4 |
| `group_members` | Group membership with roles | 4 |

### Messaging

| Table | Description | RLS Policies |
|-------|-------------|--------------|
| `rooms` | Chat rooms (DM or group) | 2 |
| `room_members` | Room membership + read status | 3 |
| `messages` | Chat messages | 4 |
| `message_reactions` | Emoji reactions | 3 |
| `message_attachments` | File attachments | 2 |

### AI Threads

| Table | Description | RLS Policies |
|-------|-------------|--------------|
| `ai_threads` | AI conversation threads | 4 |
| `ai_thread_members` | Thread sharing permissions | 4 |
| `ai_messages` | AI conversation messages | 3 |
| `ai_queue_items` | Message processing queue | 3 |
| `ai_runs` | AI execution status tracking | 2 |
| `ai_stream_events` | Streaming response deltas | 2 |

---

## Views

| View | Description |
|------|-------------|
| `room_summaries` | Pre-computed room info with unread counts |

---

## Functions (17 total)

### Security Definer Functions (RLS helpers)

| Function | Purpose |
|----------|---------|
| `is_room_member(room_id, user_id)` | Check room membership |
| `is_group_member_secure(group_id)` | Check group membership (uses auth.uid()) |
| `is_group_admin_or_owner_secure(group_id)` | Check admin/owner status |
| `is_group_owner_by_group_table(group_id)` | Check ownership via groups table |
| `is_thread_owner_secure(thread_id)` | Check AI thread ownership |
| `is_thread_member_secure(thread_id)` | Check AI thread membership |
| `is_ai_thread_owner(thread_id, user_id)` | Check AI thread ownership (explicit user) |
| `can_access_ai_thread(thread_id, user_id)` | Check AI thread access |
| `can_intervene_ai_thread(thread_id, user_id)` | Check intervention permission |

### Business Logic Functions

| Function | Purpose |
|----------|---------|
| `create_group_with_owner(name, avatar_path, initial_members)` | Atomically create group + member + room with invite |
| `create_dm_room(target_user_id)` | Create DM room between users |
| `toggle_read_status_visibility(room_id, show)` | Toggle read receipts |
| `update_read_status(room_id, message_id)` | Mark messages as read |
| `get_thread_owner_key_status(thread_ids)` | Batch check API key status |
| `handle_new_user()` | Trigger function for new user creation |
| `update_updated_at()` | Auto-update timestamp trigger |

---

## Indexes (45 total)

### Performance Critical Indexes

| Index | Table | Purpose |
|-------|-------|---------|
| `idx_messages_room_created` | messages | Fast message listing |
| `idx_ai_messages_thread_created` | ai_messages | Fast AI message listing |
| `idx_ai_queue_pending` | ai_queue_items | Fast pending queue lookup |
| `idx_ai_runs_single_running` | ai_runs | Ensure single running task |
| `idx_friendships_status` | friendships | Filter by friendship status |

---

## Realtime Subscriptions

The following tables are enabled for realtime:

- `messages` - Live chat updates
- `message_reactions` - Live reaction updates
- `room_members` - Read status updates
- `groups` - Group updates
- `group_members` - Membership changes
- `ai_threads` - Thread updates
- `ai_thread_members` - Permission changes
- `ai_messages` - Live AI responses
- `ai_queue_items` - Queue status
- `ai_runs` - Execution status
- `ai_stream_events` - Streaming deltas
- `user_llm_keys` - API key status

---

## Enums

| Enum | Values |
|------|--------|
| `friendship_status` | pending, accepted, blocked |
| `group_role` | owner, admin, member |
| `room_type` | dm, group |
| `message_kind` | text, attachment, shared_ai_thread, system |
| `ai_role` | user, assistant, system |
| `ai_sender_kind` | owner, collaborator, assistant, system |
| `ai_permission` | VIEW, INTERVENE |
| `ai_queue_kind` | owner, collaborator |
| `ai_queue_status` | pending, consumed, discarded |
| `ai_run_status` | running, completed, failed |

---

## Data Statistics

| Table | Row Count |
|-------|-----------|
| profiles | 7 |
| friendships | 11 |
| groups | 0 |
| group_members | 0 |
| rooms | 11 |
| room_members | 22 |
| messages | 394 |
| ai_threads | 20 |
| ai_messages | 136 |
| user_llm_keys | 2 |

---

## Migration History

| Version | Description |
|---------|-------------|
| 00001 | Initial schema |
| 00002 | RLS policies |
| 00003 | Storage buckets |
| 00004 | Realtime publication |
| 00005 | Mirror friendship |
| 00006 | Handle new user fix |
| 00007 | Room summaries view |
| 00008 | Create DM room function |
| 20240523120000 | Fix AI threads RLS |
| 20260109000000 | Fix recursion final |
| 20260109000001 | Multi-provider keys |
| 20260109000002-8 | Various fixes |
| 20260110xxx | Group fixes, read status |
| 20260110200000 | Fix group_members recursion |
| 20260110200001 | Enhance create_group |
| 20260110210000 | DB cleanup |
| 20260111000000 | Add initial members to create group |

---

## Notes

- All tables have Row Level Security (RLS) enabled
- SECURITY DEFINER functions are used to prevent RLS recursion
- The `room_summaries` view includes nickname overlay from friendships
- API keys in `user_llm_keys` store only encrypted keys and last 4 chars
