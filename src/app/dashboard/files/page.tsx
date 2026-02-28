'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
    FolderHeart, 
    Folder, 
    FileText, 
    Image as ImageIcon, 
    Download, 
    Trash2, 
    Edit2, 
    FolderPlus,
    CornerLeftUp,
    RefreshCw,
    MoreVertical,
    ChevronRight,
    Home
} from 'lucide-react';
import axios from 'axios';

type FileItem = {
    id: string;
    name: string;
    isDir: boolean;
    size: number;
    modDate: string;
    ext?: string;
    path: string;
};

export default function FileManagerPage() {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<FileItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    // Dialog states
    const [newFolderName, setNewFolderName] = useState('');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [renameFile, setRenameFile] = useState<FileItem | null>(null);
    const [newName, setNewName] = useState('');

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const loadFiles = useCallback(async (path: string = '/') => {
        if (!isMounted) return;
        setIsLoading(true);
        try {
            const url = `/api/files?category=system&path=${encodeURIComponent(path)}`;
            const response = await axios.get(url);
            if (Array.isArray(response.data)) {
                setFiles(response.data);
            } else {
                setFiles([]);
            }
        } catch (error) {
            console.error('Failed to load files:', error);
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, [isMounted]);

    useEffect(() => {
        if (isMounted) {
            loadFiles(currentPath);
        }
    }, [currentPath, loadFiles, isMounted]);

    const navigateTo = (path: string) => {
        let newPath = path;
        if (!newPath.startsWith('/')) newPath = '/' + newPath;
        setCurrentPath(newPath);
    };

    const navigateUp = () => {
        if (currentPath === '/') return;
        const parts = currentPath.split('/').filter(Boolean);
        parts.pop();
        setCurrentPath('/' + parts.join('/'));
    };

    const handleCreateFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;
        try {
            await axios.post('/api/files', { 
                action: 'createFolder', 
                name: newFolderName.trim(), 
                path: currentPath 
            });
            setNewFolderName('');
            setIsCreatingFolder(false);
            loadFiles(currentPath);
        } catch (err) {
            console.error('Create Folder Error:', err);
            alert('Failed to create folder');
        }
    };

    const handleDelete = async (file: FileItem) => {
        if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
        try {
            await axios.delete(`/api/files?path=${encodeURIComponent(file.path)}`);
            loadFiles(currentPath);
        } catch (err) {
            console.error('Delete Error:', err);
            alert('Failed to delete item');
        }
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renameFile || !newName.trim() || newName === renameFile.name) {
            setRenameFile(null);
            return;
        }
        try {
            await axios.post('/api/files', { 
                action: 'rename', 
                path: renameFile.path, 
                newName: newName.trim() 
            });
            setRenameFile(null);
            loadFiles(currentPath);
        } catch (err) {
            console.error('Rename Error:', err);
            alert('Failed to rename item');
        }
    };

    const handleDownload = (file: FileItem) => {
        if (!file.isDir) {
            window.open(`/api/files?path=${encodeURIComponent(file.path)}&action=download`, '_blank');
        }
    };

    const getFileIcon = (file: FileItem) => {
        if (file.isDir) return <Folder className="w-5 h-5 text-blue-400 fill-blue-400/20" />;
        const imgExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];
        if (file.ext && imgExts.includes(file.ext)) return <ImageIcon className="w-5 h-5 text-purple-400" />;
        return <FileText className="w-5 h-5 text-neutral-400" />;
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', 
            hour: '2-digit', minute: '2-digit'
        });
    };

    const renderBreadcrumbs = () => {
        const parts = currentPath.split('/').filter(Boolean);
        let pathSoFar = '';
        
        return (
            <div className="flex items-center text-sm overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
                <button 
                    onClick={() => navigateTo('/')}
                    className={`flex items-center hover:text-white transition-colors ${currentPath === '/' ? 'text-white' : 'text-neutral-400'}`}
                >
                    <Home className="w-4 h-4 mr-1" /> Root
                </button>
                
                {parts.map((part, index) => {
                    pathSoFar += `/${part}`;
                    const isLast = index === parts.length - 1;
                    return (
                        <div key={pathSoFar} className="flex items-center">
                            <ChevronRight className="w-4 h-4 text-neutral-600 mx-1 flex-shrink-0" />
                            <button
                                onClick={() => navigateTo(pathSoFar)}
                                className={`hover:text-white transition-colors truncate max-w-[150px] ${isLast ? 'text-white font-medium' : 'text-neutral-400'}`}
                            >
                                {part}
                            </button>
                        </div>
                    );
                })}
            </div>
        );
    };

    if (!isMounted) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
                        <FolderHeart className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">System Files</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsCreatingFolder(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
                    >
                        <FolderPlus className="w-4 h-4" /> New Folder
                    </button>
                    <button 
                        onClick={() => loadFiles(currentPath)}
                        className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-md transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 rounded-xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col overflow-hidden min-h-0">
                {/* Toolbar / Breadcrumbs */}
                <div className="px-4 pt-3 pb-2 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-2 shrink-0">
                    <button 
                        onClick={navigateUp}
                        disabled={currentPath === '/'}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Go up"
                    >
                        <CornerLeftUp className="w-4 h-4" />
                    </button>
                    <div className="w-px h-5 bg-neutral-800 mx-1"></div>
                    <div className="flex-1 overflow-hidden">
                        {renderBreadcrumbs()}
                    </div>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-neutral-950/80 backdrop-blur-sm z-10 border-b border-neutral-800">
                            <tr className="text-neutral-500 text-xs uppercase tracking-wider">
                                <th className="px-4 py-3 font-medium w-full">Name</th>
                                <th className="px-4 py-3 font-medium whitespace-nowrap hidden sm:table-cell">Date Modified</th>
                                <th className="px-4 py-3 font-medium whitespace-nowrap text-right">Size</th>
                                <th className="px-4 py-3 font-medium text-right"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800/50">
                            {files.length === 0 && !isLoading && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-12 text-center text-neutral-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Folder className="w-12 h-12 mb-3 text-neutral-700" />
                                            <p>This folder is empty</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            
                            {files.map((file) => (
                                <tr 
                                    key={file.id} 
                                    className="hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                                    onDoubleClick={() => file.isDir && navigateTo(file.path)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {getFileIcon(file)}
                                            {renameFile?.id === file.id ? (
                                                <form onSubmit={handleRenameSubmit} className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <input 
                                                        type="text" 
                                                        value={newName}
                                                        onChange={(e) => setNewName(e.target.value)}
                                                        className="bg-neutral-950 border border-blue-500/50 rounded px-2 py-1 text-sm text-white w-full sm:w-auto outline-none focus:border-blue-500"
                                                        autoFocus
                                                        onBlur={() => setRenameFile(null)}
                                                    />
                                                </form>
                                            ) : (
                                                <span 
                                                    className="text-neutral-200 font-medium group-hover:text-white truncate max-w-[200px] sm:max-w-md lg:max-w-lg"
                                                    onClick={() => file.isDir && navigateTo(file.path)}
                                                >
                                                    {file.name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-neutral-500 hidden sm:table-cell whitespace-nowrap">
                                        {formatDate(file.modDate)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-neutral-500 text-right whitespace-nowrap">
                                        {file.isDir ? '--' : formatSize(file.size)}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            {!file.isDir && (
                                                <button 
                                                    onClick={() => handleDownload(file)}
                                                    className="p-1.5 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => {
                                                    setRenameFile(file);
                                                    setNewName(file.name);
                                                }}
                                                className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded transition-colors"
                                                title="Rename"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(file)}
                                                className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Folder Modal Overlay */}
            {isCreatingFolder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50">
                            <h3 className="text-lg font-medium text-white flex items-center gap-2">
                                <FolderPlus className="w-5 h-5 text-blue-500" /> New Folder
                            </h3>
                        </div>
                        <form onSubmit={handleCreateFolder} className="p-4">
                            <label className="block text-sm font-medium text-neutral-400 mb-2">Folder Name</label>
                            <input
                                type="text"
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="e.g. static, images"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-md px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors mb-6"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreatingFolder(false);
                                        setNewFolderName('');
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 rounded-md transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newFolderName.trim()}
                                    className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                                >
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
