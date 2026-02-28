'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Download, Loader2, AlertCircle, CheckCircle2, Zap, RotateCcw, Trash2, Database, Save, Play } from 'lucide-react';

interface Migration {
    name: string;
    version: string;
    applied: boolean;
}

interface ReleaseAsset {
    id: number | string;
    name: string;
    url: string;
}

interface Release {
    id: number | string;
    name: string;
    tag_name: string;
    published_at: string;
    assets: ReleaseAsset[];
}

export default function DatabasePage() {
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState({ type: '', text: '', details: '' });

    // Releases & Artifacts
    const [releases, setReleases] = useState<Release[]>([]);
    const [selectedAssetUrl, setSelectedAssetUrl] = useState('');
    const [dbRepo, setDbRepo] = useState('');

    // Migrations
    const [migrations, setMigrations] = useState<Migration[]>([]);
    const [targetDir, setTargetDir] = useState('');

    // Danger Zone
    const [clearConfirmText, setClearConfirmText] = useState('');

    useEffect(() => {
        fetchReleases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchReleases = async () => {
        setIsLoading(true);
        try {
            // Reusing the functions deploy Github fetcher because they use the same settings (or we could make a dedicated one, 
            // but for simplicity we rely on the same SUPABASE_FUNCTIONS_REPO for everything via API route)
            const res = await axios.get('/api/database/deploy');
            setReleases(res.data.releases || []);
            setDbRepo(res.data.repo || '');

            if (res.data.releases?.length > 0) {
                const firstRelease = res.data.releases[0];
                if (firstRelease.assets?.length > 0) {
                    setSelectedAssetUrl(firstRelease.assets[0].url);
                }
            }

            // Also attempt to load current cached migrations
            await loadMigrations();

        } catch (err: unknown) {
            console.warn('Failed to load DB releases', err);
        } finally {
            setIsLoading(false);
        }
    };

    const loadMigrations = async () => {
        try {
            const res = await axios.get('/api/database/migrations');
            setMigrations(res.data.migrations || []);
            setTargetDir(res.data.targetDir || '');
        } catch (err) {
            console.error('Failed to load migrations list', err);
        }
    };

    const showMessage = (type: 'success' | 'error', text: string, details?: string) => {
        setMessage({ type, text, details: details || '' });
    };

    // 1. Download Artifact
    const handleDownloadArtifact = async () => {
        if (!selectedAssetUrl) return;
        setActionLoading('download');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/database/deploy', { assetUrl: selectedAssetUrl });
            if (res.data.success) {
                showMessage('success', 'Artifact downloaded and extracted. Reading migrations...');
                // Reload migrations table
                await loadMigrations();
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }, message: string };
            showMessage('error', 'Failed to deploy Database artifact.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    // 2. Migrate Pending
    const handleMigratePending = async () => {
        const pending = migrations.filter(m => !m.applied);
        if (pending.length === 0) {
            showMessage('success', 'No pending migrations to apply.');
            return;
        }

        setActionLoading('migrate');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/database/migrations', { files: pending, targetDir });

            if (res.data.success) {
                showMessage('success', `Applied ${pending.length} migrations successfully!`);
                await loadMigrations(); // refresh the list to show all green
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }, message: string };
            showMessage('error', 'Failed to apply migrations.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    // 3. Seed Execute
    const handleExecuteSeed = async () => {
        if (!confirm('Execute seed.sql onto the public schema?')) return;
        setActionLoading('seed');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/database/seed');
            if (res.data.success) {
                showMessage('success', 'Seed data applied successfully!', res.data.output);
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }, message: string };
            showMessage('error', 'Failed to apply seed data.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    // 4. Backup Dump
    const handleDump = () => {
        window.location.href = '/api/database/backup';
    };

    // 5. Clear Database
    const handleClear = async () => {
        if (clearConfirmText !== 'CLEAR_ALL') {
            alert('Please type CLEAR_ALL to confirm.');
            return;
        }

        setActionLoading('clear');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/database/clear', { confirm: clearConfirmText });
            if (res.data.success) {
                showMessage('success', 'Database cleared successfully.');
                setClearConfirmText('');
                // Note: clearing drops schema_migrations table, so our migration list will reset
                await loadMigrations();
            }
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }, message: string };
            showMessage('error', 'Failed to clear database.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };


    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-indigo-500/20 p-2 rounded-lg border border-indigo-500/30">
                    <HardDrive className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Database Management</h1>
                    <p className="text-neutral-400 text-sm mt-1">Manage schemas, deploy migrations via GitHub artifacts, backup, and restore.</p>
                </div>
            </div>

            {/* Notification Alert */}
            {message.text && (
                <div className={`p-4 rounded-xl border ${message.type === 'error' ? 'bg-red-950 border-red-900/50' : 'bg-green-950 border-green-900/50'}`}>
                    <div className="flex items-start gap-3">
                        {message.type === 'error' ? (
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 space-y-2">
                            <div className={`font-medium ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                {message.text}
                            </div>
                            {message.details && (
                                <div className="bg-neutral-950 rounded bg-opacity-50 p-3 mt-2 overflow-x-auto">
                                    <pre className={`text-xs font-mono whitespace-pre-wrap ${message.type === 'error' ? 'text-red-300' : 'text-neutral-300'}`}>
                                        {message.details}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Flow & Artifacts */}
                <div className="lg:col-span-4 space-y-6">
                    {/* Artifact Deployer */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Download className="w-5 h-5 text-indigo-400" />
                                <h2 className="font-semibold text-white">1. Fetch Artifact</h2>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            {isLoading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                                </div>
                            ) : dbRepo ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-400 block break-all">Repository: {dbRepo}</label>
                                        <select
                                            value={selectedAssetUrl}
                                            onChange={(e) => setSelectedAssetUrl(e.target.value)}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                                        >
                                            <option value="">-- Choose an Artifact --</option>
                                            {releases.map((release) => (
                                                <optgroup key={release.id} label={`${release.name || release.tag_name} (${new Date(release.published_at).toLocaleDateString()})`}>
                                                    {release.assets && Array.isArray(release.assets) && release.assets.map((asset) => (
                                                        <option key={asset.id} value={asset.url}>
                                                            {asset.name}
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <p className="text-xs text-neutral-500">Downloads database.zip containing `migrations/` and `seed.sql` to local /tmp.</p>
                                    <button
                                        onClick={handleDownloadArtifact}
                                        disabled={actionLoading !== null || !selectedAssetUrl}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-indigo-950 bg-indigo-500 hover:bg-indigo-400 border border-indigo-400/50 rounded-xl transition-all shadow-lg shadow-indigo-500/10 disabled:opacity-50"
                                    >
                                        {actionLoading === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                        Get Artifact
                                    </button>
                                </>
                            ) : (
                                <div className="text-sm text-neutral-500 text-center py-4 bg-neutral-950 rounded-lg">
                                    No GitHub repository configured. Go to Settings.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Backup & Dumps */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                            <Save className="w-5 h-5 text-emerald-400" />
                            <h2 className="font-semibold text-white">Database Backup</h2>
                        </div>
                        <div className="p-5 flex flex-col gap-3">
                            <button
                                onClick={handleDump}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                Export Public Schema (.sql)
                            </button>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="bg-red-950/20 border border-red-900/50 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-red-900/50 bg-red-950/30 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-500" />
                            <h2 className="font-semibold text-red-500">Danger Zone</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-red-400">Clearing will completely wipe the public schema, deleting all content and migrations applied.</p>
                            <input
                                type="text"
                                value={clearConfirmText}
                                onChange={(e) => setClearConfirmText(e.target.value)}
                                className="w-full bg-black border border-red-900/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 font-mono text-sm placeholder:text-red-900/50 text-center"
                                placeholder="Type CLEAR_ALL"
                            />
                            <button
                                onClick={handleClear}
                                disabled={actionLoading !== null || clearConfirmText !== 'CLEAR_ALL'}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-500 transition-all rounded-xl disabled:opacity-50"
                            >
                                {actionLoading === 'clear' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                Drop Public Schema
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Migrations Table */}
                <div className="lg:col-span-8 flex flex-col gap-6">

                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col flex-1 max-h-[600px]">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-400" />
                                <h2 className="font-semibold text-white">2. Migrations Tracker</h2>
                            </div>
                            <button
                                onClick={handleMigratePending}
                                disabled={actionLoading !== null || migrations.filter(m => !m.applied).length === 0}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-blue-400 hover:bg-blue-300 rounded-lg transition-all shadow-lg disabled:opacity-50"
                            >
                                {actionLoading === 'migrate' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Migrate All Pending
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto bg-black p-4">
                            {migrations.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-neutral-500 bg-neutral-950 border border-dashed border-neutral-800 rounded-xl">
                                    <Database className="w-12 h-12 mb-3 opacity-20" />
                                    <p>No migrations loaded.</p>
                                    <p className="text-xs mt-1">Fetch an artifact first.</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead className="text-xs text-neutral-500 uppercase bg-neutral-950 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3 font-medium rounded-tl-lg">Status</th>
                                            <th className="px-4 py-3 font-medium">Version</th>
                                            <th className="px-4 py-3 font-medium rounded-tr-lg">File Name</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-800">
                                        {migrations.map((m, i) => (
                                            <tr key={i} className={`hover:bg-neutral-900/50 transition-colors ${m.applied ? 'opacity-70' : ''}`}>
                                                <td className="px-4 py-3">
                                                    {m.applied ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium border border-emerald-500/20">
                                                            <CheckCircle2 className="w-3 h-3" /> Applied
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20">
                                                            <RotateCcw className="w-3 h-3" /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-neutral-400">{m.version}</td>
                                                <td className="px-4 py-3 text-neutral-300 truncate max-w-[200px]">{m.name}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Seed Section */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mt-auto">
                        <div className="px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <Save className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">3. Apply Seed Data</h3>
                                    <p className="text-xs text-neutral-400 mt-1">Injects <code className="text-emerald-400">seed.sql</code> into the database.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleExecuteSeed}
                                disabled={actionLoading !== null || !targetDir}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'seed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                                Run seed.sql
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
