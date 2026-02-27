import { NextRequest, NextResponse } from 'next/server';
import { dbGet, dbRun } from '@/lib/db';
import axios from 'axios';

// ลบ Project
export async function DELETE(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        await dbRun('DELETE FROM hosting_projects WHERE id = ?', [id]);
        return NextResponse.json({ message: 'Project deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// อัปเดตข้อมูล Project หรือดึงเนื้อหา
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');

        // ดึงรายการ Project ทั้งหมด
        if (!action || action === 'list') {
            const projects = await new Promise((resolve, reject) => {
                const sqlite3 = require('sqlite3').verbose();
                const db = new sqlite3.Database('./management.db');
                db.all('SELECT * FROM hosting_projects ORDER BY updated_at DESC', (err: any, rows: any) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            return NextResponse.json({ projects });
        }

        // ดึง Release / Tags จาก GitHub
        if (action === 'releases') {
            const repo = url.searchParams.get('repo');
            const token = url.searchParams.get('token');

            if (!repo) {
                return NextResponse.json({ error: 'Repository name required (owner/repo)' }, { status: 400 });
            }

            const headers: any = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Supabase-Manager-App'
            };

            if (token) {
                // TODO: ในอนาคตถ้าเก็บ PAT แบบเข้ารหัส ต้องถอดรหัสก่อน
                headers['Authorization'] = `token ${token}`;
            }

            try {
                // Fetch releases
                const response = await axios.get(`https://api.github.com/repos/${repo}/releases`, { headers });

                // Map only what we need
                const releases = response.data.map((r: any) => ({
                    id: r.id,
                    name: r.name || r.tag_name,
                    tag_name: r.tag_name,
                    published_at: r.published_at,
                    tarball_url: r.tarball_url,
                    body: r.body
                }));

                return NextResponse.json({ releases });
            } catch (githubError: any) {
                console.error("Github fetch error:", githubError?.response?.data || githubError.message);

                // ถ้าไม่มี Release เลย (เช่น Repo ใหม่) ให้ลองไปถึง Tags แทน
                if (githubError?.response?.status === 404 || (githubError?.response?.data && Array.isArray(githubError.response.data) && githubError.response.data.length === 0)) {
                    try {
                        const tagsResponse = await axios.get(`https://api.github.com/repos/${repo}/tags`, { headers });
                        const tags = tagsResponse.data.map((t: any) => ({
                            id: t.commit.sha,
                            name: t.name,
                            tag_name: t.name,
                            published_at: null, // Tags endpoint doesn't return date directly
                            tarball_url: t.tarball_url,
                            body: 'Tag commit ' + t.commit.sha.substring(0, 7)
                        }));
                        return NextResponse.json({ releases: tags });
                    } catch (tagError: any) {
                        return NextResponse.json({ error: 'Repository not found, no releases, or invalid token' }, { status: 404 });
                    }
                }

                return NextResponse.json({ error: 'Failed to fetch GitHub releases: ' + (githubError?.response?.data?.message || githubError.message) }, { status: 400 });
            }
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// สร้าง Project ใหม่ 
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { project_name, github_repo, pat_token, domain_name, deploy_path } = body;

        if (!project_name || !github_repo || !domain_name || !deploy_path) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check if project exists
        const existing = await dbGet('SELECT id FROM hosting_projects WHERE project_name = ?', [project_name]);
        if (existing) {
            return NextResponse.json({ error: 'Project name already exists' }, { status: 409 });
        }

        await dbRun(`
            INSERT INTO hosting_projects (project_name, github_repo, pat_token, domain_name, deploy_path)
            VALUES (?, ?, ?, ?, ?)
        `, [project_name, github_repo, pat_token || null, domain_name, deploy_path]);

        return NextResponse.json({ message: 'Project created successfully' });
    } catch (error: any) {
        console.error('Create hosting project error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
