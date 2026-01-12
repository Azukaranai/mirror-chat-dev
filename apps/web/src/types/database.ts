// Database Types - Auto-generated from Supabase schema
// These types should be regenerated when schema changes

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

// Enums
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';
export type GroupRole = 'owner' | 'admin' | 'member';
export type RoomType = 'dm' | 'group';
export type MessageKind = 'text' | 'attachment' | 'shared_ai_thread' | 'system';
export type AIRole = 'user' | 'assistant' | 'system';
export type AISenderKind = 'owner' | 'collaborator' | 'assistant' | 'system';
export type AIPermission = 'VIEW' | 'INTERVENE';
export type AIQueueKind = 'owner' | 'collaborator';
export type AIQueueStatus = 'pending' | 'consumed' | 'discarded';
export type AIRunStatus = 'running' | 'completed' | 'failed';

// Table Types
export interface Profile {
    user_id: string;
    display_name: string;
    handle: string;
    avatar_path: string | null;
    created_at: string;
    updated_at: string;
}

export interface Friendship {
    id: string;
    requester_id: string;
    addressee_id: string;
    status: FriendshipStatus;
    created_at: string;
}

export interface Group {
    id: string;
    owner_id: string;
    name: string;
    avatar_path: string | null;
    created_at: string;
    updated_at: string;
}

export interface GroupMember {
    group_id: string;
    user_id: string;
    role: GroupRole;
    created_at: string;
}

export interface Room {
    id: string;
    type: RoomType;
    group_id: string | null;
    created_at: string;
}

export interface RoomMember {
    room_id: string;
    user_id: string;
    last_read_message_id: string | null;
    last_read_at: string | null;
    show_read_status: boolean;
    joined_at: string;
}

export interface Message {
    id: string;
    room_id: string;
    sender_user_id: string;
    kind: MessageKind;
    content: string | null;
    reply_to_message_id: string | null;
    created_at: string;
    edited_at: string | null;
}

export interface MessageReaction {
    message_id: string;
    user_id: string;
    reaction_type: string;
    created_at: string;
}

export interface MessageAttachment {
    id: string;
    message_id: string;
    bucket: string;
    object_path: string;
    mime: string;
    size: number;
    created_at: string;
}

