'use client';

import { useState, useEffect } from 'react';
import { Save, RefreshCw, ServerCrash, Database, HardDrive, Download, Trash2, Clock, CheckCircle2, UploadCloud } from 'lucide-react';

type Backup = {
    filename: string;
    size: number;
    date: string;
};

export default function BackupPage() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState({ text: '', type: '' });
    const [isBackingUp, setIsBackingUp] = useState(false);

    // Form states
    const [dbContainer, setDbContainer] = useState('');
    const [storageVolume, setStorageVolume] = useState('');
    const [containers, setContainers] = useState<any[]>([]);
    const [volumes, setVolumes] = useState<any[]>([]);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/backup');
            if (!res.ok) throw new Error('Failed to fetch backups');
            const data = await res.json();
            setBackups(data.backups);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [cr, vr] = await Promise.all([
                fetch('/api/docker/containers'),
                fetch('/api/docker/volumes')
            ]);
            const cd = await cr.json();
            const vd = await vr.json();

            setContainers(cd.containers || []);
            setVolumes(vd.volumes || []);

            if (cd.containers?.length > 0) {
                const hasDb = cd.containers.find((c: any) => c.name === 'supabase-db');
                setDbContainer(hasDb ? 'supabase-db' : cd.containers[0].name);
            }
            if (vd.volumes?.length > 0) {
                const hasVol = vd.volumes.find((v: any) => v.Name === 'supabase-storage');
                setStorageVolume(hasVol ? hasVol.Id || hasVol.Name : vd.volumes[0].Id || vd.volumes[0].Name);
            }
        } catch (err: any) {
            console.error('Failed to fetch options', err);
        }
    };

    useEffect(() => {
        fetchBackups();
        fetchOptions();
    }, []);

    const handleBackup = async (type: 'database' | 'volume') => {
        setIsBackingUp(true);
        setActionMessage({ text: `Starting ${type} backup...`, type: 'info' });

        try {
            const payload = type === 'database'
                ? { type, containerName: dbContainer }
                : { type, volumeName: storageVolume };

            const res = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Backup failed');
            }

            setActionMessage({ text: `${type} backup completed successfully!`, type: 'success' });
            fetchBackups();
        } catch (err: any) {
            setActionMessage({ text: err.message, type: 'error' });
        } finally {
            setIsBackingUp(false);
            // Clear success/info message after 5 seconds
            setTimeout(() => {
                setActionMessage(prev => prev.type === 'error' ? prev : { text: '', type: '' });
            }, 5000);
        }
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        try {
            const res = await fetch(`/api/backup/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error('Failed to delete backup');
            }

            fetchBackups();
        } catch (err: any) {
            setActionMessage({ text: err.message, type: 'error' });
        }
    };

    const handleRestore = async (filename: string) => {
        const type = filename.endsWith('.sql') ? 'database' : 'volume';
        const targetName = type === 'database' ? dbContainer : storageVolume;

        if (!targetName) {
            alert(`Please select a ${type === 'database' ? 'Database Container' : 'Volume'} above first.`);
            return;
        }

        if (!confirm(`Are you sure you want to restore ${filename} into ${targetName}? THIS WILL OVERWRITE EXISTING DATA AND CANNOT BE UNDONE.`)) return;

        setIsBackingUp(true);
        setActionMessage({ text: `Starting ${type} restore from ${filename}...`, type: 'info' });

        try {
            const payload = {
                type,
                filename,
                containerName: type === 'database' ? targetName : undefined,
                volumeName: type === 'volume' ? targetName : undefined
            };

            const res = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Restore failed');
            }

            setActionMessage({ text: `${type} restored successfully from ${filename}!`, type: 'success' });
        } catch (err: any) {
            setActionMessage({ text: err.message, type: 'error' });
        } finally {
            setIsBackingUp(false);
            setTimeout(() => {
                setActionMessage(prev => prev.type === 'error' ? prev : { text: '', type: '' });
            }, 5000);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Save className="w-6 h-6 text-blue-500" /> System Backup
                </h1>
                <button onClick={fetchBackups} disabled={loading || isBackingUp} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {actionMessage.text && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-2 border ${actionMessage.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                    actionMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                        'bg-blue-500/10 border-blue-500/20 text-blue-500'
                    }`}>
                    {actionMessage.type === 'info' && <RefreshCw className="w-5 h-5 animate-spin" />}
                    {actionMessage.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                    {actionMessage.type === 'error' && <ServerCrash className="w-5 h-5" />}
                    {actionMessage.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Database Backup Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Database className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">Database Backup</h3>
                            <p className="text-sm text-neutral-400">pg_dump output (.sql)</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Database Container Name</label>
                        <select
                            value={dbContainer}
                            onChange={(e) => setDbContainer(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-white outline-none focus:border-blue-500 appearance-none"
                        >
                            <option value="">Select a container...</option>
                            {containers.map((c) => (
                                <option key={c.name} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => handleBackup('database')}
                        disabled={isBackingUp || !dbContainer}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex justify-center items-center gap-2"
                    >
                        {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Backup Database
                    </button>
                </div>

                {/* Volume Backup Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                            <HardDrive className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">Storage Backup</h3>
                            <p className="text-sm text-neutral-400">Tar archive of volume (.tar.gz)</p>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-neutral-400 mb-1">Volume Name</label>
                        <select
                            value={storageVolume}
                            onChange={(e) => setStorageVolume(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-white outline-none focus:border-purple-500 appearance-none"
                        >
                            <option value="">Select a volume...</option>
                            {volumes.map((v) => (
                                <option key={v.Id || v.Name} value={v.Id || v.Name}>
                                    {v.Type === 'bind' ? '[BIND] ' : ''}{v.Name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => handleBackup('volume')}
                        disabled={isBackingUp || !storageVolume}
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors flex justify-center items-center gap-2"
                    >
                        {isBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Backup Storage Volume
                    </button>
                </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-4">Available Backups</h2>

            {error && !actionMessage.text ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <ServerCrash className="w-5 h-5" /> {error}
                </div>
            ) : (
                <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 relative min-h-[200px]">
                    {loading && backups.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center gap-2 text-neutral-400">
                                <RefreshCw className="w-5 h-5 animate-spin" /> Loading backups...
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400 text-sm">
                                <th className="p-4 font-medium">Filename</th>
                                <th className="p-4 font-medium hidden sm:table-cell">Date</th>
                                <th className="p-4 font-medium">Size</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {backups.map((backup) => (
                                <tr key={backup.filename} className="hover:bg-neutral-800/50 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center text-neutral-200">
                                            {backup.filename.endsWith('.sql') ? (
                                                <Database className="w-4 h-4 mr-2 text-blue-500" />
                                            ) : (
                                                <HardDrive className="w-4 h-4 mr-2 text-purple-500" />
                                            )}
                                            <span className="truncate max-w-[200px] sm:max-w-xs">{backup.filename}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-neutral-400 hidden sm:table-cell">
                                        {new Date(backup.date).toLocaleString()}
                                    </td>
                                    <td className="p-4 text-sm text-neutral-400">
                                        {formatSize(backup.size)}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleRestore(backup.filename)}
                                                disabled={isBackingUp}
                                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors disabled:opacity-50"
                                                title="Restore"
                                            >
                                                <UploadCloud className="w-4 h-4" />
                                            </button>
                                            <a
                                                href={`/api/backup/${encodeURIComponent(backup.filename)}`}
                                                download
                                                className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(backup.filename)}
                                                className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {backups.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-neutral-500">
                                        <Clock className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
                                        No backups found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
