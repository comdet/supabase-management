import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: Request) {
    try {
        const { schedule, command } = await req.json();

        if (!schedule || !command) {
            return NextResponse.json({ error: 'Schedule and command are required' }, { status: 400 });
        }

        // 1. อ่าน Crontab เดิมก่อน
        let currentCrontab = '';
        try {
            const { stdout } = await execAsync('crontab -l');
            currentCrontab = stdout;
        } catch (e: any) {
            // ถ้า Error Code = 1 แปลว่ายังคลีน ไม่มี crontab ของ user อาศัยเป็นเริ่มใหม่ได้
            if (e.code !== 1) {
                console.warn('Error reading crontab, but proceeding:', e);
            }
        }

        // 2. เตรียมคำสั่งที่จะเพิ่ม (บรรทัดใหม่)
        const newCronLine = `${schedule} ${command}`;

        // 3. ตรวจสอบว่ามีอยู่แล้วหรือยังเพื่อไม่ให้ซ้ำ
        if (currentCrontab.includes(newCronLine)) {
            return NextResponse.json({ error: 'This cron job already exists' }, { status: 409 });
        }

        // 4. นำมารวมกัน
        const updatedCrontab = currentCrontab + (currentCrontab.endsWith('\n') || currentCrontab === '' ? '' : '\n') + newCronLine + '\n';

        // 5. เขียนลงไฟล์ชั่วคราวแล้วให้ crontab อ่านเข้าไป
        const tempFilePath = path.join(process.cwd(), 'temp_crontab.txt');
        await fs.writeFile(tempFilePath, updatedCrontab, 'utf-8');

        try {
            await execAsync(`crontab ${tempFilePath}`);
        } finally {
            // ลบไฟล์ชั่วคราวออกไม่ว่าจะสำเร็จหรือไม่
            await fs.unlink(tempFilePath).catch(console.error);
        }

        return NextResponse.json({ success: true, message: 'Cron job added successfully' });

    } catch (error: any) {
        console.error('Error adding cron job:', error);
        return NextResponse.json({ error: error.message || 'Failed to add cron job' }, { status: 500 });
    }
}
