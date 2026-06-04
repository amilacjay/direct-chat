import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  text?: string;
  photoUrl?: string; // data URL (persistable) — see lib/media.ts
  ts: number;
  fromMe: boolean;
  relayed: boolean;
  delivered: boolean;
}

interface ChatState {
  // peerId -> ordered list of messages
  conversations: Record<string, ChatMessage[]>;
  // peerId -> number of unseen incoming messages
  unread: Record<string, number>;
  // the chat currently open on screen (not persisted)
  activePeer: string | null;

  addMessage: (peerId: string, msg: Omit<ChatMessage, 'id'>) => void;
  setActivePeer: (peerId: string | null) => void;
  markRead: (peerId: string) => void;
  clearAll: () => void;
}

// Best-effort storage: if localStorage is full (e.g. lots of photo data URLs)
// we keep the conversation in memory rather than throwing and losing the app.
const safeStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Quota exceeded — skip persisting this write; in-memory state is intact.
    }
  },
  removeItem: (name: string) => localStorage.removeItem(name),
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: {},
      unread: {},
      activePeer: null,

      addMessage: (peerId, msg) =>
        set((state) => {
          const id = `${Date.now()}-${Math.random()}`;
          const existing = state.conversations[peerId] ?? [];
          // Count as unread only when it's an incoming message for a chat the
          // user isn't currently looking at.
          const incrementUnread = !msg.fromMe && state.activePeer !== peerId;
          return {
            conversations: {
              ...state.conversations,
              [peerId]: [...existing, { ...msg, id }],
            },
            unread: incrementUnread
              ? { ...state.unread, [peerId]: (state.unread[peerId] ?? 0) + 1 }
              : state.unread,
          };
        }),

      setActivePeer: (peerId) =>
        set((state) => ({
          activePeer: peerId,
          unread:
            peerId && state.unread[peerId]
              ? { ...state.unread, [peerId]: 0 }
              : state.unread,
        })),

      markRead: (peerId) =>
        set((state) =>
          state.unread[peerId]
            ? { unread: { ...state.unread, [peerId]: 0 } }
            : state
        ),

      clearAll: () => set({ conversations: {}, unread: {}, activePeer: null }),
    }),
    {
      name: 'direct_chat',
      storage: createJSONStorage(() => safeStorage),
      // Persist history + unread counts; activePeer is transient UI state.
      partialize: (state) => ({
        conversations: state.conversations,
        unread: state.unread,
      }),
    }
  )
);
