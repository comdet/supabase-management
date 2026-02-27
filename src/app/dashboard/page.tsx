'use client';

import { useState, useEffect } from 'react';
import { Activity, Box, Database, HardDrive, Server, ShieldCheck, FileCode2, ArrowRight, Save, PlayCircle, Archive, Clock, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

type DashboardStats = {
    containers: { total: number; running: number };
    volumes: number;
    backups: { total: number; size: number };
    pm2: { total: number; online: number; errored: number };
    network: { totalPorts: number; externalPorts: number };
    cron: { total: number };
    system?: {
        cpu: { usagePercent: number, cores: number, model: string };
        memory: { total: number, used: number, usagePercent: number };
        disk: { total: number, used: number, usagePercent: number };
        uptime: number;
    };
};

export default function DashboardPage() {
    const [stats, setStats] = useState<DashboardStats>({
        containers: { total: 0, running: 0 },
        volumes: 0,
        backups: { total: 0, size: 0 },
        pm2: { total: 0, online: 0, errored: 0 },
        network: { totalPorts: 0, externalPorts: 0 },
        cron: { total: 0 }
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [containersRes, volumesRes, backupsRes, sysRes, netRes, sysResDataRes] = await Promise.all([
                    fetch('/api/docker/containers'),
                    fetch('/api/docker/volumes'),
                    fetch('/api/backup'),
                    fetch('/api/system'),
                    fetch('/api/network'),
                    fetch('/api/system/resources')
                ]);

                const [cData, vData, bData, sysData, netData, sysResDataParsed] = await Promise.all([
                    containersRes.json(),
                    volumesRes.json(),
                    backupsRes.json(),
                    sysRes.json(),
                    netRes.json(),
                    sysResDataRes.json()
                ]);

                const totalContainers = cData.containers?.length || 0;
                const runningContainers = cData.containers?.filter((c: any) => c.state === 'running').length || 0;

                const totalVolumes = vData.volumes?.length || 0;

                const backupsList = bData.backups || [];
                const totalBackups = backupsList.length;
                const backupSize = backupsList.reduce((acc: number, curr: any) => acc + curr.size, 0);

                const pm2Total = sysData.pm2?.length || 0;
                const pm2Online = sysData.pm2?.filter((p: any) => p.status === 'online').length || 0;
                const pm2Errored = sysData.pm2?.filter((p: any) => p.status === 'errored' || p.status === 'stopped' || p.status === 'stopping').length || 0;

                const cronTotal = sysData.cron?.length || 0;

                const totalPorts = netData.host?.length || 0;
                const externalPorts = netData.host?.filter((p: any) => p.localAddress === '*' || p.localAddress === '0.0.0.0' || p.localAddress === '::').length || 0;

                setStats({
                    containers: { total: totalContainers, running: runningContainers },
                    volumes: totalVolumes,
                    backups: { total: totalBackups, size: backupSize },
                    pm2: { total: pm2Total, online: pm2Online, errored: pm2Errored },
                    network: { totalPorts: totalPorts, externalPorts: externalPorts },
                    cron: { total: cronTotal },
                    system: sysResDataParsed.error ? undefined : sysResDataParsed
                });
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Hero Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900/40 via-neutral-900 to-neutral-950 border border-neutral-800 p-8">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                    <Server className="w-64 h-64 text-blue-500 transform rotate-12" />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
                            <ShieldCheck className="w-6 h-6 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Supabase Control Center</h1>
                    </div>
                    <p className="text-neutral-400 max-w-xl text-lg mt-4">
                        Manage your self-hosted Supabase infrastructure efficiently. Monitor containers, browse volumes, and manage system backups from one unified dashboard.
                    </p>
                </div>
            </div>

            {/* System Resources Overview (Phase 14 Redesign) */}
            {stats.system && (
                <div>
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Host OS Resources
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* CPU Usage Radial */}
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-lg relative overflow-hidden group flex flex-col items-center justify-center">
                            <h3 className="text-sm font-medium text-neutral-400 absolute top-6 left-6">CPU Usage</h3>
                            <div className="w-40 h-40 mt-4 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={8} data={[{ name: 'CPU', value: stats.system.cpu.usagePercent, fill: '#3b82f6' }]} startAngle={225} endAngle={-45}>
                                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                        <RadialBar background={{ fill: '#1f2937' }} dataKey="value" cornerRadius={10} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-white tracking-tighter">{stats.system.cpu.usagePercent.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 text-center">
                                {stats.system.cpu.cores} Cores &bull; <span title={stats.system.cpu.model}>{stats.system.cpu.model?.substring(0, 25)}...</span>
                            </div>
                        </div>

                        {/* RAM Usage Radial */}
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-lg relative overflow-hidden group flex flex-col items-center justify-center">
                            <h3 className="text-sm font-medium text-neutral-400 absolute top-6 left-6">Memory (RAM)</h3>
                            <div className="w-40 h-40 mt-4 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={8} data={[{ name: 'RAM', value: stats.system.memory.usagePercent, fill: stats.system.memory.usagePercent > 80 ? '#ef4444' : '#10b981' }]} startAngle={225} endAngle={-45}>
                                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                        <RadialBar background={{ fill: '#1f2937' }} dataKey="value" cornerRadius={10} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-white tracking-tighter">{stats.system.memory.usagePercent.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 text-center">
                                {formatSize(stats.system.memory.used)} / {formatSize(stats.system.memory.total)}
                            </div>
                        </div>

                        {/* Disk Usage Radial */}
                        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-lg relative overflow-hidden group flex flex-col items-center justify-center">
                            <h3 className="text-sm font-medium text-neutral-400 absolute top-6 left-6">Disk Space (/)</h3>
                            <div className="w-40 h-40 mt-4 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadialBarChart cx="50%" cy="50%" innerRadius="75%" outerRadius="100%" barSize={8} data={[{ name: 'Disk', value: stats.system.disk.usagePercent, fill: stats.system.disk.usagePercent > 85 ? '#ef4444' : '#a855f7' }]} startAngle={225} endAngle={-45}>
                                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                                        <RadialBar background={{ fill: '#1f2937' }} dataKey="value" cornerRadius={10} />
                                    </RadialBarChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-3xl font-bold text-white tracking-tighter">{stats.system.disk.usagePercent.toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="mt-2 text-xs text-neutral-500 text-center">
                                {formatSize(stats.system.disk.used)} / {formatSize(stats.system.disk.total)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Application Services Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                {/* Containers */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
                            <Box className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">Docker Containers</h3>
                    <div className="mt-2 text-2xl font-bold text-white">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-20 inline-block">0</span> : (
                            <div className="flex items-baseline gap-2">
                                <span>{stats.containers.running} <span className="text-sm font-normal text-blue-400">Running</span></span>
                                <span className="text-sm text-neutral-500 ml-2">/ {stats.containers.total} Total</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* PM2 Services */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                            <Activity className="w-6 h-6" />
                        </div>
                        {!loading && stats.pm2.errored > 0 && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-md border border-red-500/20">
                                {stats.pm2.errored} Errored
                            </span>
                        )}
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">PM2 Background Services</h3>
                    <div className="mt-2 text-2xl font-bold text-white flex items-baseline justify-between">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-20 inline-block">0</span> : (
                            <div className="flex items-baseline gap-2">
                                <span>{stats.pm2.online} <span className="text-sm font-normal text-emerald-500">Online</span></span>
                                <span className="text-sm text-neutral-500 ml-2">/ {stats.pm2.total} Total</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Network Ports */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-cyan-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">Network Exposure (Ports)</h3>
                    <div className="mt-2 text-2xl font-bold text-white flex items-baseline justify-between">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-20 inline-block">0</span> : (
                            <div className="flex items-baseline gap-2">
                                <span>{stats.network.externalPorts} <span className="text-sm font-normal text-cyan-400">Public</span></span>
                                <span className="text-sm text-neutral-500 ml-2">/ {stats.network.totalPorts} Listening</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Cron Jobs */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-pink-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-pink-500/10 rounded-xl text-pink-500">
                            <Clock className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">Scheduled Actions (Cron)</h3>
                    <div className="mt-2 text-2xl font-bold text-white">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-16 inline-block">0</span> : (
                            <span>{stats.cron.total} <span className="text-sm font-normal text-pink-400">Active Jobs</span></span>
                        )}
                    </div>
                </div>

                {/* Volumes */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                            <Database className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">Mounted Local Volumes</h3>
                    <div className="mt-2 text-2xl font-bold text-white">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-16 inline-block">0</span> : (
                            <span>{stats.volumes} <span className="text-sm font-normal text-purple-400">Volumes</span></span>
                        )}
                    </div>
                </div>

                {/* Backups */}
                <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-xl p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/50 transition-colors">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
                            <Archive className="w-6 h-6" />
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-400">Total Backups</h3>
                    <div className="mt-2 text-2xl font-bold text-white flex items-baseline justify-between">
                        {loading ? <span className="animate-pulse bg-neutral-800 text-transparent rounded w-24 inline-block">0</span> : (
                            <div className="flex items-baseline gap-2 w-full justify-between pr-2">
                                <span>{stats.backups.total}</span>
                                <span className="text-sm text-amber-500/70 font-normal">{formatSize(stats.backups.size)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-bold text-white mb-6">Quick Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/dashboard/shell" className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-neutral-800 rounded-lg group-hover:text-pink-400 transition-colors">
                                <TerminalSquare className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-neutral-200">Host OS Terminal</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
                    </Link>

                    <Link href="/dashboard/cron" className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-neutral-800 rounded-lg group-hover:text-emerald-400 transition-colors">
                                <Clock className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-neutral-200">Schedule Actions</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                    </Link>

                    <Link href="/dashboard/network" className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-neutral-800 rounded-lg group-hover:text-cyan-400 transition-colors">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-neutral-200">Port Exposure</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                    </Link>

                    <Link href="/dashboard/backup" className="flex items-center justify-between p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-neutral-800 rounded-lg group-hover:text-amber-400 transition-colors">
                                <Save className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-neutral-200">System Backup</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                    </Link>
                </div>
            </div>
        </div>
    )
}
