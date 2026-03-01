'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Github, Globe, Server, RefreshCw, AlertCircle } from "lucide-react";

interface Asset {
    id: number;
    name: string;
    url: string;
    size: number;
}

interface Release {
    id: number;
    name: string;
    published_at: string;
    tarball_url: string;
    assets: Asset[];
}

interface Project {
    id: number;
    project_name: string;
    github_repo: string;
    domain_name: string;
    deploy_path: string;
    current_version: string;
    updated_at: string;
}

export default function HostingPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [nginxStatus, setNginxStatus] = useState<string>('checking...');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showCommandsModal, setShowCommandsModal] = useState(false);
    const [deployCommands, setDeployCommands] = useState<string[]>([]);

    // Form / Modal State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [newProject, setNewProject] = useState({
        project_name: '',
        github_repo: '',
        pat_token: '',
        domain_name: '',
        deploy_path: '/tmp/hosting/'
    });

    // Deploy Form State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [releases, setReleases] = useState<Release[]>([]);
    const [loadingReleases, setLoadingReleases] = useState(false);
    const [deploying, setDeploying] = useState(false);

    useEffect(() => {
        fetchProjects();
        checkNginxStatus();
    }, []);

    const fetchProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/hosting');
            const data = await res.json();
            if (res.ok) {
                setProjects(data.projects || []);
            }
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const checkNginxStatus = async () => {
        try {
            const res = await fetch('/api/system/nginx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'status' })
            });
            const data = await res.json();
            setNginxStatus(data.status);
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    };

    const handleOpenCreateModal = () => {
        setIsEditing(false);
        setEditingId(null);
        setNewProject({
            project_name: '',
            github_repo: '',
            pat_token: '',
            domain_name: '',
            deploy_path: '/tmp/hosting/'
        });
        setShowCreateModal(true);
    };

    const handleOpenEditModal = (project: Project) => {
        setIsEditing(true);
        setEditingId(project.id);
        setNewProject({
            project_name: project.project_name,
            github_repo: project.github_repo,
            pat_token: '***', // Mask token for security, handle in backend
            domain_name: project.domain_name,
            deploy_path: project.deploy_path
        });
        setShowCreateModal(true);
    };

    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const method = isEditing ? 'PUT' : 'POST';
            const body = isEditing ? { ...newProject, id: editingId } : newProject;

            const res = await fetch('/api/hosting', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setShowCreateModal(false);
                fetchProjects();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to save project');
            }
        } catch (error) {
            alert('An error occurred');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this project? Existing files will not be deleted.')) return;

        try {
            const res = await fetch(`/api/hosting?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchProjects();
        } catch (error) {
            console.error(error);
        }
    };

    const handleOpenDeploy = async (project: Project) => {
        setSelectedProject(project);
        setShowDeployModal(true);
        setReleases([]);
        setLoadingReleases(true);

        try {
            // Fetch releases via backend API. Backend will look up PAT from SQLite using projectId automatically.
            const res = await fetch(`/api/hosting?action=releases&repo=${project.github_repo}&projectId=${project.id}`);
            const data = await res.json();

            if (res.ok) {
                setReleases(data.releases || []);
            } else {
                alert(data.error || 'Failed to fetch releases');
            }
        } catch (err: unknown) {
            alert('An error occurred');
        } finally {
            setLoadingReleases(false);
        }
    };

    const handleDeploy = async (release: Release, assetUrl?: string) => {
        if (!selectedProject) return;

        if (!confirm(`Deploy version ${release.name} to ${selectedProject.domain_name}?`)) return;

        setDeploying(true);
        try {
            // 1. Download & Extract
            const deployRes = await fetch('/api/hosting/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedProject.id,
                    asset_url: assetUrl || null,
                    tarball_url: release.tarball_url,
                    version: release.name
                })
            });

            const deployData = await deployRes.json();
            if (!deployRes.ok) throw new Error(deployData.error);

            // 2. Generate NGINX & Reload
            const nginxRes = await fetch('/api/system/nginx', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    projectId: selectedProject.id
                })
            });

            const nginxData = await nginxRes.json();
            if (!nginxRes.ok) throw new Error(nginxData.error);

            if (nginxData.commands) {
                setDeployCommands(nginxData.commands);
                setShowCommandsModal(true);
            } else {
                alert('Deployment successful!');
            }

            setShowDeployModal(false);
            fetchProjects();

        } catch (error: unknown) {
            const err = error as Error;
            alert(`Deployment failed: ${err.message}`);
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Auto Web Hosting</h1>
                    <p className="text-muted-foreground mt-2">Manage GitHub repositories, Deployments, and NGINX configs.</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 bg-secondary/50 px-4 py-2 rounded-md border border-border">
                        <Server className="w-4 h-4 text-primary" />
                        <span className="text-sm">NGINX:</span>
                        <span className={`text-sm font-bold ${nginxStatus === 'active' ? 'text-green-500' : 'text-yellow-500'}`}>
                            {nginxStatus}
                        </span>
                    </div>
                    <Button onClick={handleOpenCreateModal}>
                        <Plus className="w-4 h-4 mr-2" /> New Project
                    </Button>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
                    <Server className="w-5 h-5 text-blue-400" />
                    How NGINX Auto-Config Works
                </h2>
                <div className="text-sm text-slate-400 space-y-3">
                    <p>When you deploy a project, the system downloads and extracts your repository to the <strong className="text-slate-200">Deploy Path (Root)</strong> you specified.</p>
                    <p>It then automatically generates an NGINX <code className="bg-black px-1.5 py-0.5 rounded text-pink-400">.conf</code> file and places it in <code className="bg-black px-1.5 py-0.5 rounded">/tmp/</code> for safety. You will be provided with a set of <code className="text-green-400">sudo</code> commands to run manually in the terminal to enable the site.</p>
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                        <strong className="text-slate-200 flex items-center gap-2 mb-2"><Globe className="w-4 h-4" /> Global Supabase Proxy</strong>
                        <p className="mb-2">Your site configurations are generated to automatically include a shared proxy configuration. For this to work, you must create a master snippet file on your server <strong>once</strong>.</p>
                        <p>Create the file: <code className="bg-black text-blue-400 px-1.5 py-0.5 rounded">sudo nano /etc/nginx/snippets/supabase-proxy.conf</code> and add the following:</p>
                        <pre className="bg-black p-3 mt-2 rounded border border-slate-800 text-xs overflow-x-auto text-emerald-400">
                            {`location ~ ^/(rest|auth|storage|functions|realtime)/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
}`}
                        </pre>
                    </div>
                    <div className="mt-4 text-amber-500 bg-amber-500/10 p-4 rounded-lg border border-amber-500/20 space-y-2">
                        <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            Important: Directory Permissions (403 Forbidden Error)
                        </div>
                        <p className="text-sm text-amber-500/90">
                            By default, NGINX runs as <code>www-data</code>. If your Deploy Path is inside a user's home directory (e.g., <code>/home/user/project</code>), NGINX will not be able to read it and will throw a 403 error.
                        </p>
                        <p className="text-sm text-amber-500/90">
                            To fix this, you must add <code>www-data</code> to your user's group and grant execute (+x) permissions to the directory path so NGINX can traverse it:
                        </p>
                        <pre className="bg-black/50 p-3 rounded text-xs font-mono overflow-x-auto border border-amber-500/20 mt-2 text-amber-400">
                            {`sudo usermod -aG your_user www-data
sudo chmod g+x /home/your_user
sudo chmod g+x /home/your_user/your_project
sudo systemctl restart nginx`}
                        </pre>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading projects...</div>
            ) : projects.length === 0 ? (
                <Card className="border-dashed bg-transparent border-slate-700">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                        <Globe className="w-12 h-12 mb-4 opacity-30" />
                        <p>No projects found. Create one to get started.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(p => (
                        <Card key={p.id} className="relative overflow-hidden group">
                            <CardHeader className="pb-4">
                                <CardTitle className="flex justify-between items-center">
                                    <span className="truncate pr-4">{p.project_name}</span>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(p)} className="h-8 w-8 text-blue-400 opacity-70 hover:opacity-100">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive opacity-70 hover:opacity-100">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <div className="space-y-2 mt-4 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground break-all">
                                        <Github className="w-4 h-4 min-w-[16px]" />
                                        {p.github_repo}
                                    </div>
                                    <div className="flex items-center gap-2 text-primary break-all">
                                        <Globe className="w-4 h-4 min-w-[16px]" />
                                        <a href={`http://${p.domain_name}`} target="_blank" rel="noreferrer" className="hover:underline">
                                            {p.domain_name}
                                        </a>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="bg-secondary/20 pt-4 border-t border-border mt-auto">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="text-xs text-muted-foreground mb-1">Current Version</div>
                                        <div className="font-mono text-sm">{p.current_version}</div>
                                    </div>
                                    <Button onClick={() => handleOpenDeploy(p)}>
                                        <RefreshCw className="w-4 h-4 mr-2" /> Deploy
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>{isEditing ? 'Edit Hosting Project' : 'Create Hosting Project'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSaveProject} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Project Name</label>
                                    <Input required disabled={isEditing} value={newProject.project_name} onChange={e => setNewProject({ ...newProject, project_name: e.target.value })} placeholder="my-awesome-site" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">GitHub Repo <span className="text-muted-foreground text-xs">(owner/repo)</span></label>
                                    <Input required value={newProject.github_repo} onChange={e => setNewProject({ ...newProject, github_repo: e.target.value })} placeholder="facebook/react" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Personal Access Token <span className="text-muted-foreground text-xs">(Optional for private repos)</span></label>
                                    <Input type={isEditing && newProject.pat_token === '***' ? 'text' : 'password'} value={newProject.pat_token} onChange={e => setNewProject({ ...newProject, pat_token: e.target.value })} placeholder={isEditing ? "(Leave unchanged to keep current token)" : "ghp_..."} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Domain Name</label>
                                        <Input required value={newProject.domain_name} onChange={e => setNewProject({ ...newProject, domain_name: e.target.value })} placeholder="myapp.com" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Deploy Path (Root)</label>
                                        <Input required value={newProject.deploy_path} onChange={e => setNewProject({ ...newProject, deploy_path: e.target.value })} />
                                    </div>
                                </div>

                                <div className="p-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-md flex items-start gap-3 mt-6">
                                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                    <div className="text-sm">
                                        When you deploy, NGINX config will be automatically generated. Make sure your DNS A-Record points to this server.
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                                    <Button type="submit">Save Project</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Deploy Modal */}
            {showDeployModal && selectedProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <CardHeader>
                            <CardTitle>Deploy: {selectedProject.project_name}</CardTitle>
                            <p className="text-sm text-muted-foreground">Select a GitHub release/tag to deploy to {selectedProject.domain_name}</p>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
                            {loadingReleases ? (
                                <div className="text-center py-12">Fetching releases from GitHub...</div>
                            ) : releases.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">No releases or tags found for {selectedProject.github_repo}.</div>
                            ) : (
                                <div className="space-y-3">
                                    {releases.map(r => (
                                        <div key={r.id} className="flex flex-col p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold text-lg">{r.name}</div>
                                                    {r.published_at && <div className="text-xs text-muted-foreground mt-1">Published: {new Date(r.published_at).toLocaleString()}</div>}
                                                </div>
                                            </div>

                                            {/* Show Assets if any, otherwise fallback to source code deploy */}
                                            {r.assets && r.assets.length > 0 ? (
                                                <div className="mt-3 space-y-2 border-t border-border pt-3">
                                                    <div className="text-xs text-muted-foreground font-medium mb-2">Compiled Assets (Recommended)</div>
                                                    {r.assets.map(asset => (
                                                        <div key={asset.id} className="flex justify-between items-center bg-secondary/30 p-2 rounded text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Server className="w-4 h-4 text-emerald-500" />
                                                                <span className="font-mono">{asset.name}</span>
                                                                <span className="text-xs text-muted-foreground">({(asset.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                disabled={deploying}
                                                                onClick={() => handleDeploy(r, asset.url)}
                                                                variant={selectedProject.current_version === r.name && asset.name.includes('build') ? "outline" : "default"}
                                                            >
                                                                {deploying ? 'Deploying...' : 'Deploy Asset'}
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-4 flex justify-between items-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                    <div className="text-sm text-red-400">
                                                        <AlertCircle className="w-4 h-4 inline mr-2 text-red-500" />
                                                        No build assets found. Deploying from Source Code.
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        disabled={deploying}
                                                        onClick={() => handleDeploy(r, undefined)}
                                                        variant="destructive"
                                                    >
                                                        {deploying ? 'Deploying...' : 'Deploy Source Code'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                        <div className="p-6 pt-0 mt-auto border-t border-border bg-card flex justify-end">
                            <Button variant="outline" disabled={deploying} onClick={() => setShowDeployModal(false)}>Close</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Commands Modal */}
            {showCommandsModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border-primary/50">
                        <CardHeader>
                            <CardTitle className="text-emerald-500 flex items-center gap-2">
                                <AlertCircle className="w-6 h-6" /> Deployment Extracted Successfully!
                            </CardTitle>
                            <p className="text-sm text-muted-foreground mt-2">
                                The source code has been downloaded and extracted to the target directory.
                                NGINX configuration has been generated safely in <code className="bg-neutral-800 px-1 py-0.5 rounded">/tmp/</code>.
                                <br /><br />To activate this site, please run the following commands manually with root privileges (sudo):
                            </p>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
                            <div className="bg-black border border-neutral-800 p-4 rounded-xl font-mono text-sm text-blue-400 whitespace-pre overflow-x-auto">
                                {deployCommands.map((cmd, i) => (
                                    <div key={i} className="mb-2 hover:bg-white/5 px-2 rounded -mx-2 py-1 transition-colors">$ {cmd}</div>
                                ))}
                            </div>
                        </CardContent>
                        <div className="p-6 pt-0 mt-auto border-t border-border bg-card flex justify-end">
                            <Button onClick={() => setShowCommandsModal(false)}>Understood</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
