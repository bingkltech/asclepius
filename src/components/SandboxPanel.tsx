// SandboxPanel.tsx — Agent Isolation Chamber panel
// Extracted from App.tsx to reduce monolith size.

import React from 'react';
import { Boxes } from 'lucide-react';
import { Button } from './ui';

interface SandboxPanelProps {
  onDeployToFleet: () => void;
}

export function SandboxPanel({ onDeployToFleet }: SandboxPanelProps) {
  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-3">
            <Boxes className="w-6 h-6 text-violet-400" /> Agent Sandbox
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Safely isolate and test agent reasoning, skill execution, and API endpoints before deploying to the Fleet.</p>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center border-2 border-dashed border-zinc-800/80 rounded-2xl bg-gradient-to-b from-zinc-900/40 to-[#09090b] shadow-inner relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
         <div className="flex flex-col items-center justify-center text-zinc-500 max-w-md text-center p-8">
           <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 shadow-2xl relative">
             <Boxes className="w-10 h-10 text-violet-500/50" />
             <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
           </div>
           <h2 className="text-xl font-bold text-zinc-200 mb-3 tracking-tight">Isolation Chamber Ready</h2>
           <p className="text-sm text-zinc-400 leading-relaxed">The simulation environment is active. You can now select an agent from your fleet to conduct experimental dry-runs without affecting production codebases.</p>
           <Button onClick={onDeployToFleet} className="mt-8 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/30 transition-all">
             Deploy Agent to Sandbox
           </Button>
         </div>
      </div>
    </div>
  );
}
