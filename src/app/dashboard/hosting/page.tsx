'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Github, Globe, Server, RefreshCw, AlertCircle } from "lucide-react";

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

    // Create Form State
    const [newProject, setNewProject] = useState({
        project_name: '',
        github_repo: '',
        pat_token: '',
        domain_name: '',
        deploy_path: '/tmp/hosting/'
    });

    // Deploy Form State
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [releases, setReleases] = useState<any[]>([]);
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
            setNginxStatus('error');
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/hosting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProject)
            });

            if (res.ok) {
                setShowCreateModal(false);
                fetchProjects();
                setNewProject({
                    project_name: '',
                    github_repo: '',
                    pat_token: '',
                    domain_name: '',
                    deploy_path: '/tmp/hosting/'
                });
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create');
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
            // Fetch PAT token securely via another hidden API or get from local response if we sent it
            // For now, assume public repo for simple preview
            const res = await fetch(`/api/hosting?action=releases&repo=${project.github_repo}`);
            const data = await res.json();

            if (res.ok) {
                setReleases(data.releases || []);
            } else {
                alert(data.error || 'Failed to fetch releases');
            }
        } catch (error) {
            alert('An error occurred');
        } finally {
            setLoadingReleases(false);
        }
    };

    const handleDeploy = async (release: any) => {
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

        } catch (error: any) {
            alert(`Deployment failed: ${error.message}`);
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
                    <Button onClick={() => setShowCreateModal(true)}>
                        <Plus className="w-4 h-4 mr-2" /> New Project
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading projects...</div>
            ) : projects.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                        <Globe className="w-12 h-12 mb-4 opacity-50" />
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
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="h-8 w-8 text-destructive">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <div className="space-y-2 mt-4 text-sm">
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <Github className="w-4 h-4" />
                                        {p.github_repo}
                                    </div>
                                    <div className="flex items-center gap-2 text-primary">
                                        <Globe className="w-4 h-4" />
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

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle>Create Hosting Project</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleCreateProject} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Project Name</label>
                                    <Input required value={newProject.project_name} onChange={e => setNewProject({ ...newProject, project_name: e.target.value })} placeholder="my-awesome-site" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">GitHub Repo <span className="text-muted-foreground text-xs">(owner/repo)</span></label>
                                    <Input required value={newProject.github_repo} onChange={e => setNewProject({ ...newProject, github_repo: e.target.value })} placeholder="facebook/react" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Personal Access Token <span className="text-muted-foreground text-xs">(Optional for private repos)</span></label>
                                    <Input type="password" value={newProject.pat_token} onChange={e => setNewProject({ ...newProject, pat_token: e.target.value })} placeholder="ghp_..." />
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
                                        <div key={r.id} className="flex justify-between items-center p-4 border border-border rounded-lg hover:border-primary/50 transition-colors">
                                            <div>
                                                <div className="font-bold text-lg">{r.name}</div>
                                                {r.published_at && <div className="text-xs text-muted-foreground mt-1">Published: {new Date(r.published_at).toLocaleString()}</div>}
                                            </div>
                                            <Button
                                                disabled={deploying}
                                                onClick={() => handleDeploy(r)}
                                                variant={selectedProject.current_version === r.name ? "outline" : "default"}
                                            >
                                                {deploying ? 'Deploying...' : selectedProject.current_version === r.name ? 'Redeploy' : 'Deploy This Version'}
                                            </Button>
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
