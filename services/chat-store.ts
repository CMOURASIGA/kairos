import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ChatMessage, ChatRole, ConversationMeta, SpecialistId } from "@/types/chat";

const conversations = new Map<string, ConversationMeta>();
const messages = new Map<string, ChatMessage[]>();
const localConversationOwners = new Map<string, string>();

function normalizeTitle(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 45 ? `${trimmed.slice(0, 45)}...` : trimmed || "Nova conversa";
}

function ensureLocalConversation(conversationId: string, userId: string, firstMessage?: string): void {
  const owner = localConversationOwners.get(conversationId);
  if (owner && owner !== userId) {
    return;
  }

  if (!owner) {
    localConversationOwners.set(conversationId, userId);
  }

  if (!conversations.has(conversationId)) {
    conversations.set(conversationId, {
      id: conversationId,
      title: normalizeTitle(firstMessage ?? "Nova conversa"),
      createdAt: new Date().toISOString(),
    });
  }

  if (!messages.has(conversationId)) {
    messages.set(conversationId, []);
  }
}

async function ensureSupabaseConversation(
  conversationId: string,
  userId: string,
  firstMessage?: string,
): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return false;
  try {
    const existing = await supabase
      .from("conversations")
      .select("id, user_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (existing.error) return false;
    if (existing.data?.id) {
      return existing.data.user_id === userId;
    }

    const created = await supabase.from("conversations").insert({
      id: conversationId,
      user_id: userId,
      titulo: normalizeTitle(firstMessage ?? "Nova conversa"),
    });

    return !created.error;
  } catch {
    return false;
  }
}

export async function appendMessage(params: {
  userId: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  specialist: SpecialistId;
}): Promise<ChatMessage> {
  const createdAt = new Date().toISOString();
  const fallbackMessage: ChatMessage = {
    id: crypto.randomUUID(),
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    specialist: params.specialist,
    createdAt,
  };

  const conversationReady = await ensureSupabaseConversation(
    params.conversationId,
    params.userId,
    params.content,
  );

  if (conversationReady) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const inserted = await supabase
          .from("messages")
          .insert({
            conversation_id: params.conversationId,
            role: params.role,
            content: params.content,
            specialist: params.specialist,
          })
          .select("id, conversation_id, role, content, specialist, created_at")
          .single();

        if (!inserted.error && inserted.data) {
          return {
            id: inserted.data.id,
            conversationId: inserted.data.conversation_id,
            role: inserted.data.role as ChatRole,
            content: inserted.data.content,
            specialist: inserted.data.specialist as SpecialistId,
            createdAt: inserted.data.created_at,
          };
        }
      } catch {
        // fallback local below
      }
    }
  }

  ensureLocalConversation(params.conversationId, params.userId, params.content);
  const current = messages.get(params.conversationId) ?? [];
  current.push(fallbackMessage);
  messages.set(params.conversationId, current);
  return fallbackMessage;
}

export async function listMessages(params: {
  conversationId: string;
  userId: string;
}): Promise<ChatMessage[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const conversation = await supabase
        .from("conversations")
        .select("id")
        .eq("id", params.conversationId)
        .eq("user_id", params.userId)
        .maybeSingle();

      if (conversation.error || !conversation.data?.id) {
        return [];
      }

      const result = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, specialist, created_at")
        .eq("conversation_id", params.conversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!result.error && result.data) {
        return result.data.map((item) => ({
          id: item.id,
          conversationId: item.conversation_id,
          role: item.role as ChatRole,
          content: item.content,
          specialist: item.specialist as SpecialistId,
          createdAt: item.created_at,
        }));
      }
    } catch {
      // fallback local below
    }
  }

  if (localConversationOwners.get(params.conversationId) !== params.userId) {
    return [];
  }

  return messages.get(params.conversationId) ?? [];
}

export async function listConversations(userId: string): Promise<ConversationMeta[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const result = await supabase
        .from("conversations")
        .select("id, titulo, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!result.error && result.data) {
        return result.data.map((item) => ({
          id: item.id,
          title: item.titulo,
          createdAt: item.created_at,
        }));
      }
    } catch {
      // fallback local below
    }
  }

  return Array.from(conversations.values())
    .filter((item) => localConversationOwners.get(item.id) === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
