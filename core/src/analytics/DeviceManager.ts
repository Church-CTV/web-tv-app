/**
 * DeviceManager — generates and persists a unique device identifier.
 * Mirrors Roku's DeviceUtils.getDeviceId() behavior.
 */

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, val: string): void;
  removeItem(key: string): void;
}

export class DeviceManager {
  private deviceId: string | null = null;
  private channelName: string | undefined;
  private appVersion: string | undefined;
  private storage: StorageAdapter | null;

  constructor(storage?: StorageAdapter | null) {
    if (storage !== undefined) {
      this.storage = storage;
    } else {
      this.storage = typeof localStorage !== 'undefined' ? localStorage : null;
    }
  }

  /** Generate a UUID-like device ID */
  private generateId(): string {
    // Use crypto.randomUUID if available, otherwise fall back to a random string
    if (typeof crypto !== 'undefined' && (crypto as { randomUUID?: () => string }).randomUUID) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
    // Fallback: 36-char hex string
    const hex = () =>
      Math.floor(Math.random() * 65536)
        .toString(16)
        .padStart(4, '0');
    return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
  }

  /** Get or create the device ID (persisted in storage) */
  getDeviceId(): string {
    if (this.deviceId) return this.deviceId;

    // Try to read from storage
    try {
      if (this.storage) {
        const stored = this.storage.getItem('ctv_device_id');
        if (stored) {
          this.deviceId = stored;
          return this.deviceId;
        }
      }
    } catch {
      // Storage not available
    }

    // Generate and persist new ID
    this.deviceId = this.generateId();
    try {
      if (this.storage) {
        this.storage.setItem('ctv_device_id', this.deviceId);
      }
    } catch {
      // Storage not available
    }
    return this.deviceId!;
  }

  setChannelName(name: string): void {
    this.channelName = name;
  }

  setAppVersion(version: string): void {
    this.appVersion = version;
  }

  getDeviceInfo(): { deviceId: string; channelName?: string; appVersion?: string } {
    return {
      deviceId: this.getDeviceId(),
      channelName: this.channelName,
      appVersion: this.appVersion,
    };
  }
}