export interface AIThread {
    id: string;
    owner_user_id: string;
    title: string;
    system_prompt: string | null;
    model: string;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface AIThreadMember {
    thread_id: string;
    user_id: string;
    permission: AIPermission;
    created_at: string;
}

export interface AIMessage {
    id: string;
    thread_id: string;
    role: AIRole;
    sender_user_id: string | null;
    sender_kind: AISenderKind;
    content: string;
    created_at: string;
}

export interface AIQueueItem {
    id: string;
    thread_id: string;
    user_id: string;
    kind: AIQueueKind;
    content: string;
    status: AIQueueStatus;
    created_at: string;
    consumed_at: string | null;
    discarded_at: string | null;
}

export interface AIRun {
    id: string;
    thread_id: string;
    status: AIRunStatus;
    started_at: string;
    finished_at: string | null;
    error: string | null;
}

export interface AIStreamEvent {
    id: string;
    thread_id: string;
    run_id: string;
    seq: number;
    delta: string;
    created_at: string;
}

export interface UserLLMKey {
    user_id: string;
    encrypted_key: string;
    key_last4: string;
    provider: string;
    created_at: string;
    updated_at: string;
}

// Joined Types for UI
export interface ProfileWithUser extends Profile {
    email?: string;
}

export interface MessageWithSender extends Message {
    sender: Profile;
    reactions?: MessageReaction[];
    attachments?: MessageAttachment[];
    reply_to?: Message | null;
}

export interface RoomWithDetails extends Room {
    members: (RoomMember & { profile: Profile })[];
    last_message?: Message;
    unread_count?: number;
}

export interface AIThreadWithOwner extends AIThread {
    owner: Profile;
    member_count?: number;
}

export interface AIMessageWithSender extends AIMessage {
    sender?: Profile;
}

// Shared AI Thread Card (embedded in message.content)
export interface SharedAIThreadCard {
    threadId: string;
    ownerUserId: string;
    titleSnapshot: string;
    sharedAt: string;
}

// Supabase Database type helper
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: Profile;
                Insert: Omit<Profile, 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Profile, 'user_id' | 'created_at'>>;
                Relationships: [];
            };
            friendships: {
                Row: Friendship;
                Insert: Omit<Friendship, 'id' | 'created_at'>;
                Update: Partial<Pick<Friendship, 'status'>>;
                Relationships: [];
            };
            groups: {
                Row: Group;
                Insert: Omit<Group, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Group, 'id' | 'created_at'>>;
                Relationships: [];
            };
            group_members: {
                Row: GroupMember;
                Insert: Omit<GroupMember, 'created_at'>;
                Update: Partial<Pick<GroupMember, 'role'>>;
                Relationships: [];
            };
            rooms: {
                Row: Room;
                Insert: Omit<Room, 'id' | 'created_at'>;
                Update: never;
                Relationships: [];
            };
            room_members: {
                Row: RoomMember;
                Insert: Omit<RoomMember, 'joined_at'>;
                Update: Partial<Pick<RoomMember, 'last_read_message_id' | 'last_read_at' | 'show_read_status'>>;
                Relationships: [];
            };
            messages: {
                Row: Message;
                Insert: Omit<Message, 'id' | 'created_at' | 'edited_at'>;
                Update: Partial<Pick<Message, 'content' | 'edited_at'>>;
                Relationships: [];
            };
            message_reactions: {
                Row: MessageReaction;
                Insert: Omit<MessageReaction, 'created_at'>;
                Update: never;
                Relationships: [];
            };
            message_attachments: {
                Row: MessageAttachment;
                Insert: Omit<MessageAttachment, 'id' | 'created_at'>;
                Update: never;
                Relationships: [];
            };
            ai_threads: {
                Row: AIThread;
                Insert: Omit<AIThread, 'id' | 'created_at' | 'updated_at' | 'archived_at'>;
                Update: Partial<Pick<AIThread, 'title' | 'system_prompt' | 'model' | 'archived_at'>>;
                Relationships: [];
            };
            ai_thread_members: {
                Row: AIThreadMember;
                Insert: Omit<AIThreadMember, 'created_at'>;
                Update: Partial<Pick<AIThreadMember, 'permission'>>;
                Relationships: [];
            };
            ai_messages: {
                Row: AIMessage;
                Insert: Omit<AIMessage, 'id' | 'created_at'>;
                Update: never;
                Relationships: [];
            };
            ai_queue_items: {
                Row: AIQueueItem;
                Insert: Omit<AIQueueItem, 'id' | 'created_at' | 'consumed_at' | 'discarded_at'>;
                Update: Partial<Pick<AIQueueItem, 'status' | 'consumed_at' | 'discarded_at'>>;
                Relationships: [];
            };
            ai_runs: {
                Row: AIRun;
                Insert: Omit<AIRun, 'id' | 'started_at' | 'finished_at' | 'error'>;
                Update: Partial<Pick<AIRun, 'status' | 'finished_at' | 'error'>>;
                Relationships: [];
            };
            ai_stream_events: {
                Row: AIStreamEvent;
                Insert: Omit<AIStreamEvent, 'id' | 'created_at'>;
                Update: never;
                Relationships: [];
            };
            user_llm_keys: {
                Row: UserLLMKey;
                Insert: Omit<UserLLMKey, 'created_at' | 'updated_at'>;
                Update: Partial<Pick<UserLLMKey, 'encrypted_key' | 'key_last4'>>;
                Relationships: [];
            };
        };
        Views: {};
        Functions: {
            is_room_member: {
                Args: { p_room_id: string; p_user_id: string };
                Returns: boolean;
            };
            can_access_ai_thread: {
                Args: { p_thread_id: string; p_user_id: string };
                Returns: boolean;
            };
            is_ai_thread_owner: {
                Args: { p_thread_id: string; p_user_id: string };
                Returns: boolean;
            };
            can_intervene_ai_thread: {
                Args: { p_thread_id: string; p_user_id: string };
                Returns: boolean;
            };
            create_group_with_owner: {
                Args: { p_name: string; p_avatar_path?: string | null };
                Returns: string;
            };
        };
    };
}
