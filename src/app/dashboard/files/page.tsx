'use client';

import { useState, useCallback, useEffect } from 'react';
import { FileManager } from '@cubone/react-file-manager';
import '@cubone/react-file-manager/dist/style.css';
import { FolderHeart } from 'lucide-react';
import axios from 'axios';

// Transform custom API response format into the format required by the library
const transformFileStats = (file: any) => ({
    name: file.name,
    isDirectory: file.isDir, // Use isDirectory as required by the library
    path: file.path,
    size: file.size,
    updatedAt: file.modDate ? new Date(file.modDate).toISOString() : undefined,
});

export default function FileManagerPage() {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Fetch lists of files from our API
    const loadFiles = useCallback(async (path: string = '/') => {
        if (!isMounted) return; // Prevent SSR Axios error
        setIsLoading(true);
        try {
            const url = `/api/files?category=system&path=${encodeURIComponent(path)}`;
            const response = await axios.get(url);
            if (Array.isArray(response.data)) {
                setFiles(response.data.map(transformFileStats));
            } else {
                setFiles([]);
            }
        } catch (error) {
            console.error('Failed to parse folders:', error);
        } finally {
            setIsLoading(false);
        }
    }, [isMounted]);

    // Initial Load
    useEffect(() => {
        if (isMounted) {
            loadFiles(currentPath);
        }
    }, [currentPath, loadFiles, isMounted]);

    const handleCreateFolder = async (name: string, parentFolder: any) => {
        try {
            await axios.post('/api/files', { action: 'createFolder', name, path: parentFolder?.path || currentPath });
            await loadFiles(currentPath);
        } catch (err) {
            console.error('Create Folder Error:', err);
        }
    };

    const handleDelete = async (deletedFiles: any[]) => {
        try {
            if (deletedFiles && deletedFiles.length > 0) {
                for (let file of deletedFiles) {
                    await axios.delete(`/api/files?path=${encodeURIComponent(file.path)}`);
                }
                await loadFiles(currentPath);
            }
        } catch (err) {
            console.error('Delete Error:', err);
        }
    };

    const handleRename = async (file: any, newName: string) => {
        try {
            await axios.post('/api/files', { action: 'rename', path: file.path, newName });
            await loadFiles(currentPath);
        } catch (err) {
            console.error('Rename Error:', err);
        }
    };

    const handlePaste = async (pastedFiles: any[], destinationFolder: any, operationType: "copy" | "move") => {
        try {
            if (pastedFiles && destinationFolder) {
                for (let f of pastedFiles) {
                    await axios.post('/api/files', {
                        action: operationType,
                        sourcePath: f.path,
                        destinationPath: destinationFolder.path
                    });
                }
                await loadFiles(currentPath);
            }
        } catch (err) {
            console.error('Paste Error:', err);
        }
    };

    const handleDownload = async (downloadFiles: any[]) => {
        try {
            if (downloadFiles && downloadFiles.length > 0) {
                for (let file of downloadFiles) {
                    if (!file.isDirectory) {
                        window.open(`/api/files?path=${encodeURIComponent(file.path)}&action=download`, '_blank');
                    }
                }
            }
        } catch (err) {
            console.error('Download Error:', err);
        }
    };

    const handleFileOpen = (file: any) => {
        if (!file.isDirectory) {
            window.open(`/api/files?path=${encodeURIComponent(file.path)}&action=download`, '_blank');
        }
    };

    // Delay render to avoid SSR hydration mismatch
    if (!isMounted) return null;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 min-h-[calc(100vh-6rem)] h-full flex flex-col">
            <div className="flex items-center gap-3 shrink-0">
                <div className="bg-blue-500/20 p-2 rounded-lg border border-blue-500/30">
                    <FolderHeart className="w-5 h-5 text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">System File Manager</h1>
                <span className="ml-auto text-sm text-neutral-400">Current Path: <span className="font-mono text-blue-400">{currentPath}</span></span>
            </div>

            <div className="flex-1 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl relative min-h-0">
                <div className="absolute inset-0 frontend-file-manager text-black bg-white rounded-2xl">
                    <FileManager
                        files={files}
                        isLoading={isLoading}
                        initialPath={currentPath}
                        onFolderChange={setCurrentPath}
                        onCreateFolder={handleCreateFolder}
                        onDelete={handleDelete}
                        onRename={handleRename}
                        onPaste={handlePaste}
                        onDownload={handleDownload}
                        onFileOpen={handleFileOpen}
                        onRefresh={() => loadFiles(currentPath)}
                        fileUploadConfig={{
                            url: '/api/files/upload',
                            method: 'POST'
                        }}
                        onFileUploading={(file: any, parentFolder: any) => {
                            return { path: parentFolder?.path || currentPath };
                        }}
                        onFileUploaded={(res: any) => loadFiles(currentPath)}
                        height="100%"
                    />
                </div>
            </div>
        </div>
    );
}
