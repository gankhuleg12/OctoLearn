// expo-secure-store has no web implementation; fall back to localStorage.
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const secureStorage = {
  get: async (key: string) => storage()?.getItem(key) ?? null,
  set: async (key: string, value: string) => storage()?.setItem(key, value),
  remove: async (key: string) => storage()?.removeItem(key),
};
