import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { t, setLanguage, LANGUAGE_KEY } from '../../../lib/i18n';
import type { Settings } from '../SettingsHelpers';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/electron', () => ({ invoke }));
vi.mock('../tabs/StartupVaultSetting', () => ({ default: () => null }));
vi.mock('../tabs/UpdatesSetting', () => ({ default: () => null }));
import GeneralTab from '../tabs/GeneralTab';
import SettingsDialog from '../SettingsDialog';
const stored = { theme: 'system', color_scheme: 'modern', icon_pack: 'lucide', ui_language: 'en', ui_scale: 1 } as Settings;
beforeEach(() => { setLanguage('zh-TW'); invoke.mockReset(); invoke.mockImplementation(async (cmd) => cmd === 'settings_get' ? stored : null); });
afterEach(() => { setLanguage('en'); localStorage.removeItem(LANGUAGE_KEY); });
describe('Language preference', () => {
  it('shows Traditional Chinese labels and keeps locale codes unchanged', () => {
    const update = vi.fn();
    render(<GeneralTab settings={stored} setSettings={update} onClose={() => {}} />);
    const select = screen.getByRole('combobox', { name: '介面語言' });
    expect(screen.getByRole('option', { name: '繁體中文（台灣）' })).toHaveValue('zh-TW');
    fireEvent.change(select, { target: { value: 'zh-TW' } });
    expect(update.mock.calls[0][0](stored)).toEqual({ ...stored, ui_language: 'zh-TW' });
    expect(t('Save')).toBe('儲存');
  });
  it('saves language and defers activation, without relaunching or closing sessions', async () => {
    render(<SettingsDialog onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: '介面語言' });
    await waitFor(() => expect(select).toHaveValue('en'));
    fireEvent.change(select, { target: { value: 'zh-TW' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '儲存' })); });
    expect(invoke).toHaveBeenCalledWith('settings_save', { settings: { ...stored, ui_language: 'zh-TW' } });
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe('zh-TW');
    expect(invoke.mock.calls.some(([cmd]) => /relaunch|disconnect|close_session/.test(cmd))).toBe(false);
  });
  it('cancel discards the pending preference', async () => {
    render(<SettingsDialog onClose={() => {}} />);
    const select = await screen.findByRole('combobox', { name: '介面語言' });
    await waitFor(() => expect(select).toHaveValue('en'));
    fireEvent.change(select, { target: { value: 'zh-TW' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(invoke.mock.calls.some(([cmd]) => cmd === 'settings_save')).toBe(false);
  });
});
