/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Google Auth Adapter — Sovereign Agent Identity Service
 * Constitution Article II: Each agent IS a Google Identity.
 * 
 * This service manages the OAuth lifecycle for all agents in the fleet.
 * Jules-Bridge uses this service to orchestrate authentication.
 */

import type { Agent, AgentCredentials, AuthStatus, GoogleIdentity, GitHubIdentity } from '@/src/types';

// ─── Google OAuth Configuration ───
// Env vars are loaded from .env via Vite's import.meta.env
const VITE_GOOGLE_CLIENT_ID = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID) || '';
const VITE_GOOGLE_REDIRECT_URI = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_REDIRECT_URI) || `${window.location.origin}/auth/callback`;

const GOOGLE_AUTH_CONFIG = {
  clientId: VITE_GOOGLE_CLIENT_ID,
  redirectUri: VITE_GOOGLE_REDIRECT_URI,
  scopes: {
    jules: 'https://www.googleapis.com/auth/jules',
    gmail: 'https://www.googleapis.com/auth/gmail.readonly',
    drive: 'https://www.googleapis.com/auth/drive.file',
    calendar: 'https://www.googleapis.com/auth/calendar.readonly',
    profile: 'https://www.googleapis.com/auth/userinfo.profile',
    email: 'https://www.googleapis.com/auth/userinfo.email',
  },
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};

// Default scopes granted on first auth
const DEFAULT_SCOPES = ['jules', 'profile', 'email'];

// ─── Auth State Types ───
export interface AuthResult {
  success: boolean;
  agentId: string;
  email?: string;
  error?: string;
  authStatus: AuthStatus;
  scopes: string[];
}

export interface ConnectionHealth {
  agentId: string;
  email: string;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  tokenExpiresIn?: number;  // seconds until expiry
  googleConnected: boolean;
  githubConnected: boolean;
  julesConnected: boolean;
  lastRefresh?: string;
}

// ─── Simulated Auth Storage (in-memory for now, encrypted vault in production) ───
const authSessions: Map<string, {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  authenticatedAt: string;
}> = new Map();

/**
 * Initiates Google OAuth flow for an agent.
 * In production, this opens a popup/redirect to Google's OAuth consent screen.
 * Currently simulated for development — returns mock credentials.
 * 
 * @param agent The agent to authenticate
 * @param requestedScopes Optional scopes to request (defaults to jules + profile)
 * @returns AuthResult with the authentication outcome
 */
export async function initiateGoogleAuth(
  agent: Agent,
  requestedScopes: string[] = DEFAULT_SCOPES
): Promise<AuthResult> {
  const email = agent.credentials?.email;
  
  if (!email) {
    return {
      success: false,
      agentId: agent.id,
      error: 'Agent has no email identity configured',
      authStatus: 'error',
      scopes: [],
    };
  }

  // Simulate the OAuth flow with a delay
  console.log(`[GoogleAuth] Initiating OAuth for ${agent.name} (${email})...`);
  console.log(`[GoogleAuth] Requested scopes: ${requestedScopes.join(', ')}`);

  // In production: window.open(buildAuthUrl(email, requestedScopes))
  // For now: simulate a successful authentication
  await new Promise(resolve => setTimeout(resolve, 1500));

  const now = Date.now();
  const session = {
    accessToken: `ya29.${agent.id}_${Math.random().toString(36).slice(2, 20)}`,
    refreshToken: `1//${agent.id}_${Math.random().toString(36).slice(2, 20)}`,
    expiresAt: now + (3600 * 1000), // 1 hour from now
    scopes: requestedScopes,
    authenticatedAt: new Date().toISOString(),
  };

  authSessions.set(agent.id, session);

  console.log(`[GoogleAuth] ✅ ${agent.name} authenticated as ${email}`);

  return {
    success: true,
    agentId: agent.id,
    email,
    authStatus: 'authenticated',
    scopes: requestedScopes,
  };
}

/**
 * Builds the updated credentials object for an agent after successful auth.
 * This should be merged into the agent's state.
 */
