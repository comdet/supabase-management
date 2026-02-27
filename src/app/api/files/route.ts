import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

// Define the root directory to which the file manager has access.
// IMPORTANT: Adjust this to the actual directory you want to expose.
// Using the project root for now, but in production, restrict this.
const ROOT_DIR = process.env.FILE_MANAGER_ROOT || path.resolve(process.cwd(), '..');

// Helper to sanitize and resolve paths to prevent directory traversal attacks
const resolveSafePath = (userPath: string | null) => {
    if (!userPath) return ROOT_DIR;

    // Normalize path to remove ../ and ./
    const normalizedPath = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');

    // Resolve absolute path (Ensure it starts at ROOT_DIR correctly)
    const resolvedPath = path.join(ROOT_DIR, normalizedPath.replace(/^\//, ''));

    // Ensure the resolved path stays within the ROOT_DIR
    if (!resolvedPath.startsWith(ROOT_DIR)) {
        throw new Error('Access denied: Invalid path');
    }

    return resolvedPath;
};

// Map system file stats to the format expected by the frontend library
const mapFileStats = (fileName: string, stats: fsSync.Stats, fullPath: string) => {
    const isDir = stats.isDirectory();
    return {
        id: Buffer.from(fullPath).toString('base64'), // Unique ID based on path
        name: fileName,
        isDir: isDir,
        size: isDir ? 0 : stats.size,
        modDate: stats.mtime,
        // Optional file extension for icons on frontend
        ext: isDir ? undefined : path.extname(fileName).toLowerCase(),
        // The path relative to ROOT_DIR. Ensure it starts with / and uses forward slashes
        path: (fullPath.replace(ROOT_DIR, '') || '/').replace(/\\/g, '/'),
    };
};

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const folderPath = searchParams.get('path') || '/';
        const action = searchParams.get('action');

        const targetPath = resolveSafePath(folderPath);

        // Handle Download Action
        if (action === 'download') {
            const stats = await fs.stat(targetPath);
            if (stats.isDirectory()) {
                return NextResponse.json({ error: 'Cannot download a directory directly' }, { status: 400 });
            }

            const fileBuffer = await fs.readFile(targetPath);
            const fileName = path.basename(targetPath);

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
                    'Content-Type': 'application/octet-stream',
                    'Content-Length': stats.size.toString(),
                },
            });
        }

        // Default: List Directory Content
        const stats = await fs.stat(targetPath);
        if (!stats.isDirectory()) {
            return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
        }

        const files = await fs.readdir(targetPath);
        const fileList = [];

        for (const file of files) {
            // Ignore hidden files (starts with dot) and node_modules for cleaner UI
            if (file.startsWith('.') || file === 'node_modules') continue;

            try {
                const fullPath = path.join(targetPath, file);
                const fileStats = await fs.stat(fullPath);
                fileList.push(mapFileStats(file, fileStats, fullPath));
            } catch (err) {
                // Ignore files we don't have permission to stat
                console.warn(`Could not stat file: ${file}`, err);
            }
        }

        // Sort: Folders first, then alphabetically
        fileList.sort((a, b) => {
            if (a.isDir && !b.isDir) return -1;
            if (!a.isDir && b.isDir) return 1;
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json(fileList);

    } catch (error: any) {
        console.error('File Manager GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to list directory' }, { status: 500 });
    }
}

// Handle folder creation, renaming, and moving
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action } = body;

        switch (action) {
            case 'createFolder': {
                const { path: parentPath, name } = body;
                const targetDir = resolveSafePath(parentPath);
                const newFolderPath = path.join(targetDir, name);

                await fs.mkdir(newFolderPath, { recursive: true });
                return NextResponse.json({ success: true, message: 'Folder created', path: newFolderPath.replace(ROOT_DIR, '') });
            }

            case 'rename': {
                const { path: oldRelPath, newName } = body;
                const oldPath = resolveSafePath(oldRelPath);
                const newPath = path.join(path.dirname(oldPath), newName);

                // Ensure the new path is also safe (inside ROOT_DIR)
                if (!newPath.startsWith(ROOT_DIR)) throw new Error('Invalid rename destination');

                await fs.rename(oldPath, newPath);
                return NextResponse.json({ success: true, message: 'Renamed successfully' });
            }

            case 'move': {
                const { sourcePath: srcRelPath, destinationPath: destRelPath } = body;
                const srcPath = resolveSafePath(srcRelPath);
                const destDir = resolveSafePath(destRelPath);
                const destPath = path.join(destDir, path.basename(srcPath));

                await fs.rename(srcPath, destPath);
                return NextResponse.json({ success: true, message: 'Moved successfully' });
            }

            case 'copy': {
                const { sourcePath: srcRelPath, destinationPath: destRelPath } = body;
                const srcPath = resolveSafePath(srcRelPath);
                const destDir = resolveSafePath(destRelPath);
                let destPath = path.join(destDir, path.basename(srcPath));

                // Extremely basic copy (ideal production needs recursive copy for dirs)
                const stats = await fs.stat(srcPath);
                if (stats.isDirectory()) {
                    await fs.cp(srcPath, destPath, { recursive: true });
                } else {
                    await fs.copyFile(srcPath, destPath);
                }

                return NextResponse.json({ success: true, message: 'Copied successfully' });
            }

            default:
                return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('File Manager POST Error:', error);
        return NextResponse.json({ error: error.message || 'File operation failed' }, { status: 500 });
    }
}

// Handle file deletion
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const targetRelPath = searchParams.get('path');

        if (!targetRelPath) {
            return NextResponse.json({ error: 'Path parameter is required' }, { status: 400 });
        }

        const targetPath = resolveSafePath(targetRelPath);

        // Safety check: Do not allow deleting the root directory itself
        if (targetPath === ROOT_DIR) {
            return NextResponse.json({ error: 'Cannot delete root directory' }, { status: 403 });
        }

        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
            await fs.rm(targetPath, { recursive: true, force: true });
        } else {
            await fs.unlink(targetPath);
        }

        return NextResponse.json({ success: true, message: 'Deleted successfully' });

    } catch (error: any) {
        console.error('File Manager DELETE Error:', error);
        return NextResponse.json({ error: error.message || 'Deletion failed' }, { status: 500 });
    }
}
