'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Shield, ShieldCheck, RefreshCw, Loader2, CheckCircle2, XCircle, Zap, Settings2 } from 'lucide-react';

interface TableGrants {
    name: string;
    service_role: { select: boolean; insert: boolean; update: boolean; delete: boolean };
    authenticated: { select: boolean; insert: boolean; update: boolean; delete: boolean };
    anon: { select: boolean; insert: boolean; update: boolean; delete: boolean };
}

type RoleName = 'service_role' | 'authenticated' | 'anon';
type PrivilegeName = 'select' | 'insert' | 'update' | 'delete';

const ROLE_LABELS: Record<RoleName, { label: string; color: string }> = {
    service_role: { label: 'service_role', color: 'text-purple-400' },
    authenticated: { label: 'authenticated', color: 'text-blue-400' },
    anon: { label: 'anon', color: 'text-amber-400' },
};

const PRIV_LABELS: Record<PrivilegeName, string> = {
    select: 'S',
    insert: 'I',
    update: 'U',
    delete: 'D',
};

export default function DatabaseGrantsPage() {
    const [tables, setTables] = useState<TableGrants[]>([]);
    const [hasDefaultPrivileges, setHasDefaultPrivileges] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [message, setMessage] = useState({ type: '', text: '', details: '' });

    const showMessage = (type: 'success' | 'error', text: string, details?: string) => {
        setMessage({ type, text, details: details || '' });
        if (type === 'success') setTimeout(() => setMessage({ type: '', text: '', details: '' }), 4000);
    };

    const fetchGrants = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await axios.get('/api/database/grants');
            setTables(res.data.tables || []);
            setHasDefaultPrivileges(res.data.hasDefaultPrivileges || false);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message: string };
            showMessage('error', 'Failed to load grants.', error.response?.data?.error || error.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchGrants(); }, [fetchGrants]);

    const handleGrantAllServiceRole = async () => {
        setActionLoading('grant_all');
        try {
            await axios.post('/api/database/grants', { action: 'grant_all_service_role' });
            showMessage('success', 'Granted ALL privileges to service_role on all tables.');
            await fetchGrants();
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message: string };
            showMessage('error', 'Failed to grant.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSetupDefaultPrivileges = async () => {
        setActionLoading('default_priv');
        try {
            await axios.post('/api/database/grants', { action: 'setup_default_privileges' });
            showMessage('success', 'Default privileges configured. New tables will auto-grant to service_role.');
            setHasDefaultPrivileges(true);
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message: string };
            showMessage('error', 'Failed.', error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const togglePrivilege = async (table: string, role: RoleName, privilege: PrivilegeName, currentValue: boolean) => {
        const key = `${table}.${role}.${privilege}`;
        setActionLoading(key);
        try {
            await axios.post('/api/database/grants', {
                action: currentValue ? 'revoke_table' : 'grant_table',
                table,
                role,
                privilege: privilege.toUpperCase(),
            });

            // Optimistic update
            setTables(prev =>
                prev.map(t => {
                    if (t.name !== table) return t;
                    return {
                        ...t,
                        [role]: { ...t[role], [privilege]: !currentValue },
                    };
                })
            );
        } catch (err: unknown) {
            const error = err as { response?: { data?: { error?: string } }; message: string };
            showMessage('error', `Failed to ${currentValue ? 'revoke' : 'grant'} ${privilege} on ${table}.`, error.response?.data?.error || error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const allServiceRoleGranted = tables.length > 0 && tables.every(t =>
        t.service_role.select && t.service_role.insert && t.service_role.update && t.service_role.delete
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-purple-400" />
                    <div>
                        <h1 className="text-2xl font-bold text-white">Database Grants</h1>
                        <p className="text-sm text-neutral-400">Manage table-level permissions for PostgreSQL roles</p>
                    </div>
                </div>
                <button
                    onClick={fetchGrants}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Message Alert */}
            {message.text && (
                <div className={`p-4 rounded-lg border ${message.type === 'error' ? 'bg-red-950/50 border-red-800 text-red-300' : 'bg-green-950/50 border-green-800 text-green-300'}`}>
                    <div className="flex items-center gap-2">
                        {message.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        <span className="font-medium">{message.text}</span>
                    </div>
                    {message.details && <p className="mt-1 text-sm opacity-80 ml-7">{message.details}</p>}
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Grant ALL to service_role */}
                <div className={`p-5 rounded-xl border ${allServiceRoleGranted ? 'bg-green-950/20 border-green-800/50' : 'bg-neutral-900 border-neutral-800'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <Zap className={`w-5 h-5 ${allServiceRoleGranted ? 'text-green-400' : 'text-purple-400'}`} />
                        <h3 className="text-white font-semibold">Grant ALL to service_role</h3>
                    </div>
                    <p className="text-sm text-neutral-400 mb-4">
                        Grant SELECT, INSERT, UPDATE, DELETE on all public tables to <code className="text-purple-300">service_role</code>.
                        Required for Edge Functions to work.
                    </p>
                    {allServiceRoleGranted ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                            <ShieldCheck className="w-4 h-4" />
                            All tables are granted
                        </div>
                    ) : (
                        <button
                            onClick={handleGrantAllServiceRole}
                            disabled={actionLoading === 'grant_all'}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
                        >
                            {actionLoading === 'grant_all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                            Grant All Now
                        </button>
                    )}
                </div>

                {/* Setup Default Privileges */}
                <div className={`p-5 rounded-xl border ${hasDefaultPrivileges ? 'bg-green-950/20 border-green-800/50' : 'bg-neutral-900 border-neutral-800'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <Settings2 className={`w-5 h-5 ${hasDefaultPrivileges ? 'text-green-400' : 'text-amber-400'}`} />
                        <h3 className="text-white font-semibold">Auto-Grant (Default Privileges)</h3>
                    </div>
                    <p className="text-sm text-neutral-400 mb-4">
                        Run <code className="text-amber-300">ALTER DEFAULT PRIVILEGES</code> so new tables
                        automatically get <code className="text-purple-300">service_role</code> grants.
                    </p>
                    {hasDefaultPrivileges ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                            <ShieldCheck className="w-4 h-4" />
                            Default privileges are active
                        </div>
                    ) : (
                        <button
                            onClick={handleSetupDefaultPrivileges}
                            disabled={actionLoading === 'default_priv'}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-50"
                        >
                            {actionLoading === 'default_priv' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                            Setup Now
                        </button>
                    )}
                </div>
            </div>

            {/* Grants Table */}
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-800">
                                <th className="text-left px-4 py-3 text-neutral-400 font-medium sticky left-0 bg-neutral-900 z-10" rowSpan={2}>
                                    Table
                                </th>
                                {(Object.keys(ROLE_LABELS) as RoleName[]).map(role => (
                                    <th key={role} colSpan={4} className="text-center px-2 py-2 border-l border-neutral-800">
                                        <span className={`font-semibold ${ROLE_LABELS[role].color}`}>
                                            {ROLE_LABELS[role].label}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                            <tr className="border-b border-neutral-700 text-neutral-500 text-xs">
                                {(Object.keys(ROLE_LABELS) as RoleName[]).map(role => (
                                    (Object.keys(PRIV_LABELS) as PrivilegeName[]).map((priv, i) => (
                                        <th
                                            key={`${role}-${priv}`}
                                            className={`px-2 py-1.5 text-center ${i === 0 ? 'border-l border-neutral-800' : ''}`}
                                            title={`${priv.toUpperCase()} for ${role}`}
                                        >
                                            {PRIV_LABELS[priv]}
                                        </th>
                                    ))
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={13} className="text-center py-12 text-neutral-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading grants...
                                    </td>
                                </tr>
                            ) : tables.length === 0 ? (
                                <tr>
                                    <td colSpan={13} className="text-center py-12 text-neutral-500">
                                        No tables found in public schema
                                    </td>
                                </tr>
                            ) : (
                                tables.map(table => (
                                    <tr key={table.name} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                                        <td className="px-4 py-2.5 font-mono text-neutral-200 sticky left-0 bg-neutral-900 z-10">
                                            {table.name}
                                        </td>
                                        {(Object.keys(ROLE_LABELS) as RoleName[]).map(role => (
                                            (Object.keys(PRIV_LABELS) as PrivilegeName[]).map((priv, i) => {
                                                const granted = table[role][priv];
                                                const loadingKey = `${table.name}.${role}.${priv}`;
                                                const isToggling = actionLoading === loadingKey;

                                                return (
                                                    <td
                                                        key={`${table.name}-${role}-${priv}`}
                                                        className={`px-2 py-2.5 text-center ${i === 0 ? 'border-l border-neutral-800' : ''}`}
                                                    >
                                                        {isToggling ? (
                                                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-500" />
                                                        ) : (
                                                            <button
                                                                onClick={() => togglePrivilege(table.name, role, priv, granted)}
                                                                className={`w-6 h-6 rounded border transition-all mx-auto flex items-center justify-center ${
                                                                    granted
                                                                        ? 'bg-green-600/20 border-green-600 text-green-400 hover:bg-red-600/20 hover:border-red-600 hover:text-red-400'
                                                                        : 'bg-neutral-800 border-neutral-700 text-neutral-600 hover:bg-green-600/20 hover:border-green-600 hover:text-green-400'
                                                                }`}
                                                                title={`${granted ? 'Revoke' : 'Grant'} ${priv.toUpperCase()} on ${table.name} for ${role}`}
                                                            >
                                                                {granted ? '✓' : ''}
                                                            </button>
                                                        )}
                                                    </td>
                                                );
                                            })
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                {!isLoading && tables.length > 0 && (
                    <div className="px-4 py-3 border-t border-neutral-800 text-sm text-neutral-500 flex items-center justify-between">
                        <span>{tables.length} tables in public schema</span>
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded border bg-green-600/20 border-green-600 inline-block"></span>
                                Granted
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded border bg-neutral-800 border-neutral-700 inline-block"></span>
                                Not granted
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