export function buildAuthenticatedCredentials(
  currentCredentials: AgentCredentials,
  authResult: AuthResult
): AgentCredentials {
  const session = authSessions.get(authResult.agentId);
  
  return {
    ...currentCredentials,
    isAuthenticated: authResult.success,
    authStatus: authResult.authStatus,
    authenticatedAt: authResult.success ? new Date().toISOString() : currentCredentials.authenticatedAt,
    google: {
      ...currentCredentials.google,
      accessToken: session?.accessToken,
      refreshToken: session?.refreshToken,
      expiresAt: session?.expiresAt,
      scopes: authResult.scopes,
      quotaUsed: currentCredentials.google?.quotaUsed || 0,
      lastRefreshedAt: new Date().toISOString(),
    },
  };
}

/**
 * Refreshes an expired access token using the stored refresh token.
 * Called automatically by Jules-Bridge's Auth Orchestrator.
 */
export async function refreshAgentToken(agentId: string): Promise<boolean> {
  const session = authSessions.get(agentId);
  if (!session?.refreshToken) {
    console.warn(`[GoogleAuth] No refresh token for agent ${agentId}`);
    return false;
  }

  console.log(`[GoogleAuth] Refreshing token for agent ${agentId}...`);

  // Simulate token refresh
  await new Promise(resolve => setTimeout(resolve, 500));

  const now = Date.now();
  authSessions.set(agentId, {
    ...session,
    accessToken: `ya29.${agentId}_refreshed_${Math.random().toString(36).slice(2, 20)}`,
    expiresAt: now + (3600 * 1000), // New 1-hour token
  });

  console.log(`[GoogleAuth] ✅ Token refreshed for agent ${agentId}`);
  return true;
}

/**
 * Checks if an agent's token is still valid.
 */
export function isTokenValid(agentId: string): boolean {
  const session = authSessions.get(agentId);
  if (!session) return false;
  return session.expiresAt > Date.now();
}

/**
 * Gets the time remaining until token expiry (in seconds).
 */
export function getTokenExpirySeconds(agentId: string): number | undefined {
  const session = authSessions.get(agentId);
  if (!session) return undefined;
  const remaining = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
  return remaining;
}

/**
 * Disconnects an agent's Google OAuth session.
 */
export function disconnectGoogleAuth(agentId: string): void {
  authSessions.delete(agentId);
  console.log(`[GoogleAuth] Disconnected agent ${agentId}`);
}

/**
 * Gets the connection health summary for all agents.
 * Used by Jules-Bridge's Auth Orchestrator for fleet-wide monitoring.
 */
export function getFleetConnectionHealth(agents: Agent[]): ConnectionHealth[] {
  return agents.map(agent => {
    const creds = agent.credentials;
    const session = authSessions.get(agent.id);
    const tokenExpiry = getTokenExpirySeconds(agent.id);

    return {
      agentId: agent.id,
      email: creds?.email || 'unprovisioned',
      isAuthenticated: creds?.isAuthenticated || false,
      authStatus: creds?.authStatus || 'unauthenticated',
      tokenExpiresIn: tokenExpiry,
      googleConnected: !!(creds?.isAuthenticated && session && isTokenValid(agent.id)),
      githubConnected: creds?.github?.isConnected || false,
      julesConnected: agent.julesConfig?.status === 'connected',
      lastRefresh: creds?.google?.lastRefreshedAt,
    };
  });
}

/**
 * Simulates connecting a GitHub account for an agent.
 */
export async function connectGitHub(
  agent: Agent,
  token: string,
  username: string
): Promise<GitHubIdentity> {
  console.log(`[GitHubAuth] Connecting ${agent.name} as @${username}...`);
  await new Promise(resolve => setTimeout(resolve, 800));

  return {
    token,
    username,
    scope: ['repo', 'read:user', 'read:org'],
    isConnected: true,
  };
}

/**
 * Formats the auth status for display.
 */
export function getAuthStatusDisplay(status: AuthStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: 'check' | 'loading' | 'warning' | 'error' | 'lock';
} {
  switch (status) {
    case 'authenticated':
      return { label: 'Connected', color: 'text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20', icon: 'check' };
    case 'authenticating':
      return { label: 'Connecting...', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', icon: 'loading' };
    case 'expired':
      return { label: 'Expired', color: 'text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20', icon: 'warning' };
    case 'error':
      return { label: 'Auth Error', color: 'text-rose-400', bgColor: 'bg-rose-500/10 border-rose-500/20', icon: 'error' };
    case 'unauthenticated':
    default:
      return { label: 'Not Connected', color: 'text-zinc-400', bgColor: 'bg-zinc-500/10 border-zinc-500/20', icon: 'lock' };
  }
}
