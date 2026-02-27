'use client';

import { LogOut, LayoutDashboard, Server, Database, Save, HardDrive, ShieldCheck, Activity, Clock, TerminalSquare, FolderHeart, Settings } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const navGroups = [
        {
            title: 'Overview',
            items: [
                { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            ]
        },
        {
            title: 'Docker Management',
            items: [
                { name: 'Containers', href: '/dashboard/containers', icon: Server },
                { name: 'Volumes', href: '/dashboard/volumes', icon: HardDrive },
                { name: 'Backup', href: '/dashboard/backup', icon: Save },
            ]
        },
        {
            title: 'System & Security',
            items: [
                { name: 'File Manager', href: '/dashboard/files', icon: FolderHeart },
                { name: 'Terminal Server', href: '/dashboard/shell', icon: TerminalSquare },
                { name: 'Network Monitor', href: '/dashboard/network', icon: ShieldCheck },
                { name: 'PM2 Monitor', href: '/dashboard/pm2', icon: Activity },
                { name: 'Settings', href: '/dashboard/settings', icon: Settings },
            ]
        },
        {
            title: 'Automation',
            items: [
                { name: 'Cron Jobs', href: '/dashboard/cron', icon: Clock },
            ]
        }
    ];

    return (
        <div className="flex h-screen bg-neutral-950 text-white font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-neutral-900 border-r border-neutral-800 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-neutral-800">
                    <Database className="w-6 h-6 text-blue-500 mr-2" />
                    <h1 className="text-xl font-bold tracking-tight text-white">Supabase Admin</h1>
                </div>
                <nav className="flex-1 py-4 overflow-y-auto w-full relative">
                    <div className="px-3 space-y-6 w-full">
                        {navGroups.map((group) => (
                            <div key={group.title} className="w-full">
                                {group.title !== 'Overview' && (
                                    <h3 className="px-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                        {group.title}
                                    </h3>
                                )}
                                <div className="space-y-1 w-full">
                                    {group.items.map((item) => {
                                        const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/dashboard');
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`
                                                  flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors w-full
                                                  ${isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}
                                                `}
                                            >
                                                <item.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-neutral-500'}`} />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>
                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center px-3 py-2.5 rounded-md text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                        <LogOut className="mr-3 h-5 w-5 text-neutral-500" />
                        Sign out
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-neutral-950">
                <main className="p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
