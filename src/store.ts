import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';

// Custom storage object using idb-keyval for IndexedDB
const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

interface AuthState {
  token: string | null;
  user: { id: string; email: string; role: string; name: string; employeeId?: string; profilePhoto?: string; hasFaceDescriptor: boolean } | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  updateUser: (data: any) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
    }),
    { name: 'glass-facade-auth' }
  )
);

interface OfflineState {
  queue: any[];
  addToQueue: (record: any) => void;
  clearQueue: () => void;
  removeFromQueue: (recordId: string) => void;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      queue: [],
      addToQueue: (record) => set((state) => ({ queue: [...state.queue, record] })),
      clearQueue: () => set({ queue: [] }),
      removeFromQueue: (recordId) => set((state) => ({ queue: state.queue.filter((r: any) => r.id !== recordId && r.timestamp !== recordId) })),
    }),
    { 
      name: 'glass-facade-offline',
      storage: createJSONStorage(() => idbStorage)
    }
  )
);
