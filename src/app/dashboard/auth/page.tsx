"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { Users, Trash2, Plus, AlertOctagon, RefreshCw, Loader2, ShieldAlert, Search } from "lucide-react";

interface AuthUser {
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
}

export default function AuthManagementPage() {
    const [users, setUsers] = useState<AuthUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');

    // Add User Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Clear All State
    const [clearConfirmText, setClearConfirmText] = useState('');

    // Search and Pagination State
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/auth-users/users');
            setUsers(res.data.users || []);
            setCurrentPage(1); // Reset to page 1 on fresh load
            setErrorMsg('');
        } catch (err: unknown) {
            const error = err as any;
            setErrorMsg(error.response?.data?.error || 'Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Derived Search & Pagination Metrics
    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setActionLoading('create');
        setErrorMsg('');
        try {
            await axios.post('/api/auth-users/users', {
                email: newEmail,
                password: newPassword
            });
            setIsAddModalOpen(false);
            setNewEmail('');
            setNewPassword('');
            fetchUsers();
        } catch (err: unknown) {
            const error = err as any;
            setErrorMsg(error.response?.data?.error || 'Failed to create user');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteUser = async (id: string, email: string) => {
        if (!confirm(`Are you sure you want to permanently delete the user ${email}?`)) return;

        setActionLoading(id);
        setErrorMsg('');
        try {
            await axios.delete(`/api/auth-users/users?id=${id}`);
            fetchUsers();
        } catch (err: unknown) {
            const error = err as any;
            setErrorMsg(error.response?.data?.error || 'Failed to delete user');
        } finally {
            setActionLoading(null);
        }
    };

    const handleClearAuth = async () => {
        if (clearConfirmText !== 'CLEAR_AUTH') {
            setErrorMsg("Type CLEAR_AUTH exactly to confirm.");
            return;
        }

        setActionLoading('clearAll');
        setErrorMsg('');
        try {
            await axios.post('/api/auth-users/clear', { confirm: clearConfirmText });
            setClearConfirmText('');
            fetchUsers();
        } catch (err: unknown) {
            const error = err as any;
            setErrorMsg(error.response?.data?.error || 'Failed to clear auth records');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
                        <Users className="text-emerald-500 w-8 h-8" />
                        Authentication Manager
                    </h1>
                    <p className="text-neutral-400 mt-1">Manage Supabase Native Authentications directly from your Docker environment.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                        <input
                            type="text"
                            placeholder="Search email or UUID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-neutral-900 border border-neutral-800 text-sm text-white rounded-lg pl-9 pr-4 py-2 outline-none focus:border-emerald-500 transition-colors w-64"
                        />
                    </div>
                    <button
                        onClick={fetchUsers}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors border border-neutral-700"
                        title="Refresh Users"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-all border border-emerald-500 shadow-lg shadow-emerald-500/20"
                    >
                        <Plus size={18} />
                        Add User
                    </button>
                </div>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3">
                    <AlertOctagon size={20} className="mt-0.5 shrink-0" />
                    <p>{errorMsg}</p>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="lowercase bg-neutral-950/50 text-neutral-400 border-b border-neutral-800">
                            <tr>
                                <th className="px-6 py-4 font-medium">Email</th>
                                <th className="px-6 py-4 font-medium">UUID</th>
                                <th className="px-6 py-4 font-medium">Created At</th>
                                <th className="px-6 py-4 font-medium">Last Sign In</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        Loading users...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                        No authentication users found.
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                                        No users match your search &quot;{searchQuery}&quot;.
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-neutral-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                                                    {user.email.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-200">{user.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="px-2 py-1 bg-neutral-950 rounded text-neutral-400 font-mono text-xs">{user.id}</code>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-400">
                                            {new Date(user.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-neutral-400">
                                            {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                disabled={actionLoading === user.id}
                                                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete User"
                                            >
                                                {actionLoading === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-6 py-4 bg-neutral-950/50 border-t border-neutral-800">
                            <span className="text-sm text-neutral-400">
                                Showing <span className="text-white font-medium">{startIndex + 1}</span> to <span className="text-white font-medium">{Math.min(startIndex + itemsPerPage, filteredUsers.length)}</span> of <span className="text-white font-medium">{filteredUsers.length}</span> users
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-300 disabled:opacity-50 hover:bg-neutral-800 transition-colors disabled:hover:bg-neutral-900"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-neutral-300 disabled:opacity-50 hover:bg-neutral-800 transition-colors disabled:hover:bg-neutral-900"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-8 border border-red-900/50 bg-red-950/10 rounded-2xl p-6 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>

                <h2 className="text-xl font-bold text-red-500 flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5" />
                    Danger Zone
                </h2>
                <p className="text-neutral-400 text-sm mb-6">
                    Wiping the Authentication Database will forcefully drop all user accounts and disable any active login sessions. This cannot be undone.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-neutral-900/50 rounded-xl border border-red-900/30">
                    <div className="flex-1">
                        <h4 className="font-semibold text-slate-200 text-sm">Wipe All Authenticators</h4>
                        <p className="text-xs text-neutral-500 mt-1">Type <code className="text-red-400 bg-red-500/10 px-1 rounded">CLEAR_AUTH</code> to confirm deletion.</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                            type="text"
                            placeholder="CLEAR_AUTH"
                            value={clearConfirmText}
                            onChange={(e) => setClearConfirmText(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-red-500 transition-colors w-full sm:w-auto"
                        />
                        <button
                            onClick={handleClearAuth}
                            disabled={clearConfirmText !== 'CLEAR_AUTH' || actionLoading === 'clearAll'}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-red-500 whitespace-nowrap flex items-center justify-center min-w-[100px]"
                        >
                            {actionLoading === 'clearAll' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wipe Users'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">

                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white">Create New User</h2>
                            <p className="text-sm text-neutral-400 mt-1">This user will be injected securely into the native Postgres authentication schema.</p>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1">Secure Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white outline-none focus:border-emerald-500 transition-colors"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-neutral-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'create' || !newEmail || !newPassword}
                                    className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
