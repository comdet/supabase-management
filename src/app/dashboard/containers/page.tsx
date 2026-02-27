'use client';

import { useState, useEffect } from 'react';
import { Play, Square, RotateCw, ServerCrash, CheckCircle2, Clock, Terminal } from 'lucide-react';

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
        </div>
    );
}
