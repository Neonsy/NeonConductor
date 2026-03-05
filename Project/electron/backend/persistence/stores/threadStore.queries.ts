export const THREAD_COLUMNS = [
    'id',
    'profile_id',
    'conversation_id',
    'title',
    'top_level_tab',
    'parent_thread_id',
    'root_thread_id',
    'last_assistant_at',
    'created_at',
    'updated_at',
] as const;

export const SESSION_THREAD_WITH_CONVERSATION_COLUMNS = [
    'threads.id as id',
    'threads.profile_id as profile_id',
    'threads.conversation_id as conversation_id',
    'threads.title as title',
    'threads.top_level_tab as top_level_tab',
    'threads.parent_thread_id as parent_thread_id',
    'threads.root_thread_id as root_thread_id',
    'threads.last_assistant_at as last_assistant_at',
    'threads.created_at as created_at',
    'threads.updated_at as updated_at',
    'conversations.scope as scope',
    'conversations.workspace_fingerprint as workspace_fingerprint',
] as const;
