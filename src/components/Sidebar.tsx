/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  LayoutDashboard,
  Users,
  Code2,
  Terminal,
  Settings,
  Github,
  Boxes,
  TerminalSquare,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
  FolderGit2,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Users },
  { id: "projects", label: "Projects", icon: FolderGit2 },
  { id: "command", label: "God Orchestrator", icon: TerminalSquare },
  { id: "scheduler", label: "Task Scheduler", icon: Clock },
  { id: "sandbox", label: "Sandbox", icon: Boxes },
  { id: "chronicle", label: "Chronicle", icon: Brain },
  { id: "logs", label: "System Logs", icon: Terminal },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        "relative flex flex-col border-r border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-300 ease-in-out",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-border/50", collapsed && "justify-center px-0")}>
        <div className="relative w-8 h-8 shrink-0">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 opacity-80" />
          <div className="absolute inset-0 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight">Asclepius</span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Agent Platform
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 mb-3">
            <span className="text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/60">
              Navigation
            </span>
          </div>
        )}
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const button = (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "sidebar-link w-full flex items-center gap-3 rounded-lg px-3 h-9 text-sm transition-all",
                collapsed && "justify-center px-0",
                isActive
                  ? "active bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              )}
            >
              <item.icon
                className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger >{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }
          return button;
        })}
      </div>

      {/* Bottom integrations */}
      <div className={cn("border-t border-border/50 p-3 space-y-3", collapsed && "px-2")}>
        {!collapsed && (
          <div className="px-1">
            <span className="text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/60">
              Integrations
            </span>
          </div>
        )}
        <div className="space-y-0.5">
          {[
            { icon: Github, label: "GitHub" },
            { icon: Terminal, label: "CLI" },
          ].map((item) => {
            const link = (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-3 px-3 h-8 rounded-lg text-xs text-muted-foreground/60 hover:text-muted-foreground cursor-pointer transition-colors",
                  collapsed && "justify-center px-0"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </div>
            );
            if (collapsed) {
              return (
                <Tooltip key={item.label}>
                  <TooltipTrigger >{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return link;
          })}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-card border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all z-20 shadow-lg"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}
