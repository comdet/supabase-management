'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw, Terminal } from 'lucide-react';

export default function ContainerLogsPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;

    const [logs, setLogs] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const logsEndRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/docker/containers/${id}/logs?tail=200`);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to fetch logs');
            }
            const data = await res.json();
            setLogs(data.logs);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchLogs();
        }
    }, [id]);

    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard/containers')}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Terminal className="w-6 h-6 text-blue-500" />
                            Container Logs
                        </h1>
                        <p className="text-sm text-neutral-400">ID: {id}</p>
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Latest
                </button>
            </div>

            {error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg">
                    {error}
                </div>
            ) : (
                <div className="flex-1 bg-black rounded-xl border border-neutral-800 p-4 font-mono text-sm overflow-y-auto text-green-400">
                    <pre className="whitespace-pre-wrap whitespace-break-spaces">
                        {logs || (loading ? 'Loading logs...' : 'No logs available for this container.')}
                        <div ref={logsEndRef} />
                    </pre>
                </div>
            )}
        </div>
    );
}
