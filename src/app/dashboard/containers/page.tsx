'use client';

import { useState, useEffect } from 'react';
import { Play, Square, RotateCw, ServerCrash, CheckCircle2, Clock, Terminal, Info, X } from 'lucide-react';

type Container = {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
};

export default function ContainersPage() {
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [inspectData, setInspectData] = useState<any>(null);
    const [showInspectModal, setShowInspectModal] = useState(false);
    const [inspectLoading, setInspectLoading] = useState(false);

    const fetchContainers = async () => {
        try {
            const res = await fetch('/api/docker/containers');
            if (!res.ok) throw new Error('Failed to fetch containers');
            const data = await res.json();
            setContainers(data.containers);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
        // Refresh every 10 seconds
        const interval = setInterval(fetchContainers, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
        setActionLoading(id);
        try {
            const res = await fetch(`/api/docker/containers/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || `Failed to ${action} container`);
            }
            await fetchContainers(); // Refresh list immediately after action
        } catch (err: any) {
            alert(err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleInspect = async (id: string) => {
        setInspectLoading(true);
        setShowInspectModal(true);
        setInspectData(null);
        try {
            const res = await fetch(`/api/docker/containers/${id}`);
            if (!res.ok) throw new Error('Failed to fetch container details');
            const data = await res.json();
            setInspectData(data.info);
        } catch (err: any) {
            alert(err.message);
            setShowInspectModal(false);
        } finally {
            setInspectLoading(false);
        }
    };

    if (loading) return <div className="text-neutral-400 flex items-center gap-2"><Clock className="animate-spin w-4 h-4" /> Loading containers...</div>;
    if (error) return <div className="text-red-500 bg-red-500/10 p-4 rounded-lg flex items-center gap-2"><ServerCrash className="w-5 h-5" /> {error}</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Docker Containers</h1>
                <button onClick={fetchContainers} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2">
                    <RotateCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400 text-sm">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Image</th>
                            <th className="p-4 font-medium">State</th>
                            <th className="p-4 font-medium">Status</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {containers.map((c) => (
                            <tr key={c.id} className="hover:bg-neutral-800/50 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-neutral-200">{c.name}</div>
                                    <div className="text-xs text-neutral-500 truncate w-32" title={c.id}>{c.id.substring(0, 12)}</div>
                                </td>
                                <td className="p-4 text-sm text-neutral-400 truncate max-w-xs">{c.image}</td>
                                <td className="p-4">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${c.state === 'running' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                        c.state === 'exited' ? 'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20' :
                                            'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                        }`}>
                                        {c.state === 'running' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                        {c.state}
                                    </span>
                                </td>
                                <td className="p-4 text-sm text-neutral-400">{c.status}</td>
                                <td className="p-4 text-right">
                                    <div className="flex justify-end gap-2 items-center">
                                        <button
                                            onClick={() => handleInspect(c.id)}
                                            className="p-1.5 text-blue-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
                                            title="Inspect Info"
                                        >
                                            <Info className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => window.location.href = `/dashboard/containers/${c.id}/logs`}
                                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors"
                                            title="View Logs"
                                        >
                                            <Terminal className="w-4 h-4" />
                                        </button>
                                        {c.state !== 'running' && (
                                            <button
                                                onClick={() => handleAction(c.id, 'start')}
                                                disabled={actionLoading === c.id}
                                                className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-md transition-colors disabled:opacity-50"
                                                title="Start"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}
                                        {c.state === 'running' && (
                                            <>
                                                <button
                                                    onClick={() => handleAction(c.id, 'restart')}
                                                    disabled={actionLoading === c.id}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-50"
                                                    title="Restart"
                                                >
                                                    <RotateCw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleAction(c.id, 'stop')}
                                                    disabled={actionLoading === c.id}
                                                    className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                                                    title="Stop"
                                                >
                                                    <Square className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {containers.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-neutral-500">
                                    No containers found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Inspect Modal */}
            {showInspectModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex justify-between items-center p-4 border-b border-neutral-800">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Info className="w-5 h-5 text-blue-500" /> Container Inspect
                            </h2>
                            <button onClick={() => setShowInspectModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 text-sm text-neutral-300">
                            {inspectLoading ? (
                                <div className="flex items-center justify-center h-32 gap-3 text-neutral-400">
                                    <Clock className="w-5 h-5 animate-spin" /> Fetching config...
                                </div>
                            ) : inspectData ? (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-white font-semibold mb-2 border-b border-neutral-800 pb-1">General Info</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-neutral-950 p-4 rounded-lg border border-neutral-800/50">
                                            <div><span className="text-neutral-500">Name:</span> {inspectData.Name}</div>
                                            <div><span className="text-neutral-500">ID:</span> <span className="text-xs">{inspectData.Id}</span></div>
                                            <div><span className="text-neutral-500">Image:</span> {inspectData.Config?.Image}</div>
                                            <div><span className="text-neutral-500">Created:</span> {new Date(inspectData.Created).toLocaleString()}</div>
                                            <div><span className="text-neutral-500">Restart Policy:</span> {inspectData.HostConfig?.RestartPolicy?.Name || 'none'}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-white font-semibold mb-2 border-b border-neutral-800 pb-1">Environment Variables</h3>
                                        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800/50 font-mono text-xs overflow-x-auto whitespace-pre">
                                            {inspectData.Config?.Env?.map((env: string, i: number) => (
                                                <div key={i} className="py-0.5"><span className="text-blue-400">{env.split('=')[0]}</span>={<span className="text-emerald-400">{env.split('=').slice(1).join('=')}</span>}</div>
                                            )) || 'No environment variables'}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-white font-semibold mb-2 border-b border-neutral-800 pb-1">Mounts / Volumes</h3>
                                        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800/50 space-y-2">
                                            {inspectData.Mounts?.map((m: any, i: number) => (
                                                <div key={i} className="text-xs break-all">
                                                    <span className="text-purple-400 font-semibold">{m.Type.toUpperCase()}</span>: {m.Source} <span className="text-neutral-500">→</span> {m.Destination}
                                                </div>
                                            )) || 'No mounts'}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-white font-semibold mb-2 border-b border-neutral-800 pb-1">Network & Ports</h3>
                                        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800/50 text-xs space-y-2">
                                            {inspectData.NetworkSettings?.Ports && Object.entries(inspectData.NetworkSettings.Ports).map(([port, bindings]: any, i) => (
                                                <div key={i}>
                                                    <span className="text-amber-400">{port}</span> <span className="text-neutral-500">→</span> {bindings ? bindings.map((b: any) => `${b.HostIp}:${b.HostPort}`).join(', ') : 'Exposed only'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
