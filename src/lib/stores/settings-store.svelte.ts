// Settings Store - User preferences and app settings

export type Theme = 'light' | 'dark' | 'system';
export type QualityPreset = 'low' | 'medium' | 'high' | 'lossless';

export interface SettingsState {
  theme: Theme;
  defaultQuality: QualityPreset;
  autoDownload: boolean;
  preserveMetadata: boolean;
  maxConcurrentJobs: number;
  showAdvancedOptions: boolean;
  language: string;
  rememberLastFormat: boolean;
  lastUsedFormats: Record<string, string>;
}

const STORAGE_KEY = 'universal-converter-settings';

function getDefaultSettings(): SettingsState {
  return {
    theme: 'dark',
    defaultQuality: 'high',
    autoDownload: false,
    preserveMetadata: true,
    maxConcurrentJobs: 2,
    showAdvancedOptions: false,
    language: 'ja',
    rememberLastFormat: true,
    lastUsedFormats: {},
  };
}

function loadSettings(): SettingsState {
  if (typeof localStorage === 'undefined') {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...getDefaultSettings(), ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }

  return getDefaultSettings();
}

function saveSettings(settings: SettingsState): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

class SettingsStore {
  private state = $state<SettingsState>(getDefaultSettings());
  private initialized = false;

  // Initialize from localStorage (call on client-side mount)
  init(): void {
    if (this.initialized) return;
    this.state = loadSettings();
    this.initialized = true;
    this.applyTheme();
  }

  // Getters
  get theme() {
    return this.state.theme;
  }

  get defaultQuality() {
    return this.state.defaultQuality;
  }

  get autoDownload() {
    return this.state.autoDownload;
  }

  get preserveMetadata() {
    return this.state.preserveMetadata;
  }

  get maxConcurrentJobs() {
    return this.state.maxConcurrentJobs;
  }

  get showAdvancedOptions() {
    return this.state.showAdvancedOptions;
  }

  get language() {
    return this.state.language;
  }

  get rememberLastFormat() {
    return this.state.rememberLastFormat;
  }

  get lastUsedFormats() {
    return this.state.lastUsedFormats;
  }

  // Actions
  setTheme(theme: Theme): void {
    this.state.theme = theme;
    this.applyTheme();
    this.save();
  }

  setDefaultQuality(quality: QualityPreset): void {
    this.state.defaultQuality = quality;
    this.save();
  }

  setAutoDownload(enabled: boolean): void {
    this.state.autoDownload = enabled;
    this.save();
  }

  setPreserveMetadata(preserve: boolean): void {
    this.state.preserveMetadata = preserve;
    this.save();
  }

  setMaxConcurrentJobs(max: number): void {
    this.state.maxConcurrentJobs = Math.max(1, Math.min(8, max));
    this.save();
  }

  setShowAdvancedOptions(show: boolean): void {
    this.state.showAdvancedOptions = show;
    this.save();
  }

  setLanguage(lang: string): void {
    this.state.language = lang;
    this.save();
  }

  setRememberLastFormat(remember: boolean): void {
    this.state.rememberLastFormat = remember;
    this.save();
  }

  setLastUsedFormat(category: string, format: string): void {
    this.state.lastUsedFormats = {
      ...this.state.lastUsedFormats,
      [category]: format,
    };
    this.save();
  }

  getLastUsedFormat(category: string): string | undefined {
    return this.state.lastUsedFormats[category];
  }

  // Apply theme to document
  private applyTheme(): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    let effectiveTheme = this.state.theme;

    if (effectiveTheme === 'system') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    root.setAttribute('data-theme', effectiveTheme);
  }

  // Save to localStorage
  private save(): void {
    saveSettings(this.state);
  }

  // Reset to defaults
  reset(): void {
    this.state = getDefaultSettings();
    this.applyTheme();
    this.save();
  }

  // Export settings
  exportSettings(): string {
    return JSON.stringify(this.state, null, 2);
  }

  // Import settings
  importSettings(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      this.state = { ...getDefaultSettings(), ...imported };
      this.applyTheme();
      this.save();
      return true;
    } catch (e) {
      console.error('Failed to import settings:', e);
      return false;
    }
  }
}

// Export singleton instance
export const settingsStore = new SettingsStore();
