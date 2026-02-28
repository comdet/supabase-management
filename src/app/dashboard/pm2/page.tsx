'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Cpu, Database, AlertCircle, Play, Square, RotateCw, Trash2 } from 'lucide-react';

interface PM2Process {
    pid: number;
    name: string;
    pm_id: number;
    monit?: {
        memory: number;
        cpu: number;
    };
    pm2_env?: {
        status: string;
        created_at: number;
        restart_time: number;
        uptime: number;
    };
}

export default function PM2Dashboard() {
    const [processes, setProcesses] = useState<PM2Process[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    const fetchPM2Data = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/system/pm2');
            if (!res.ok) throw new Error('Failed to fetch PM2 data');
            const data = await res.json();
            setProcesses(data.pm2 || []);
            setError('');
        } catch (err: any) {
            setError(err.message || 'Error loading PM2 processes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPM2Data();
        const interval = setInterval(fetchPM2Data, 5000);
        return () => clearInterval(interval);
    }, []);

    const performAction = async (pm_id: number, action: string) => {
        if (!confirm(`Are you sure you want to ${action} process ID ${pm_id}?`)) return;

        try {
            setActionLoading(pm_id);
            const res = await fetch('/api/system/pm2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, id: pm_id })
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error || `Failed to ${action}`);
            await fetchPM2Data();
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatUptime = (timestamp: number) => {
        const uptimeSeconds = (Date.now() - timestamp) / 1000;
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-neutral-900 border border-neutral-800 p-6 rounded-xl shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold flex items-center text-white">
                        <Activity className="w-7 h-7 mr-3 text-blue-500" />
                        PM2 Process Monitor
                    </h1>
                    <p className="text-neutral-400 mt-1">Manage and monitor node tasks daemonized by PM2.</p>
                </div>
                <button
                    onClick={fetchPM2Data}
                    disabled={loading}
                    className="flexItems-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors border border-neutral-700 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-xl flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {error}
                </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400 text-sm">
                            <tr>
                                <th className="p-4 font-medium">Name</th>
                                <th className="p-4 font-medium">ID / PID</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">CPU</th>
                                <th className="p-4 font-medium">Memory</th>
                                <th className="p-4 font-medium">Uptime</th>
                                <th className="p-4 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800 text-sm">
                            {processes.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-neutral-500">
                                        No PM2 processes found running in this environment.
                                    </td>
                                </tr>
                            ) : (
                                processes.map((proc) => {
                                    const status = proc.pm2_env?.status || 'unknown';
                                    const isOnline = status === 'online';
                                    const isLoading = actionLoading === proc.pm_id;

                                    return (
                                        <tr key={proc.pm_id} className="hover:bg-neutral-800/50 transition-colors">
                                            <td className="p-4 font-medium text-white flex items-center">
                                                <div className={`w-2 h-2 rounded-full mr-3 ${isOnline ? 'bg-emerald-500' : 'bg-neutral-500'}`}></div>
                                                {proc.name}
                                            </td>
                                            <td className="p-4 text-neutral-400 font-mono">
                                                ID: {proc.pm_id} / PID: {proc.pid || '-'}
                                            </td>
                                            <td className="p-4 text-neutral-400">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-800 text-neutral-400'}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-neutral-300 flex items-center gap-2">
                                                <Cpu className="w-4 h-4 text-blue-400" />
                                                {proc.monit?.cpu || 0}%
                                            </td>
                                            <td className="p-4 text-neutral-300 flex items-center gap-2">
                                                <Database className="w-4 h-4 text-purple-400" />
                                                {formatBytes(proc.monit?.memory || 0)}
                                            </td>
                                            <td className="p-4 text-neutral-400">
                                                {proc.pm2_env?.created_at && isOnline ? formatUptime(proc.pm2_env.created_at) : '-'}
                                                <div className="text-xs text-neutral-500 mt-1">Restarts: {proc.pm2_env?.restart_time || 0}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {isOnline ? (
                                                        <>
                                                            <button
                                                                onClick={() => performAction(proc.pm_id, 'restart')}
                                                                disabled={isLoading}
                                                                className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors disabled:opacity-50"
                                                                title="Restart Process"
                                                            >
                                                                <RotateCw className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => performAction(proc.pm_id, 'stop')}
                                                                disabled={isLoading}
                                                                className="p-1.5 text-orange-400 hover:bg-orange-500/20 rounded transition-colors disabled:opacity-50"
                                                                title="Stop Process"
                                                            >
                                                                <Square className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => performAction(proc.pm_id, 'restart')}
                                                            disabled={isLoading}
                                                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
                                                            title="Start Process"
                                                        >
                                                            <Play className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => performAction(proc.pm_id, 'delete')}
                                                        disabled={isLoading}
                                                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50"
                                                        title="Delete Process (Kill)"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
