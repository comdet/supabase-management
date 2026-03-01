'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Zap, Download, Loader2, AlertCircle, CheckCircle2, Github } from 'lucide-react';

interface ReleaseAsset {
    id: number | string;
    name: string;
    url: string;
}

interface Release {
    id: number | string;
    name: string;
    tag_name: string;
    published_at: string;
    assets: ReleaseAsset[];
}

export default function EdgeFunctionsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState({ type: '', text: '', details: '' });

    const [releases, setReleases] = useState<Release[]>([]);
    const [selectedAssetUrl, setSelectedAssetUrl] = useState('');
    const [functionsRepo, setFunctionsRepo] = useState('');

    useEffect(() => {
        const fetchReleases = async () => {
            try {
                const resFunc = await axios.get('/api/supabase/functions/deploy');
                setReleases(resFunc.data.releases || []);
                setFunctionsRepo(resFunc.data.repo || '');

                if (resFunc.data.releases?.length > 0) {
                    const firstRelease = resFunc.data.releases[0];
                    if (firstRelease.assets?.length > 0) {
                        // Prioritize functions.zip as per README guide
                        const funcAsset = firstRelease.assets.find((a: any) => a.name === 'functions.zip' || a.name.endsWith('.zip'));
                        setSelectedAssetUrl(funcAsset ? funcAsset.url : firstRelease.assets[0].url);
                    }
                }
            } catch (err: unknown) {
                console.warn('Failed to load edge functions releases', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReleases();
    }, []);

    const showMessage = (type: 'success' | 'error', text: string, details?: string) => {
        setMessage({ type, text, details: details || '' });
    };

    const handleDeployFunctions = async () => {
        if (!selectedAssetUrl) return;
        setActionLoading('deploy-functions');
        setMessage({ type: '', text: '', details: '' });

        try {
            const res = await axios.post('/api/supabase/functions/deploy', { assetUrl: selectedAssetUrl });
            if (res.data.success) {
                showMessage('success', 'Edge Functions deployed successfully!', res.data.message);
            }
        } catch (err: unknown) {
            console.error('Deploy functions error:', err);
            const errorResponse = err as { response?: { data?: { error?: string } }, message: string };
            showMessage('error', 'Failed to deploy Edge Functions.', errorResponse.response?.data?.error || errorResponse.message);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-amber-500/20 p-2 rounded-lg border border-amber-500/30">
                    <Zap className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Edge Functions Deployment</h1>
                    <p className="text-neutral-400 text-sm mt-1">Deploy compiled Supabase functions directly from your GitHub private repository.</p>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Deployer Widget */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2">
                            <Download className="w-5 h-5 text-amber-400" />
                            <h2 className="font-semibold text-white">Select Release</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            {isLoading ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                                </div>
                            ) : functionsRepo ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-neutral-400 block break-all">Repository: {functionsRepo}</label>
                                        <select
                                            value={selectedAssetUrl}
                                            onChange={(e) => setSelectedAssetUrl(e.target.value)}
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                                        >
                                            <option value="">-- Choose an Artifact --</option>
                                            {releases.map((release) => (
                                                <optgroup key={release.id} label={`${release.name || release.tag_name} (${new Date(release.published_at).toLocaleDateString()})`}>
                                                    {release.assets && Array.isArray(release.assets) && release.assets
                                                        .filter((asset) => asset.name.endsWith('.zip')) // Only allow Zip files for functions
                                                        .map((asset) => (
                                                            <option key={asset.id} value={asset.url}>
                                                                {asset.name}
                                                            </option>
                                                        ))}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleDeployFunctions}
                                        disabled={actionLoading !== null || !selectedAssetUrl}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-950 bg-amber-500 hover:bg-amber-400 border border-amber-400/50 rounded-xl transition-all shadow-lg shadow-amber-500/10 disabled:opacity-50"
                                    >
                                        {actionLoading === 'deploy-functions' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                        Deploy to Runtime
                                    </button>
                                </>
                            ) : (
                                <div className="text-sm text-neutral-500 text-center py-4 bg-neutral-950 rounded-lg">
                                    <AlertCircle className="w-5 h-5 mx-auto mb-2 opacity-50" />
                                    No GitHub repository configured.<br />
                                    Go to <strong>Settings</strong> to configure.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
                            <Github className="w-5 h-5 text-neutral-300" />
                            How to Prepare Edge Functions
                        </h2>

                        <div className="space-y-4 text-sm text-neutral-300 leading-relaxed">
                            <p>
                                The Supabase Edge Functions Deployer uses an <strong>Artifact-based deployment strategy</strong>.
                                Instead of uploading thousands of TypeScript files or entire project structures, your CI/CD pipeline should compile your functions into a single zip file (e.g., <code>functions.zip</code>) containing only the necessary code and Deno binaries.
                            </p>

                            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3">
                                <strong>1. System Architecture</strong>
                                <p className="text-neutral-400">
                                    This dashboard does not run standard <code>supabase functions deploy</code> commands because doing so inside an isolated Docker container is unstable. Instead, when you click Deploy, this system fetches your artifact via the GitHub API, unzips it directly into your host OS <code>volumes/functions</code> folder, and forcibly restarts the <code>edge-runtime</code> container to instantly apply the new functions.
                                </p>
                            </div>

                            <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-lg space-y-3">
                                <strong>2. GitHub Setup Guide</strong>
                                <ol className="list-decimal list-inside space-y-2 text-neutral-400 marker:text-amber-500">
                                    <li>Navigate to <strong>System Settings</strong> and configure your target Repository Path (owner/repo) and a Personal Access Token (PAT).</li>
                                    <li>Inside your repository, create a GitHub action that runs whenever you release a new version.</li>
                                    <li>In the Action, compile your standard Supabase <code>supabase/functions</code> folder into a zip file.</li>
                                    <li>Attach the generated <code>functions.zip</code> as a binary asset to the GitHub Release.</li>
                                    <li>Once the Release is published, it will securely appear here in the dashboard instantly.</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
