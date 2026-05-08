// ═══════════════════════════════════════════════════════════════
// src/components/ui.tsx — Shared UI primitives for Asclepius panels
// ═══════════════════════════════════════════════════════════════
// Extracted from App.tsx to enable reuse across panel components.
// These are lightweight internal components — not a UI library.

import React from 'react';
import { cn } from '../lib/utils';

// ─── Button ──────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'icon';
}

export const Button = ({ children, variant = 'default', size = 'default', className, ...props }: ButtonProps) => {
  const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost:   "hover:bg-accent hover:text-accent-foreground",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  };
  const sizes: Record<string, string> = {
    default: "h-10 px-4 py-2",
    sm:      "h-9 rounded-md px-3",
    icon:    "h-10 w-10",
  };
  return (
    <button className={cn(baseStyle, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};
