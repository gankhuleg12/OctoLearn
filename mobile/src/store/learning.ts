import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ApiError } from '@/api/client';
import { api } from '@/api/endpoints';
import type { PathNodeRef, Pathway, Profile, ProgressSummary } from '@/api/types';
import { applyProgress } from '@/lib/pathway';
import { onLogout } from '@/store/auth';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LearningState {
  pathway: Pathway | null;
  profile: Profile | null;
  pathwayStatus: LoadStatus;
  /** Message of the last failed pathway load (shown when there is no cache). */
  pathwayError: string | null;
  /** True when the last refresh failed because of the network and we show cached data. */
  offline: boolean;
  lastSyncedAt: number | null;

  loadPathway: () => Promise<void>;
  loadProfile: () => Promise<void>;
  /** Optimistically marks a node finished and moves the active marker. */
  recordProgress: (completedId: string, nextNode: PathNodeRef | null, summary: ProgressSummary) => void;
  resetProgress: () => Promise<void>;
  clear: () => void;
}

const initial = {
  pathway: null,
  profile: null,
  pathwayStatus: 'idle' as LoadStatus,
  pathwayError: null,
  offline: false,
  lastSyncedAt: null,
};

export const useLearning = create<LearningState>()(
  persist(
    (set, get) => ({
      ...initial,

      async loadPathway() {
        set({ pathwayStatus: 'loading' });
        try {
          const pathway = await api.pathway();
          set({ pathway, pathwayStatus: 'ready', pathwayError: null, offline: false, lastSyncedAt: Date.now() });
        } catch (err) {
          const e = err as ApiError;
          set({
            pathwayStatus: get().pathway ? 'ready' : 'error',
            pathwayError: e.message,
            offline: e instanceof ApiError && e.isNetwork,
          });
        }
      },

      async loadProfile() {
        try {
          const profile = await api.profile();
          set({ profile, offline: false });
        } catch (err) {
          if (err instanceof ApiError && err.isNetwork) set({ offline: true });
          if (!get().profile) throw err;
        }
      },

      recordProgress(completedId, nextNode, summary) {
        const { pathway } = get();
        if (pathway) set({ pathway: applyProgress(pathway, completedId, nextNode, summary) });
        // Confirm with the server in the background.
        get().loadPathway();
      },

      async resetProgress() {
        await api.resetProgress();
        await Promise.all([get().loadPathway(), get().loadProfile()]);
      },

      clear() {
        set(initial);
      },
    }),
    {
      name: 'octolearn.learning',
      storage: createJSONStorage(() => AsyncStorage),
      // Cache content + progress so the app opens instantly and works offline (read-only).
      partialize: (s) => ({ pathway: s.pathway, profile: s.profile, lastSyncedAt: s.lastSyncedAt }),
    },
  ),
);

onLogout(() => useLearning.getState().clear());
