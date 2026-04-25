import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CookiePreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
}

interface CookieState {
  consented: boolean;
  consentDate: string | null;
  consentVersion: string;
  preferences: CookiePreferences;
  showBanner: boolean;
  showPreferences: boolean;

  acceptAll: () => void;
  rejectOptional: () => void;
  savePreferences: (prefs: Partial<CookiePreferences>) => void;
  resetConsent: () => void;
  openPreferences: () => void;
  closePreferences: () => void;
}

const CURRENT_VERSION = '1.0.0';

export const useCookieStore = create<CookieState>()(
  persist(
    (set) => ({
      consented: false,
      consentDate: null,
      consentVersion: CURRENT_VERSION,
      preferences: {
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false,
      },
      showBanner: true,
      showPreferences: false,

      acceptAll: () =>
        set({
          consented: true,
          consentDate: new Date().toISOString(),
          consentVersion: CURRENT_VERSION,
          preferences: { necessary: true, analytics: true, marketing: true, personalization: true },
          showBanner: false,
          showPreferences: false,
        }),

      rejectOptional: () =>
        set({
          consented: true,
          consentDate: new Date().toISOString(),
          consentVersion: CURRENT_VERSION,
          preferences: { necessary: true, analytics: false, marketing: false, personalization: false },
          showBanner: false,
          showPreferences: false,
        }),

      savePreferences: (prefs) =>
        set((state) => ({
          consented: true,
          consentDate: new Date().toISOString(),
          consentVersion: CURRENT_VERSION,
          preferences: { ...state.preferences, ...prefs, necessary: true },
          showBanner: false,
          showPreferences: false,
        })),

      resetConsent: () =>
        set({
          consented: false,
          consentDate: null,
          preferences: { necessary: true, analytics: false, marketing: false, personalization: false },
          showBanner: true,
        }),

      openPreferences: () => set({ showPreferences: true }),
      closePreferences: () => set({ showPreferences: false }),
    }),
    { name: 'lm-cookie-consent', version: 1 }
  )
);
