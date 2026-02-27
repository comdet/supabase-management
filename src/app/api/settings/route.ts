import { NextResponse } from 'next/server';
import { dbGet, dbRun, getSetting, setSetting } from '@/lib/db';
import { hashPassword, comparePassword } from '@/lib/auth';

export async function GET(req: Request) {
    try {
        // Fetch current admin username from users table (assuming id=1 is admin)
        const user = await dbGet('SELECT username FROM users ORDER BY id ASC LIMIT 1');
        const adminUsername = user ? user.username : '';

        const backupDir = await getSetting('BACKUP_DIR', '');
        const fileManagerRoot = await getSetting('FILE_MANAGER_ROOT', '/');

        const safeConfig = {
            ADMIN_USERNAME: adminUsername,
            BACKUP_DIR: backupDir,
            FILE_MANAGER_ROOT: fileManagerRoot,
        };

        return NextResponse.json(safeConfig);
    } catch (error: any) {
        console.error('Settings GET Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to load settings' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { currentPassword, newUsername, newPassword, backupDir, fileManagerRoot } = body;

        let credentialsChanged = false;

        // Verify current password if they are trying to change credentials
        if (newUsername || newPassword) {
            const adminUser = await dbGet('SELECT * FROM users ORDER BY id ASC LIMIT 1');
            if (!adminUser) {
                return NextResponse.json({ error: 'No admin user found. System needs setup.' }, { status: 400 });
            }

            if (!comparePassword(currentPassword, adminUser.password_hash)) {
                return NextResponse.json({ error: 'Invalid current password' }, { status: 403 });
            }

            // Update credentials
            const updateUsername = newUsername || adminUser.username;
            const updatePasswordHash = newPassword ? hashPassword(newPassword) : adminUser.password_hash;

            await dbRun('UPDATE users SET username = ?, password_hash = ? WHERE id = ?', [updateUsername, updatePasswordHash, adminUser.id]);
            credentialsChanged = true;
        }

        if (backupDir !== undefined) await setSetting('BACKUP_DIR', backupDir);
        if (fileManagerRoot !== undefined) await setSetting('FILE_MANAGER_ROOT', fileManagerRoot);

        return NextResponse.json({
            success: true,
            message: 'Settings updated successfully.',
            credentialsChanged
        });

    } catch (error: any) {
        console.error('Settings POST Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
    }
}
