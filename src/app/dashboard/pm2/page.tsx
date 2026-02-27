'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, AlertTriangle } from 'lucide-react';

type PM2Process = {
    id: number;
    name: string;
    status: string;
    memory: number;
    cpu: number;
    uptime: number;
    restarts: number;
};

type currDataShape = {
    pm2: PM2Process[];
    cron: any[];
}

export default function PM2MonitorPage() {
    const [data, setData] = useState<currDataShape | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchSystemData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/system');
            if (!res.ok) throw new Error('Failed to fetch system data');
            const json = await res.json();
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSystemData();
        // Auto refresh every 10 seconds for PM2 stats
        const interval = setInterval(fetchSystemData, 10000);
        return () => clearInterval(interval);
    }, []);

    const formatMemory = (bytes: number) => {
        if (!bytes) return '0 MB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    const formatUptime = (msSinceEpoch: number) => {
        if (!msSinceEpoch) return '0s';
        const uptimeMs = Date.now() - msSinceEpoch;

        let seconds = Math.floor(uptimeMs / 1000);
        let minutes = Math.floor(seconds / 60);
        let hours = Math.floor(minutes / 60);
        let days = Math.floor(hours / 24);

        hours %= 24;
        minutes %= 60;
        seconds %= 60;

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-indigo-500" /> PM2 Monitor
                    </h1>
                    <p className="text-neutral-400 text-sm mt-1">Monitor background processes running via PM2.</p>
                </div>
                <button
                    onClick={fetchSystemData}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2 mb-6">
                    <AlertTriangle className="w-5 h-5" /> {error}
                </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left max-h-[700px]">
                        <thead className="sticky top-0 bg-neutral-950/90 backdrop-blur-sm z-10 border-b border-neutral-800">
                            <tr className="text-neutral-400 text-xs uppercase tracking-wider">
                                <th className="px-5 py-4 font-medium">Process Name</th>
                                <th className="px-5 py-4 font-medium">Status</th>
                                <th className="px-5 py-4 font-medium">CPU / Memory</th>
                                <th className="px-5 py-4 font-medium text-right">Uptime & Restarts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {loading && !data ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-12 text-center text-neutral-500">
                                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-neutral-600" />
                                        Reading PM2 state...
                                    </td>
                                </tr>
                            ) : data?.pm2.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-12 text-center text-neutral-500">
                                        <Activity className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                                        No PM2 processes found running in this user environment.
                                    </td>
                                </tr>
                            ) : (
                                data?.pm2.map((proc) => {
                                    const isOnline = proc.status === 'online';
                                    return (
                                        <tr key={proc.id} className="hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium text-white text-base">{proc.name}</span>
                                                    <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full font-mono">id: {proc.id}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full ${isOnline ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                                                    {proc.status.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-sm text-neutral-300">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono">{proc.cpu.toFixed(1)}% CPU</span>
                                                    <span className="text-xs text-neutral-500 font-mono">{formatMemory(proc.memory)}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="text-sm font-mono text-neutral-300">{formatUptime(proc.uptime)}</span>
                                                {proc.restarts > 0 && (
                                                    <div className="text-xs text-red-400/80 mt-1.5 font-medium bg-red-500/10 inline-block px-2 py-0.5 rounded border border-red-500/20">
                                                        {proc.restarts} restarts
                                                    </div>
                                                )}
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
