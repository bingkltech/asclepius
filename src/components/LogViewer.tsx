/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SystemLogEntry } from "@/src/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal, Circle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/src/services/neuralVault";

const typeColors: Record<string, string> = {
  error: "text-rose-400",
  critical: "text-rose-500 font-bold",
  warning: "text-amber-400",
  success: "text-emerald-400",
  info: "text-sky-300/80",
  debug: "text-zinc-500",
};

const typeDots: Record<string, string> = {
  error: "bg-rose-500",
  critical: "bg-rose-600 animate-pulse",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  info: "bg-sky-500/60",
  debug: "bg-zinc-600",
};

export function LogViewer() {
  const logs = useLiveQuery(() => db.systemLogs.orderBy('timestamp').reverse().limit(100).toArray(), []) || [];

  return (
    <div className="flex flex-col h-full bg-[hsl(228,16%,5%)] text-zinc-400 font-mono text-xs border border-border/30 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[hsl(228,14%,7%)] border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="uppercase tracking-[0.15em] text-[9px] font-bold text-muted-foreground/50 ml-2">
            System Logs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-dot-pulse" />
          <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>

      {/* Log Stream */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-0.5">
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, height: 0, x: -8 }}
                animate={{ opacity: 1, height: "auto", x: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-white/[0.02] transition-colors group"
              >
                {/* Status dot */}
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 shrink-0", typeDots[log.severity] || typeDots.info)} />

                {/* Timestamp */}
                <span className="text-[10px] text-muted-foreground/30 shrink-0 tabular-nums w-[65px]">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>

                {/* Source/Agent */}
                <span className="text-violet-400/70 shrink-0 font-medium text-[10px] w-[90px] truncate" title={log.category}>
                  {log.source}
                </span>

                {/* Message */}
                <span
                  className={cn(
                    "text-[11px] leading-relaxed break-words pr-2",
                    typeColors[log.severity] || typeColors.info
                  )}
                >
                  {log.message}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>

          {logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/20 space-y-3">
              <Terminal className="w-8 h-8" />
              <p className="text-[10px] uppercase tracking-widest">
                No logs available. Waiting for agent activity...
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
