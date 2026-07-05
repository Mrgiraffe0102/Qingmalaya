/**
 * System settings API (Task 33).
 * Settings are exchanged as a flat { key: value } string map.
 */
import { get, put } from '@/utils/request';

export type SettingsMap = Record<string, string>;

export const getSettings = (): Promise<SettingsMap> =>
  get<SettingsMap>('/admin/settings');

export const updateSettings = (data: SettingsMap): Promise<SettingsMap> =>
  put<SettingsMap>('/admin/settings', data);
