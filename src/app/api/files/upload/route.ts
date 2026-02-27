import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = process.env.FILE_MANAGER_ROOT || path.resolve(process.cwd(), '..');

const resolveSafePath = (userPath: string | null) => {
    if (!userPath) return ROOT_DIR;
    const normalizedPath = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const resolvedPath = path.join(ROOT_DIR, normalizedPath.replace(/^\//, ''));
    if (!resolvedPath.startsWith(ROOT_DIR)) {
        throw new Error('Access denied: Invalid path');
    }
    return resolvedPath;
};

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const files: File[] = [];
        let folderPath = '/';

        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                files.push(value);
            } else if (key === 'path') {
                folderPath = value as string;
            }
        }

        if (files.length === 0) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const targetDir = resolveSafePath(folderPath);

        // Ensure the target directory exists before saving files
        await fs.mkdir(targetDir, { recursive: true });

        const uploadResults = [];

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Prevent dangerous filenames
            const safeFileName = path.basename(file.name);
            const targetFilePath = path.join(targetDir, safeFileName);

            await fs.writeFile(targetFilePath, buffer);
            uploadResults.push({ name: safeFileName, size: file.size });
        }

        return NextResponse.json({
            success: true,
            message: `${files.length} file(s) uploaded successfully`,
            files: uploadResults
        });

    } catch (error: any) {
        console.error('File Upload Error:', error);
        return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
    }
}
