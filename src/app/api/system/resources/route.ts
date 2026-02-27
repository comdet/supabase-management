import { NextResponse } from 'next/server';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper function to calculate CPU usage over a tiny interval
const getCpuUsage = async (): Promise<number> => {
    return new Promise((resolve) => {
        const startIdle = os.cpus().reduce((acc, cpu) => acc + cpu.times.idle, 0);
        const startTotal = os.cpus().reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0), 0);

        setTimeout(() => {
            const endIdle = os.cpus().reduce((acc, cpu) => acc + cpu.times.idle, 0);
            const endTotal = os.cpus().reduce((acc, cpu) => acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0), 0);

            const idleDifference = endIdle - startIdle;
            const totalDifference = endTotal - startTotal;

            if (totalDifference === 0) {
                resolve(0);
            } else {
                const percentage = 100 - (100 * idleDifference) / totalDifference;
                resolve(percentage > 100 ? 100 : percentage); // Cap at 100 just in case
            }
        }, 300); // 300ms sample time
    });
};

export async function GET() {
    try {
        // 1. Memory Usage
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsagePercent = (usedMemory / totalMemory) * 100;

        // 2. CPU Usage
        const cpuUsagePercent = await getCpuUsage();

        // 3. Disk Space (Root / partition)
        let diskUsagePercent = 0;
        let totalDisk = 0;
        let freeDisk = 0;
        let usedDisk = 0;

        try {
            // macOS uses df -h, Ubuntu also uses df -h. -k for 1K-blocks to be safe for parsing
            const command = os.platform() === 'win32' ? 'wmic logicaldisk get size,freespace,caption' : "df -k / | tail -1 | awk '{print $2, $3, $4, $5}'";
            const { stdout } = await execAsync(command);

            if (os.platform() !== 'win32') {
                const parts = stdout.trim().split(/\s+/);
                if (parts.length >= 4) {
                    // awk output order depends on the flags we passed. Above: total, used, free, percentage%
                    totalDisk = parseInt(parts[0], 10) * 1024; // Convert KB to Bytes
                    usedDisk = parseInt(parts[1], 10) * 1024;
                    freeDisk = parseInt(parts[2], 10) * 1024;
                    diskUsagePercent = parseInt(parts[3].replace('%', ''), 10);
                }
            }
        } catch (diskErr) {
            console.warn('Could not fetch disk space:', diskErr);
        }

        return NextResponse.json({
            cpu: {
                cores: os.cpus().length,
                usagePercent: cpuUsagePercent,
                model: os.cpus()[0]?.model || 'Unknown',
            },
            memory: {
                total: totalMemory,
                free: freeMemory,
                used: usedMemory,
                usagePercent: memoryUsagePercent,
            },
            disk: {
                total: totalDisk,
                free: freeDisk,
                used: usedDisk,
                usagePercent: diskUsagePercent,
            },
            uptime: os.uptime(),
            platform: os.platform(),
            release: os.release()
        });

    } catch (error: any) {
        console.error('System Monitor error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch system data' }, { status: 500 });
    }
}
