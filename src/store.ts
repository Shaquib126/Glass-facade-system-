import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: string; email: string; role: string; name: string; profilePhoto?: string; hasFaceDescriptor: boolean } | null;
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
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      queue: [],
      addToQueue: (record) => set((state) => ({ queue: [...state.queue, record] })),
      clearQueue: () => set({ queue: [] }),
    }),
    { name: 'glass-facade-offline' }
  )
);
