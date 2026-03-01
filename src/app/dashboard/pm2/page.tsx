'use client';

import { useState, useEffect } from 'react';
import { Activity, RefreshCw, Cpu, Database, AlertCircle, Play, Square, RotateCw, Trash2, FileText, X } from 'lucide-react';

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

    const [showStartModal, setShowStartModal] = useState(false);
    const [startName, setStartName] = useState('');
    const [startCommand, setStartCommand] = useState('');

    const [showLogsModal, setShowLogsModal] = useState(false);
    const [activeLogs, setActiveLogs] = useState('');
    const [activeLogsName, setActiveLogsName] = useState('');
    const [logsLoading, setLogsLoading] = useState(false);

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

    const handleStartProcess = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setActionLoading(-1); // -1 indicates starting a new process
            const res = await fetch('/api/system/pm2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', name: startName, command: startCommand })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Failed to start process');
            setShowStartModal(false);
            setStartName('');
            setStartCommand('');
            await fetchPM2Data();
        } catch (err: any) {
            console.error(err);
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const fetchLogs = async (pm_id: number, name: string) => {
        try {
            setLogsLoading(true);
            setActiveLogsName(name);
            setShowLogsModal(true);
            setActiveLogs('');
            const res = await fetch(`/api/system/pm2/${pm_id}/logs`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch logs');
            setActiveLogs(data.logs || 'No logs found.');
        } catch (err: any) {
            console.error(err);
            setActiveLogs(`Error: ${err.message}`);
        } finally {
            setLogsLoading(false);
        }
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
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowStartModal(true)}
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors text-sm font-medium"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Start Process
                    </button>
                    <button
                        onClick={fetchPM2Data}
                        disabled={loading}
                        className="flex items-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors border border-neutral-700 disabled:opacity-50 text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
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
                                            <td className="p-4 font-medium text-white">
                                                <div className="flex items-center">
                                                    <div className={`w-2 h-2 rounded-full mr-3 flex-shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-neutral-500'}`}></div>
                                                    <span className="truncate">{proc.name}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-neutral-400 font-mono">
                                                ID: {proc.pm_id} / PID: {proc.pid || '-'}
                                            </td>
                                            <td className="p-4 text-neutral-400">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-neutral-800 text-neutral-400'}`}>
                                                    {status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-neutral-300">
                                                <div className="flex items-center gap-2">
                                                    <Cpu className="w-4 h-4 text-blue-400" />
                                                    {proc.monit?.cpu || 0}%
                                                </div>
                                            </td>
                                            <td className="p-4 text-neutral-300">
                                                <div className="flex items-center gap-2">
                                                    <Database className="w-4 h-4 text-purple-400" />
                                                    {formatBytes(proc.monit?.memory || 0)}
                                                </div>
                                            </td>
                                            <td className="p-4 text-neutral-400">
                                                {proc.pm2_env?.created_at && isOnline ? formatUptime(proc.pm2_env.created_at) : '-'}
                                                <div className="text-xs text-neutral-500 mt-1">Restarts: {proc.pm2_env?.restart_time || 0}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => fetchLogs(proc.pm_id, proc.name)}
                                                        disabled={isLoading}
                                                        className="p-1.5 text-neutral-400 hover:bg-neutral-500/20 hover:text-white rounded transition-colors disabled:opacity-50"
                                                        title="View Logs"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </button>
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

            {/* Modals */}
            {showStartModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Play className="w-5 h-5 text-indigo-400" />
                                Start New Process
                            </h3>
                            <button onClick={() => setShowStartModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleStartProcess} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Process Name</label>
                                <input
                                    type="text"
                                    value={startName}
                                    onChange={(e) => setStartName(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                                    placeholder="my-app"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Command / Script</label>
                                <input
                                    type="text"
                                    value={startCommand}
                                    onChange={(e) => setStartCommand(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-colors"
                                    placeholder="npm run start OR server.js"
                                    required
                                />
                                <p className="text-xs text-neutral-500 mt-1">Will be executed internally as: `npx pm2 start &quot;YOUR_COMMAND&quot; --name &quot;YOUR_NAME&quot;`</p>
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowStartModal(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-neutral-400 bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === -1}
                                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                                >
                                    {actionLoading === -1 ? 'Starting...' : 'Start Process'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showLogsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/80">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-neutral-400" />
                                Logs: {activeLogsName}
                            </h3>
                            <div className="flex items-center gap-4">
                                <button onClick={() => fetchLogs(processes.find(p => p.name === activeLogsName)?.pm_id || 0, activeLogsName)} className="text-neutral-400 hover:text-white transition-colors" title="Refresh Logs">
                                    <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
                                </button>
                                <button onClick={() => setShowLogsModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-auto flex-1 bg-black">
                            {logsLoading && !activeLogs ? (
                                <div className="text-neutral-500 flex items-center gap-2">Fetching PM2 logs...</div>
                            ) : (
                                <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                                    {activeLogs}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
