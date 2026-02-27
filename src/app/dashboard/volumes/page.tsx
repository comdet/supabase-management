'use client';

import { useState, useEffect } from 'react';
import { HardDrive, RefreshCw, ServerCrash, FolderOpen } from 'lucide-react';
import Link from 'next/link';

type Volume = {
    Name: string;
    Driver: string;
    Mountpoint: string;
    CreatedAt?: string;
};

export default function VolumesPage() {
    const [volumes, setVolumes] = useState<Volume[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchVolumes = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/docker/volumes');
            if (!res.ok) throw new Error('Failed to fetch volumes');
            const data = await res.json();
            setVolumes(data.volumes);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVolumes();
    }, []);

    if (loading && volumes.length === 0) {
        return <div className="text-neutral-400 flex items-center gap-2"><RefreshCw className="animate-spin w-4 h-4" /> Loading volumes...</div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-6 h-6 text-blue-500" /> Docker Volumes
                </h1>
                <button onClick={fetchVolumes} disabled={loading} className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg mb-6 flex items-center gap-2">
                    <ServerCrash className="w-5 h-5" /> {error}
                </div>
            )}

            <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400 text-sm">
                            <th className="p-4 font-medium">Name</th>
                            <th className="p-4 font-medium">Driver</th>
                            <th className="p-4 font-medium">Mountpoint</th>
                            <th className="p-4 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800">
                        {volumes.map((v) => (
                            <tr key={v.Name} className="hover:bg-neutral-800/50 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-neutral-200">{v.Name}</div>
                                </td>
                                <td className="p-4 text-sm text-neutral-400">{v.Driver}</td>
                                <td className="p-4 text-xs text-neutral-500 truncate max-w-xs">{v.Mountpoint}</td>
                                <td className="p-4 text-right">
                                    <Link
                                        href={`/dashboard/volumes/${v.Name}`}
                                        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 rounded-md transition-colors"
                                    >
                                        <FolderOpen className="w-4 h-4" /> Browse
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {volumes.length === 0 && !loading && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-neutral-500">
                                    No volumes found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
