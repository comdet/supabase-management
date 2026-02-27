'use client';

import { useState, useEffect } from 'react';
import { Clock, RefreshCw, AlertTriangle, Plus, X, Save } from 'lucide-react';

type currDataShape = {
    pm2: any[];
    cron: string[];
    cronSecret?: string;
}

export default function CronJobsPage() {
    const [data, setData] = useState<currDataShape | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Add Cron Form State
    const [showAddForm, setShowAddForm] = useState(false);
    const [newSchedule, setNewSchedule] = useState('* * * * *');
    const [newCommand, setNewCommand] = useState('');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState('');

    // Backup Templates
    const applyTemplate = (type: 'db_backup' | 'storage_backup' | 'custom') => {
        if (type === 'custom') {
            setNewCommand('');
            return;
        }

        // Example local curl command to trigger backend API (you might need PM2 port instead of 3000 depending on env)
        const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
        const apiKey = data?.cronSecret || 'YOUR_CRON_SECRET';

        if (type === 'db_backup') {
            setNewCommand(`curl -X POST ${hostUrl}/api/backup -H "Content-Type: application/json" -H "x-api-key: ${apiKey}" -d '{"type":"database","containerName":"supabase-db"}'`);
        } else if (type === 'storage_backup') {
            // For example, if the default volume name is known, adjust it here.
            setNewCommand(`curl -X POST ${hostUrl}/api/backup -H "Content-Type: application/json" -H "x-api-key: ${apiKey}" -d '{"type":"volume","volumeName":"supabase-storage"}'`);
        }
    };

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
    }, []);

    const handleAddCron = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');
        setAdding(true);

        try {
            const res = await fetch('/api/system/cron', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ schedule: newSchedule, command: newCommand }),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to add cron job');

            // Success
            setNewCommand('');
            setNewSchedule('* * * * *');
            setShowAddForm(false);
            fetchSystemData(); // Refresh the list
        } catch (err: any) {
            setAddError(err.message);
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-6 h-6 text-pink-500" /> Cron Jobs
                    </h1>
                    <p className="text-neutral-400 text-sm mt-1">Review and manage automated scheduled tasks on the OS level.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-3 py-1.5 text-sm bg-pink-600 hover:bg-pink-700 text-white rounded-md transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {showAddForm ? 'Cancel' : 'Add Task'}
                    </button>
                    <button
                        onClick={fetchSystemData}
                        disabled={loading}
                        className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2 mb-6">
                    <AlertTriangle className="w-5 h-5" /> {error}
                </div>
            )}

            {showAddForm && (
                <div className="bg-neutral-900 border border-pink-500/30 rounded-xl p-6 shadow-sm mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-pink-500" /> Create New Cron Job
                    </h2>

                    {addError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg flex items-center gap-2 mb-4 text-sm">
                            <AlertTriangle className="w-4 h-4" /> {addError}
                        </div>
                    )}

                    <form onSubmit={handleAddCron} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="md:col-span-1 border border-neutral-800 rounded-lg p-3 bg-neutral-950">
                                <label className="block text-xs text-neutral-400 mb-1 uppercase tracking-wider font-semibold">Schedule Expression</label>
                                <input
                                    type="text"
                                    className="w-full bg-transparent text-white border-0 p-0 focus:ring-0 font-mono text-sm placeholder:text-neutral-600"
                                    value={newSchedule}
                                    onChange={(e) => setNewSchedule(e.target.value)}
                                    placeholder="* * * * *"
                                    required
                                />
                                <div className="text-[10px] text-neutral-500 mt-2 flex gap-1 flex-wrap">
                                    <button type="button" onClick={() => setNewSchedule('* * * * *')} className="hover:text-pink-400">min</button>
                                    <button type="button" onClick={() => setNewSchedule('0 * * * *')} className="hover:text-pink-400">hour</button>
                                    <button type="button" onClick={() => setNewSchedule('0 0 * * *')} className="hover:text-pink-400">daily</button>
                                    <button type="button" onClick={() => setNewSchedule('0 0 * * 0')} className="hover:text-pink-400 font-bold">weekly</button>
                                </div>
                            </div>

                            <div className="md:col-span-3 border border-neutral-800 rounded-lg p-3 bg-neutral-950 flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="block text-xs text-neutral-400 uppercase tracking-wider font-semibold">Shell Command</label>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => applyTemplate('db_backup')} className="text-[10px] text-emerald-400 hover:text-emerald-300">Template: DB Backup</button>
                                            <button type="button" onClick={() => applyTemplate('storage_backup')} className="text-[10px] text-amber-400 hover:text-amber-300">Template: Storage Backup</button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full bg-transparent text-white border-0 p-0 mb-1 focus:ring-0 font-mono text-sm placeholder:text-neutral-600"
                                        value={newCommand}
                                        onChange={(e) => setNewCommand(e.target.value)}
                                        placeholder="docker exec supabase-db pg_dump..."
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-neutral-500">The exact bash command that the OS will execute.</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAddForm(false)}
                                className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={adding || !newSchedule || !newCommand}
                                className="px-5 py-2 text-sm bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white rounded-md transition-colors flex items-center gap-2 font-medium"
                            >
                                {adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {adding ? 'Saving...' : 'Save Job'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
                <div className="flex-1 overflow-auto p-6">
                    {loading && !data ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 mt-12">
                            <RefreshCw className="w-8 h-8 animate-spin text-neutral-600 mb-4" />
                            Reading crontab...
                        </div>
                    ) : data?.cron.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 mt-12">
                            <Clock className="w-12 h-12 text-neutral-700 mb-4" />
                            <p className="text-lg">No cron jobs configured</p>
                            <p className="text-sm mt-2">There are no scheduled tasks for the current user.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data?.cron.map((job, idx) => {
                                // Make a simple split to separate time expression from the actual command
                                // Typically a cron job is separated by spaces: "* * * * * command"
                                const parts = job.split(/\s+/);
                                const schedule = parts.slice(0, 5).join(' ');
                                const command = parts.slice(5).join(' ');

                                return (
                                    <div key={idx} className="bg-neutral-950 border border-neutral-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center gap-4 relative group hover:border-pink-500/30 transition-colors">
                                        <div className="flex items-center gap-3 min-w-[180px]">
                                            <div className="bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono text-sm px-3 py-1.5 rounded-md font-bold tracking-widest text-center shadow-inner">
                                                {schedule}
                                            </div>
                                        </div>
                                        <div className="font-mono text-sm text-neutral-300 break-all bg-neutral-900/50 p-3 rounded-lg flex-1 border border-neutral-800/50 shadow-inner">
                                            <span className="text-pink-500/50 mr-2 select-none">$</span>{command || job}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
