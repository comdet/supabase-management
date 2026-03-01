'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Server, Box, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';

type PortInfo = {
    port: string;
    proto: string;
    localAddress: string;
};

type DockerPortInfo = {
    container: string;
    privatePort: number;
    publicPort: number;
    type: string;
    ip: string;
};

type NetworkData = {
    host: PortInfo[];
    docker: DockerPortInfo[];
    firewall: string;
};

export default function NetworkMonitorPage() {
    const [data, setData] = useState<NetworkData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchPorts = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/network');
            if (!res.ok) throw new Error('Failed to fetch port data');
            const json = await res.json();

            // Format and deduplicate host ports
            const uniqueHost = json.host?.filter((p: PortInfo, index: number, self: PortInfo[]) =>
                index === self.findIndex(t => t.port === p.port && t.proto === p.proto)
            ) || [];

            setData({ host: uniqueHost, docker: json.docker || [], firewall: json.firewall || 'Unknown Firewall Status' });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPorts();
    }, []);

    // Check if a host port is actually a Docker exposed port
    const isDockerPort = (portStr: string) => {
        if (!data) return false;
        const portNum = parseInt(portStr, 10);
        return data.docker.some(d => d.publicPort === portNum);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" /> Network & Firewall Monitor
                    </h1>
                    <p className="text-neutral-400 text-sm mt-1">Review currently exposed ports and listening services on your server to ensure security.</p>
                </div>
                <button
                    onClick={fetchPorts}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span className="break-all">{error}</span>
                </div>
            )}

            {/* Firewall Status */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-5 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">System Firewall Status</h2>
                            <p className="text-xs text-neutral-400">Current active rules and global state</p>
                        </div>
                    </div>
                </div>
                <div className="p-5 bg-black">
                    {loading && !data ? (
                        <div className="text-neutral-500 flex items-center gap-2 text-sm justify-center py-4">
                            <RefreshCw className="w-5 h-5 animate-spin" /> Querying firewall rules...
                        </div>
                    ) : (
                        <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-auto">
                            {data?.firewall || 'No firewall information returned.'}
                        </pre>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Host Listening Ports */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Server className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Host Listening Ports</h2>
                            <p className="text-xs text-neutral-400">Services listening directly on the OS</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto max-h-[500px]">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-neutral-950/90 backdrop-blur-sm z-10 border-b border-neutral-800">
                                <tr className="text-neutral-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3 font-medium">Port</th>
                                    <th className="px-5 py-3 font-medium">Protocol</th>
                                    <th className="px-5 py-3 font-medium text-right">Owner</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {loading && !data ? (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-8 text-center text-neutral-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-600" />
                                            Scanning host ports...
                                        </td>
                                    </tr>
                                ) : data?.host.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-8 text-center text-neutral-500">
                                            No listening ports detected
                                        </td>
                                    </tr>
                                ) : (
                                    data?.host.map((item, i) => {
                                        const isDocker = isDockerPort(item.port);
                                        return (
                                            <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                                                <td className="px-5 py-3">
                                                    <span className="text-emerald-400 font-mono text-sm bg-emerald-400/10 px-2 py-1 rounded">
                                                        {item.port}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className="text-neutral-300 text-sm uppercase">{item.proto}</span>
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    {isDocker ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                                                            <Box className="w-3 h-3" /> Docker Service
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400 bg-neutral-800 px-2 py-1 rounded-full">
                                                            <Server className="w-3 h-3" /> Host Service
                                                        </span>
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

                {/* Docker Exposed Ports */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Box className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Docker Exposed Ports</h2>
                            <p className="text-xs text-neutral-400">Container ports mapped to the public</p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto max-h-[500px]">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-neutral-950/90 backdrop-blur-sm z-10 border-b border-neutral-800">
                                <tr className="text-neutral-400 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3 font-medium">Container</th>
                                    <th className="px-5 py-3 font-medium">Mapping</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800/50">
                                {loading && !data ? (
                                    <tr>
                                        <td colSpan={2} className="px-5 py-8 text-center text-neutral-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-neutral-600" />
                                            Scanning docker ports...
                                        </td>
                                    </tr>
                                ) : data?.docker.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="px-5 py-8 text-center text-neutral-500">
                                            No containers are exposing ports
                                        </td>
                                    </tr>
                                ) : (
                                    data?.docker.map((item, i) => (
                                        <tr key={i} className="hover:bg-neutral-800/30 transition-colors">
                                            <td className="px-5 py-3 text-sm text-neutral-200 font-medium">
                                                {item.container}
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2 text-sm font-mono">
                                                    <span className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                                        {item.ip}:{item.publicPort}
                                                    </span>
                                                    <ArrowRight className="w-3 h-3 text-neutral-500" />
                                                    <span className="text-neutral-400">
                                                        {item.privatePort}/{item.type}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4 text-sm mt-6">
                <div className="mt-0.5">
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-blue-200 leading-relaxed">
                    <p className="font-medium text-blue-300 mb-1">Security Recommendation:</p>
                    <p className="opacity-80">
                        Ensure that you only expose necessary ports to the public internet (e.g., 80, 443). Database ports (like 5432) or internal services should ideally be bound to 127.0.0.1 (localhost) or kept behind a firewall unless you intend to access them externally. If you see unexpected ports in the Host Listening List, investigate the server processes.
                    </p>
                </div>
            </div>
        </div>
    );
}
