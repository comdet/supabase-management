import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getSetting } from '@/lib/db';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const BACKUP_DIR = await getSetting('BACKUP_DIR', path.join(process.cwd(), 'backups'));
        const resolvedParams = await params;
        const filename = resolvedParams.filename;

        // Prevent directory traversal
        const safeFilename = path.basename(filename);
        const filePath = path.join(BACKUP_DIR, safeFilename);

        if (!fs.existsSync(filePath)) {
            return new NextResponse('File not found', { status: 404 });
        }

        const fileStream = fs.createReadStream(filePath);

        return new NextResponse(fileStream as any, {
            headers: {
                'Content-Disposition': `attachment; filename="${safeFilename}"`,
                'Content-Type': 'application/octet-stream',
            },
        });
    } catch (error: any) {
        console.error('Download error:', error);
        return new NextResponse('Failed to download backup', { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    try {
        const BACKUP_DIR = await getSetting('BACKUP_DIR', path.join(process.cwd(), 'backups'));
        const resolvedParams = await params;
        const filename = resolvedParams.filename;

        const safeFilename = path.basename(filename);
        const filePath = path.join(BACKUP_DIR, safeFilename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return NextResponse.json({ message: 'Backup deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: 'Failed to delete backup' }, { status: 500 });
    }
}
