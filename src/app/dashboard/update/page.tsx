"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { DownloadCloud, RefreshCw, AlertTriangle, CheckCircle, TerminalSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UpdateSystemPage() {
    const router = useRouter();
    const [status, setStatus] = useState<"checking" | "idle" | "updating" | "restarting">("checking");
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Output logs for the "terminal" feel during update
    const [logs, setLogs] = useState<string[]>([]);

    const appendLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    const checkUpdate = async () => {
        setStatus("checking");
        setErrorMsg("");
        try {
            const res = await axios.get("/api/system/update");
            setUpdateInfo(res.data);
            setStatus("idle");
        } catch (error: any) {
            setErrorMsg(error.response?.data?.error || error.message || "Failed to check for updates");
            setStatus("idle");
        }
    };

    useEffect(() => {
        checkUpdate();
    }, []);

    const handleUpdate = async () => {
        if (!confirm("Are you sure you want to apply this update? The system will restart automatically.")) return;

        setStatus("updating");
        setErrorMsg("");
        setLogs([]);
        appendLog("Initiating update sequence...");
        appendLog(`Target Version: v${updateInfo.latestVersion}`);
        appendLog("Downloading bundle from GitHub Releases...");

        try {
            const res = await axios.post("/api/system/update", {
                downloadUrl: updateInfo.downloadUrl
            });

            appendLog(res.data.message || "Update extracted. Server is restarting now...");
            setStatus("restarting");

            // Ping server until it comes back online
            let retries = 0;
            const pingInterval = setInterval(async () => {
                try {
                    retries++;
                    appendLog(`Waiting for server to come back online... (Attempt ${retries})`);
                    await axios.get("/api/system/update", { timeout: 2000 });
                    // If we get here, server is back!
                    clearInterval(pingInterval);
                    appendLog("Server is online! Reloading dashboard in 3 seconds...");
                    setTimeout(() => router.refresh(), 3000);
                } catch (e) {
                    if (retries > 20) {
                        clearInterval(pingInterval);
                        appendLog("Server is taking too long to respond. Please refresh manually.");
                    }
                }
            }, 3000);


        } catch (error: any) {
            const errDetail = error.response?.data?.error || error.message || "Update failed";
            setErrorMsg(errDetail);
            appendLog(`ERROR: ${errDetail}`);
            setStatus("idle");
        }
    };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                        System Update
                    </h1>
                    <p className="text-gray-400 mt-1">Check for new releases and apply patches automatically via GitHub.</p>
                </div>
                <button
                    onClick={checkUpdate}
                    disabled={status !== "idle"}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={18} className={status === "checking" ? "animate-spin" : ""} />
                    Check Now
                </button>
            </div>

            {errorMsg && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-start gap-3">
                    <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                    <p>{errorMsg}</p>
                </div>
            )}

            {status === "checking" && !updateInfo && (
                <div className="p-12 text-center text-slate-400 animate-pulse">
                    Connecting to GitHub API to check for updates...
                </div>
            )}

            {updateInfo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Version Card */}
                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shrink-0">
                        <h2 className="text-xl font-semibold text-white mb-6">Version Information</h2>

                        <div className="space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                                <span className="text-slate-400">Current Version</span>
                                <span className="font-mono text-lg text-slate-200">v{updateInfo.currentVersion}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                                <span className="text-slate-400">Latest Version (GitHub)</span>
                                <span className="font-mono text-lg text-emerald-400 font-bold">
                                    v{updateInfo.latestVersion}
                                </span>
                            </div>

                            {updateInfo.hasUpdate ? (
                                <div className="pt-2">
                                    <div className="flex items-center gap-2 text-amber-400 mb-4 bg-amber-400/10 px-3 py-2 rounded-lg text-sm border border-amber-400/20">
                                        <AlertTriangle size={16} />
                                        <span>A new system update is available!</span>
                                    </div>
                                    <button
                                        onClick={handleUpdate}
                                        disabled={status !== "idle"}
                                        className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <DownloadCloud size={20} />
                                        {status === "idle" ? "Apply Update & Restart" : "Installing Update..."}
                                    </button>
                                </div>
                            ) : (
                                <div className="pt-2">
                                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-2 rounded-lg border border-emerald-400/20">
                                        <CheckCircle size={18} />
                                        <span>Your system is up to date!</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Release Notes / Console */}
                    <div className="bg-[#0D1117] border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 p-4 border-b border-slate-800 bg-black/40 text-slate-400">
                            {status === "idle" ? <CheckCircle size={16} /> : <TerminalSquare size={16} />}
                            <span className="text-sm font-medium">
                                {status === "idle" ? "Release Notes" : "Installation Console"}
                            </span>
                        </div>
                        <div className="p-4 flex-1 min-h-[300px] overflow-y-auto">
                            {status === "idle" ? (
                                <div className="text-sm text-slate-300 whitespace-pre-wrap font-sans">
                                    {updateInfo.releaseNotes || "No release notes available."}
                                </div>
                            ) : (
                                <div className="font-mono text-sm text-green-400 space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i}>{log}</div>
                                    ))}
                                    {status === "restarting" && (
                                        <div className="animate-pulse mt-2 text-cyan-400">_</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
