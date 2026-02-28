'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, KeyRound, FolderTree, HardDrive, Loader2, Github } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const [settings, setSettings] = useState({
        ADMIN_USERNAME: '',
        BACKUP_DIR: '',
        FILE_MANAGER_ROOT: '',
        SUPABASE_PROJECT_PATH: '',
        SUPABASE_FUNCTIONS_REPO: '',
        SUPABASE_FUNCTIONS_PAT: ''
    });

    // State for Passwords
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get('/api/settings');
                if (res.data) {
                    setSettings({
                        ADMIN_USERNAME: res.data.ADMIN_USERNAME || '',
                        BACKUP_DIR: res.data.BACKUP_DIR || '',
                        FILE_MANAGER_ROOT: res.data.FILE_MANAGER_ROOT || '',
                        SUPABASE_PROJECT_PATH: res.data.SUPABASE_PROJECT_PATH || '',
                        SUPABASE_FUNCTIONS_REPO: res.data.SUPABASE_FUNCTIONS_REPO || '',
                        SUPABASE_FUNCTIONS_PAT: res.data.SUPABASE_FUNCTIONS_PAT || ''
                    });
                }
            } catch (err: unknown) {
                console.error('Failed to load settings', err);
                setMessage({ type: 'error', text: 'Failed to load system settings from server.' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        // Basic validation for new password
        if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match.' });
            return;
        }

        // Must provide current password if changing credentials
        if ((passwords.newPassword || settings.ADMIN_USERNAME !== settings.ADMIN_USERNAME) && !passwords.currentPassword) {
            setMessage({ type: 'error', text: 'Current password is required to change credentials.' });
            return;
        }

        setIsSaving(true);

        try {
            const payload = {
                currentPassword: passwords.currentPassword,
                newUsername: settings.ADMIN_USERNAME,
                newPassword: passwords.newPassword ? passwords.newPassword : undefined,
                backupDir: settings.BACKUP_DIR,
                fileManagerRoot: settings.FILE_MANAGER_ROOT,
                supabaseProjectPath: settings.SUPABASE_PROJECT_PATH,
                supabaseFunctionsRepo: settings.SUPABASE_FUNCTIONS_REPO,
                supabaseFunctionsPat: settings.SUPABASE_FUNCTIONS_PAT
            };

            const res = await axios.post('/api/settings', payload);

            if (res.data.success) {
                setMessage({ type: 'success', text: 'Settings updated successfully.' });

                // Clear password fields
                setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });

                if (res.data.credentialsChanged) {
                    // Force logout if credentials changed
                    setTimeout(async () => {
                        await axios.post('/api/auth/logout');
                        window.location.href = '/login';
                    }, 2000);
                    setMessage({ type: 'success', text: 'Credentials changed. Logging out in 2 seconds...' });
                }
            }
        } catch (err: unknown) {
            console.error('Save Settings Error:', err);
            const errorResponse = err as { response?: { data?: { error?: string } } };
            setMessage({ type: 'error', text: errorResponse.response?.data?.error || 'Failed to update settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
                    <User className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
                    <p className="text-neutral-400 text-sm mt-1">Configure your dashboard credentials and environment paths.</p>
                </div>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                    }`}>
                    <div className="flex-1 font-medium">{message.text}</div>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">

                {/* Account Credentials Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-semibold text-white">Account Credentials</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Admin Username</label>
                                <input
                                    type="text"
                                    value={settings.ADMIN_USERNAME}
                                    onChange={(e) => setSettings({ ...settings, ADMIN_USERNAME: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                    placeholder="admin"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Current Password (Required to change credentials)</label>
                                <input
                                    type="password"
                                    value={passwords.currentPassword}
                                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    placeholder="••••••••"
                                    autoComplete="off"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">New Password (Optional)</label>
                                <input
                                    type="password"
                                    value={passwords.newPassword}
                                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    placeholder="Leave blank to keep current"
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwords.confirmPassword}
                                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* System Paths Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                        <FolderTree className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-semibold text-white">System Paths</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-neutral-500" />
                                File Manager Root Directory
                            </label>
                            <input
                                type="text"
                                value={settings.FILE_MANAGER_ROOT}
                                onChange={(e) => setSettings({ ...settings, FILE_MANAGER_ROOT: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                placeholder="/"
                                required
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                                Restricts the web-based file manager to only view files within this directory. Default is `/`.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-neutral-500" />
                                Local Backup Destination Directory
                            </label>
                            <input
                                type="text"
                                value={settings.BACKUP_DIR}
                                onChange={(e) => setSettings({ ...settings, BACKUP_DIR: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                placeholder="/path/to/backups"
                                required
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                                The folder where `.tar.gz` and `.sql` backups generated by the system will be saved.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-300 flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-neutral-500" />
                                Supabase Project Path
                            </label>
                            <input
                                type="text"
                                value={settings.SUPABASE_PROJECT_PATH}
                                onChange={(e) => setSettings({ ...settings, SUPABASE_PROJECT_PATH: e.target.value })}
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm"
                                placeholder="/path/to/supabase-project"
                                required
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                                โฟลเดอร์โปรเจกต์ต้นทางที่มีไฟล์ <code>.env</code> และ <code>docker-compose.yml</code> ของ Supabase
                            </p>
                        </div>
                    </div>
                </div>

                {/* Supabase Functions GitHub Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                        <Github className="w-5 h-5 text-indigo-400" />
                        <h2 className="font-semibold text-white">Supabase Functions (Private Github Repo)</h2>
                    </div>
                    <div className="p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">GitHub Repository URL or Path</label>
                                <input
                                    type="text"
                                    value={settings.SUPABASE_FUNCTIONS_REPO}
                                    onChange={(e) => setSettings({ ...settings, SUPABASE_FUNCTIONS_REPO: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    placeholder="owner/repo"
                                />
                                <p className="text-xs text-neutral-500 mt-1">
                                    The private repository holding your Deno compiled edge functions (e.g. <code>my-org/backend-repo</code>).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">GitHub Personal Access Token (PAT)</label>
                                <input
                                    type="password"
                                    value={settings.SUPABASE_FUNCTIONS_PAT}
                                    onChange={(e) => setSettings({ ...settings, SUPABASE_FUNCTIONS_PAT: e.target.value })}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono"
                                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxx"
                                    autoComplete="off"
                                />
                                <p className="text-xs text-neutral-500 mt-1">
                                    Required to download release artifacts from private repositories.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                        type="button"
                        className="px-6 py-2.5 text-sm font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all"
                        onClick={() => router.push('/dashboard')}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Configurations
                    </button>
                </div>
            </form>
        </div>
    );
}
