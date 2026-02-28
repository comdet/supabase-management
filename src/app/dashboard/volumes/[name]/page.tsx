'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, RefreshCw, ServerCrash, FileText, Folder, Download, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { useCallback } from 'react';

type FileItem = {
    name: string;
    isDir: boolean;
    size: number;
    date: string;
    permissions: string;
    path: string;
};

export default function VolumeFilesPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const volumeName = params.name as string;
    const currentPath = searchParams.get('path') || '/';

    // Decode display name for bind mounts
    let displayVolumeName = volumeName;
    if (displayVolumeName.startsWith('bind-')) {
        const hexPart = displayVolumeName.substring(5);
        const bytes = new Uint8Array(hexPart.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
        displayVolumeName = new TextDecoder().decode(bytes);
    }

    const [files, setFiles] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchFiles = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const res = await fetch(`/api/docker/volumes/${volumeName}/files?path=${encodeURIComponent(currentPath)}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch files');
            }

            setFiles(data.files);
        } catch (err: unknown) {
            const errorResponse = err as { message: string };
            setError(errorResponse.message);
        } finally {
            setLoading(false);
        }
    }, [volumeName, currentPath]);

    useEffect(() => {
        if (volumeName) {
            fetchFiles();
        }
    }, [volumeName, fetchFiles]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const parentPath = currentPath === '/' ? null : currentPath.split('/').slice(0, -1).join('/') || '/';

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/dashboard/volumes')}
                        className="p-2 bg-neutral-800 hover:bg-neutral-700 rounded-md text-neutral-300 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <HardDrive className="w-6 h-6 text-blue-500" />
                            Volume Browser
                        </h1>
                        <p className="text-sm text-neutral-400 max-w-lg truncate" title={displayVolumeName}>{displayVolumeName}</p>
                    </div>
                </div>
                <button
                    onClick={fetchFiles}
                    disabled={loading}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="mb-4 bg-neutral-900 px-4 py-3 rounded-xl border border-neutral-800 flex items-center text-sm">
                <span className="text-neutral-500 mr-2">Path:</span>
                <span className="text-blue-400 font-mono">{currentPath}</span>
            </div>

            {error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg flex items-center gap-2">
                    <ServerCrash className="w-5 h-5" /> {error}
                </div>
            ) : (
                <div className="bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 relative min-h-[400px]">
                    {loading && (
                        <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="flex items-center gap-2 text-blue-500 bg-neutral-800 px-4 py-2 rounded-lg shadow-lg">
                                <RefreshCw className="w-5 h-5 animate-spin" /> Loading files...
                            </div>
                        </div>
                    )}
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-950/50 border-b border-neutral-800 text-neutral-400 text-sm">
                                <th className="p-4 font-medium">Name</th>
                                <th className="p-4 font-medium hidden sm:table-cell">Size</th>
                                <th className="p-4 font-medium hidden md:table-cell">Modified</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {parentPath && (
                                <tr className="hover:bg-neutral-800/50 transition-colors">
                                    <td colSpan={4} className="p-4">
                                        <Link
                                            href={`/dashboard/volumes/${volumeName}?path=${encodeURIComponent(parentPath)}`}
                                            className="flex items-center text-blue-400 hover:text-blue-300"
                                        >
                                            <Folder className="w-5 h-5 mr-3 text-blue-500" fill="currentColor" fillOpacity={0.2} />
                                            .. (Parent Directory)
                                        </Link>
                                    </td>
                                </tr>
                            )}

                            {files.map((file) => (
                                <tr key={file.path} className="hover:bg-neutral-800/50 transition-colors group">
                                    <td className="p-4">
                                        {file.isDir ? (
                                            <Link
                                                href={`/dashboard/volumes/${volumeName}?path=${encodeURIComponent(file.path)}`}
                                                className="flex items-center text-neutral-200 hover:text-blue-400 transition-colors"
                                            >
                                                <Folder className="w-5 h-5 mr-3 text-blue-500" fill="currentColor" fillOpacity={0.2} />
                                                {file.name}
                                            </Link>
                                        ) : (
                                            <div className="flex items-center text-neutral-300">
                                                <FileText className="w-5 h-5 mr-3 text-neutral-500" />
                                                {file.name}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-sm text-neutral-500 hidden sm:table-cell">
                                        {file.isDir ? '--' : formatSize(file.size)}
                                    </td>
                                    <td className="p-4 text-sm text-neutral-500 hidden md:table-cell whitespace-nowrap">
                                        {file.date}
                                    </td>
                                    <td className="p-4 text-right">
                                        {!file.isDir && (
                                            <a
                                                href={`/api/docker/volumes/${volumeName}/download?path=${encodeURIComponent(file.path)}`}
                                                download
                                                className="inline-flex items-center p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        )}
                                    </td>
                                </tr>
                            ))}

                            {files.length === 0 && !parentPath && !loading && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-neutral-500">
                                        <Folder className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
                                        This directory is empty
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
