'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, Play, Square, Download, Save, RefreshCw, Terminal, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Editor from '@monaco-editor/react';

export default function SupabasePage() {
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState({ type: '', text: '', details: '' });

    const [envContent, setEnvContent] = useState('');
    const [composeContent, setComposeContent] = useState('');
    const [studioTag, setStudioTag] = useState('latest');

    const [activeTab, setActiveTab] = useState<'env' | 'compose'>('env');

    useEffect(() => {
        const fetchFiles = async () => {
            try {
                // Fetch .env
                try {
                    const resEnv = await axios.get('/api/supabase/env');
                    setEnvContent(resEnv.data.content);
                } catch (err: unknown) {
                    console.warn('Failed to load .env', err);
                    setEnvContent('// Could not load .env file. Check your Supabase Project Path in Settings.');
                }

                // Fetch docker-compose.yml
                try {
                    const resCompose = await axios.get('/api/supabase/update');
                    setComposeContent(resCompose.data.content);

                    // Try to parse studio tag
                    const content = resCompose.data.content as string;
                    const match = content.match(/image:\s*supabase\/studio:([^\s]+)/);
                    if (match && match[1]) {
                        setStudioTag(match[1]);
                    }
                } catch (err: unknown) {
                    console.warn('Failed to load docker-compose.yml', err);
                    setComposeContent('# Could not load docker-compose.yml file. Check your Supabase Project Path in Settings.');
                }
                // Removed edge functions fetcher (Moved to functions page)
            } finally {
                setIsLoading(false);
            }
        };

        fetchFiles();
    }, []);

    const showMessage = (type: 'success' | 'error', text: string, details?: string) => {
        setMessage({ type, text, details: details || '' });
        // Auto scroll to top to see message
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAction = async (action: 'up' | 'down' | 'pull') => {
        setActionLoading(action);
        setMessage({ type: '', text: '', details: '' });
        try {
            const res = await axios.post('/api/supabase/action', { action });
            if (res.data.success) {
                showMessage('success', `Docker Compose ${action.toUpperCase()} completed.`, res.data.output);
            }
        } catch (err: unknown) {
            console.error(`Action ${action} error:`, err);
            const errorResponse = err as { response?: { data?: { details?: string } }, message: string };
            showMessage('error', `Failed to execute ${action}.`, errorResponse.response?.data?.details || errorResponse.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSaveEnv = async () => {
        setActionLoading('save-env');
        try {
            const res = await axios.post('/api/supabase/env', { content: envContent });
            if (res.data.success) {
                showMessage('success', '.env file saved successfully.');
            }
        } catch (err: unknown) {
            console.error('Save env error:', err);
            const errorResponse = err as { message: string };
            showMessage('error', 'Failed to save .env file.', errorResponse.message);
        } finally {
            setActionLoading(null);
        }
    };


    const handleUpdateStudio = async () => {
        if (!studioTag) return;
        setActionLoading('update-studio');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/supabase/update', { tag: studioTag });
            if (res.data.success) {
                showMessage('success', 'Supabase components updated and restarted successfully!', res.data.output);
                // Refresh composer content to see new tag
                const resCompose = await axios.get('/api/supabase/update');
                if (resCompose.data.content) {
                    setComposeContent(resCompose.data.content);
                }
            }
        } catch (err: unknown) {
            console.error('Update studio error:', err);
            const errorResponse = err as { response?: { data?: { details?: string } }, message: string };
            showMessage('error', 'Failed to update Supabase tags.', errorResponse.response?.data?.details || errorResponse.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30">
                    <Database className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Supabase Management</h1>
                    <p className="text-neutral-400 text-sm mt-1">Control your self-hosted Supabase containers and configurations.</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                {/* Left Column: Quick Actions & Update Manager */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Quick Actions Panel */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                            <Terminal className="w-5 h-5 text-indigo-400" />
                            <h2 className="font-semibold text-white">Docker Actions</h2>
                        </div>
                        <div className="p-5 flex flex-col gap-3">
                            <button
                                onClick={() => handleAction('up')}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'up' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Start (Up -d)
                            </button>
                            <button
                                onClick={() => handleAction('down')}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'down' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                                Stop (Down)
                            </button>
                            <button
                                onClick={() => handleAction('pull')}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'pull' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Pull Latest
                            </button>
                        </div>
                    </div>

                    {/* Image Updater Manager */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-emerald-400" />
                            <h2 className="font-semibold text-white">Image Update</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-neutral-400 block">Supabase Studio Tag (e.g. 2025.11.26-sha-8f0...)</label>
                                <input
                                    type="text"
                                    value={studioTag}
                                    onChange={(e) => setStudioTag(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
                                    placeholder="studio tag"
                                />
                            </div>
                            <button
                                onClick={handleUpdateStudio}
                                disabled={actionLoading !== null || !studioTag}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'update-studio' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                Update & Restart
                            </button>
                        </div>
                    </div>


                </div>

                {/* Right Column: Environment Editor */}
                <div className="lg:col-span-3">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl h-full flex flex-col overflow-hidden min-h-[600px]">

                        {/* Editor Tabs & Controls */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveTab('env')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'env' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
                                >
                                    .env
                                </button>
                                <button
                                    onClick={() => setActiveTab('compose')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'compose' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
                                >
                                    docker-compose.yml
                                </button>
                            </div>

                            {activeTab === 'env' && (
                                <button
                                    onClick={handleSaveEnv}
                                    disabled={actionLoading !== null}
                                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-black bg-white hover:bg-neutral-200 rounded-md transition-all disabled:opacity-50"
                                >
                                    {actionLoading === 'save-env' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Save .env
                                </button>
                            )}
                            {activeTab === 'compose' && (
                                <span className="text-xs text-neutral-500 font-medium px-2">Read-only (Use updater on left)</span>
                            )}
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 bg-black">
                            {activeTab === 'env' ? (
                                <Editor
                                    height="100%"
                                    theme="vs-dark"
                                    path="supabase.env"
                                    defaultLanguage="shell"
                                    value={envContent}
                                    onChange={(val) => setEnvContent(val || '')}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        wordWrap: 'on',
                                        padding: { top: 16 }
                                    }}
                                />
                            ) : (
                                <Editor
                                    height="100%"
                                    theme="vs-dark"
                                    path="docker-compose.yml"
                                    defaultLanguage="yaml"
                                    value={composeContent}
                                    options={{
                                        readOnly: true,
                                        minimap: { enabled: false },
                                        fontSize: 14,
                                        wordWrap: 'on',
                                        padding: { top: 16 }
                                    }}
                                />
                            )}
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}
