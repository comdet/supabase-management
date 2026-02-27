'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSetup, setIsSetup] = useState(false);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check if system needs setup
        fetch('/api/auth/login')
            .then(res => res.json())
            .then(data => {
                if (data.needsSetup) {
                    setIsSetup(true);
                }
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            router.push('/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
                    {isSetup ? 'Setup Administrator' : 'Sign in to management'}
                </h2>
                {isSetup && (
                    <p className="mt-2 text-center text-sm text-neutral-400">
                        Create your administrative account to manage this Supabase instance.
                    </p>
                )}
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-neutral-900 py-8 px-4 shadow-xl shadow-black/40 sm:rounded-xl sm:px-10 border border-neutral-800">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-neutral-200">
                                Username
                            </label>
                            <div className="mt-1">
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-neutral-700 bg-neutral-800 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-neutral-200">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-3 py-2 border border-neutral-700 bg-neutral-800 rounded-md shadow-sm placeholder-neutral-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-white"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-md border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2 px-4 shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Processing...' : (isSetup ? 'Create Account & Login' : 'Sign in')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
