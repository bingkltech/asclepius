// ═══════════════════════════════════════════════════════════════════
// ResourceGovernor — CPU/Memory/GPU Adaptive Throttling
// ═══════════════════════════════════════════════════════════════════
// Prevents Asclepius from starving other programs by:
//   1. Monitoring system CPU & memory in real-time
//   2. Enforcing "Below Normal" process priority on Windows
//   3. Providing gate-checks before expensive operations
//   4. Dynamically shrinking Ollama context windows under pressure
//   5. Injecting cooldown pauses between tasks
//
// Design: Singleton — call ResourceGovernor.getInstance()
// ═══════════════════════════════════════════════════════════════════

import os from 'os';
import { execSync } from 'child_process';

// ─── Types ──────────────────────────────────────────────────────────

export interface SystemSnapshot {
  cpuUsagePercent: number;     // 0–100, averaged across all cores
  memoryUsagePercent: number;  // 0–100
  memoryFreeGB: number;
  gpuUsagePercent: number;     // 0–100 (nvidia-smi), -1 if unavailable
  gpuMemoryUsedMB: number;    // -1 if unavailable
  gpuMemoryTotalMB: number;   // -1 if unavailable
  ollamaContextSize: number;  // Adaptive context window recommendation
  throttleLevel: ThrottleLevel;
  timestamp: number;
}

export enum ThrottleLevel {
  NONE = 'NONE',           // System is cool — full speed
  LIGHT = 'LIGHT',         // Slight pressure — add inter-task cooldowns
  MODERATE = 'MODERATE',   // Significant load — reduce context, longer cooldowns
  HEAVY = 'HEAVY',         // Critical — pause new tasks, let system breathe
  EMERGENCY = 'EMERGENCY'  // System nearly locked — abort non-essential work
}

// ─── Thresholds (configurable via env) ──────────────────────────────

const THRESHOLDS = {
  cpu: {
    light:     parseInt(process.env.ASCLEPIUS_CPU_LIGHT     || '50'),
    moderate:  parseInt(process.env.ASCLEPIUS_CPU_MODERATE  || '70'),
    heavy:     parseInt(process.env.ASCLEPIUS_CPU_HEAVY     || '85'),
    emergency: parseInt(process.env.ASCLEPIUS_CPU_EMERGENCY || '95'),
  },
  memory: {
    light:     parseInt(process.env.ASCLEPIUS_MEM_LIGHT     || '60'),
    moderate:  parseInt(process.env.ASCLEPIUS_MEM_MODERATE  || '75'),
    heavy:     parseInt(process.env.ASCLEPIUS_MEM_HEAVY     || '88'),
    emergency: parseInt(process.env.ASCLEPIUS_MEM_EMERGENCY || '95'),
  },
  gpu: {
    light:     parseInt(process.env.ASCLEPIUS_GPU_LIGHT     || '50'),
    moderate:  parseInt(process.env.ASCLEPIUS_GPU_MODERATE  || '70'),
    heavy:     parseInt(process.env.ASCLEPIUS_GPU_HEAVY     || '85'),
    emergency: parseInt(process.env.ASCLEPIUS_GPU_EMERGENCY || '95'),
  }
};

// Ollama context sizes per throttle level
const CONTEXT_SIZES: Record<ThrottleLevel, number> = {
  [ThrottleLevel.NONE]:      parseInt(process.env.OLLAMA_MAX_CTX || '32768'),
  [ThrottleLevel.LIGHT]:     16384,
  [ThrottleLevel.MODERATE]:  8192,
  [ThrottleLevel.HEAVY]:     4096,
  [ThrottleLevel.EMERGENCY]: 2048,
};

// Cooldown durations (ms) between tasks per throttle level
const COOLDOWN_MS: Record<ThrottleLevel, number> = {
  [ThrottleLevel.NONE]:      500,
  [ThrottleLevel.LIGHT]:     3000,
  [ThrottleLevel.MODERATE]:  8000,
  [ThrottleLevel.HEAVY]:     20000,
  [ThrottleLevel.EMERGENCY]: 60000,
};

// LLM timeout per throttle level (ms) — prevent hung requests holding GPU
const LLM_TIMEOUT_MS: Record<ThrottleLevel, number> = {
  [ThrottleLevel.NONE]:      10 * 60 * 1000,  // 10 min
  [ThrottleLevel.LIGHT]:     8  * 60 * 1000,   // 8 min
  [ThrottleLevel.MODERATE]:  5  * 60 * 1000,   // 5 min
  [ThrottleLevel.HEAVY]:     3  * 60 * 1000,   // 3 min
  [ThrottleLevel.EMERGENCY]: 60 * 1000,        // 1 min
};

// ─── CPU Measurement Helpers ────────────────────────────────────────

function getCpuTimes() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += (cpu.times as any)[type];
    }
    totalIdle += cpu.times.idle;
  }
  return { idle: totalIdle / cpus.length, total: totalTick / cpus.length };
}

// ─── GPU Measurement (nvidia-smi) ───────────────────────────────────

interface GpuMetrics {
  usagePercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
}

function queryGpu(): GpuMetrics | null {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits',
      { encoding: 'utf-8', timeout: 5000, windowsHide: true }
    ).trim();
    
    // Parse: "45, 2048, 8192"
    const parts = output.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 3 && parts.every(p => !isNaN(p))) {
      return {
        usagePercent: parts[0],
        memoryUsedMB: parts[1],
        memoryTotalMB: parts[2],
      };
    }
  } catch {
    // nvidia-smi not available or no NVIDIA GPU — silently degrade
  }
  return null;
}

// ─── Singleton Class ────────────────────────────────────────────────

export class ResourceGovernor {
  private static instance: ResourceGovernor | null = null;
  private lastCpuTimes: { idle: number; total: number };
  private lastSnapshot: SystemSnapshot | null = null;
  private prioritySet = false;
  private gpuAvailable: boolean | null = null;

  private constructor() {
    this.lastCpuTimes = getCpuTimes();
    this.enforceProcessPriority();
  }

  static getInstance(): ResourceGovernor {
    if (!this.instance) {
      this.instance = new ResourceGovernor();
    }
    return this.instance;
  }

  // ─── Set Process Priority to Below Normal ───────────────────────
  // This is the single most impactful thing: tells Windows scheduler
  // to deprioritize Asclepius so other apps stay responsive.

  private enforceProcessPriority() {
    if (this.prioritySet) return;
    try {
      const pid = process.pid;
      // Windows: use wmic to set priority to "Below Normal" (16384)
      // Priority values: 64=Low, 16384=Below Normal, 32=Normal, 32768=Above Normal
      execSync(
        `wmic process where ProcessId=${pid} CALL setpriority 16384`,
        { encoding: 'utf-8', timeout: 5000, windowsHide: true }
      );
      console.log(`[ResourceGovernor] ✅ Set process ${pid} to BELOW_NORMAL priority.`);
      this.prioritySet = true;
    } catch (err: any) {
      // Fallback: try PowerShell method
      try {
        const pid = process.pid;
        execSync(
          `powershell -Command "(Get-Process -Id ${pid}).PriorityClass = 'BelowNormal'"`,
          { encoding: 'utf-8', timeout: 5000, windowsHide: true }
        );
        console.log(`[ResourceGovernor] ✅ Set process ${pid} to BELOW_NORMAL priority (PowerShell).`);
        this.prioritySet = true;
      } catch {
        console.warn(`[ResourceGovernor] ⚠️ Could not set process priority. Running at Normal.`);
      }
    }
  }

  // ─── Also lower Ollama's priority if it's running ───────────────

  lowerOllamaPriority() {
    try {
      execSync(
        `powershell -Command "Get-Process ollama*, ollama_llm_server -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'BelowNormal' }"`,
        { encoding: 'utf-8', timeout: 5000, windowsHide: true }
      );
      console.log(`[ResourceGovernor] ✅ Lowered Ollama process priority to BELOW_NORMAL.`);
    } catch {
      // Ollama might not be running — that's fine
    }
  }

  // ─── Take a System Snapshot ─────────────────────────────────────

  async snapshot(): Promise<SystemSnapshot> {
    // CPU measurement (delta since last call)
    const currentCpu = getCpuTimes();
    const idleDelta = currentCpu.idle - this.lastCpuTimes.idle;
    const totalDelta = currentCpu.total - this.lastCpuTimes.total;
    const cpuUsage = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
    this.lastCpuTimes = currentCpu;

    // Memory measurement
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = Math.round((1 - freeMem / totalMem) * 100);
    const freeGB = parseFloat((freeMem / (1024 ** 3)).toFixed(2));

    // GPU measurement (cached availability check)
    let gpuUsage = -1;
    let gpuMemUsed = -1;
    let gpuMemTotal = -1;

    if (this.gpuAvailable === null) {
      const gpu = queryGpu();
      this.gpuAvailable = gpu !== null;
      if (gpu) {
        gpuUsage = gpu.usagePercent;
        gpuMemUsed = gpu.memoryUsedMB;
        gpuMemTotal = gpu.memoryTotalMB;
      }
    } else if (this.gpuAvailable) {
      const gpu = queryGpu();
      if (gpu) {
        gpuUsage = gpu.usagePercent;
        gpuMemUsed = gpu.memoryUsedMB;
        gpuMemTotal = gpu.memoryTotalMB;
      }
    }

    // Determine throttle level (worst of all metrics wins)
    const throttle = this.computeThrottleLevel(cpuUsage, memUsage, gpuUsage);

    const snap: SystemSnapshot = {
      cpuUsagePercent: cpuUsage,
      memoryUsagePercent: memUsage,
      memoryFreeGB: freeGB,
      gpuUsagePercent: gpuUsage,
      gpuMemoryUsedMB: gpuMemUsed,
      gpuMemoryTotalMB: gpuMemTotal,
      ollamaContextSize: CONTEXT_SIZES[throttle],
      throttleLevel: throttle,
      timestamp: Date.now(),
    };

    this.lastSnapshot = snap;
    return snap;
  }

  // ─── Compute Throttle Level ─────────────────────────────────────

  private computeThrottleLevel(cpu: number, mem: number, gpu: number): ThrottleLevel {
    // Take the worst metric to determine the overall throttle
    const levels: ThrottleLevel[] = [];

    // CPU
    if (cpu >= THRESHOLDS.cpu.emergency) levels.push(ThrottleLevel.EMERGENCY);
    else if (cpu >= THRESHOLDS.cpu.heavy) levels.push(ThrottleLevel.HEAVY);
    else if (cpu >= THRESHOLDS.cpu.moderate) levels.push(ThrottleLevel.MODERATE);
    else if (cpu >= THRESHOLDS.cpu.light) levels.push(ThrottleLevel.LIGHT);
    else levels.push(ThrottleLevel.NONE);

    // Memory
    if (mem >= THRESHOLDS.memory.emergency) levels.push(ThrottleLevel.EMERGENCY);
    else if (mem >= THRESHOLDS.memory.heavy) levels.push(ThrottleLevel.HEAVY);
    else if (mem >= THRESHOLDS.memory.moderate) levels.push(ThrottleLevel.MODERATE);
    else if (mem >= THRESHOLDS.memory.light) levels.push(ThrottleLevel.LIGHT);
    else levels.push(ThrottleLevel.NONE);

    // GPU (only if available)
    if (gpu >= 0) {
      if (gpu >= THRESHOLDS.gpu.emergency) levels.push(ThrottleLevel.EMERGENCY);
      else if (gpu >= THRESHOLDS.gpu.heavy) levels.push(ThrottleLevel.HEAVY);
      else if (gpu >= THRESHOLDS.gpu.moderate) levels.push(ThrottleLevel.MODERATE);
      else if (gpu >= THRESHOLDS.gpu.light) levels.push(ThrottleLevel.LIGHT);
      else levels.push(ThrottleLevel.NONE);
    }

    // Worst wins
    const priority = [ThrottleLevel.EMERGENCY, ThrottleLevel.HEAVY, ThrottleLevel.MODERATE, ThrottleLevel.LIGHT, ThrottleLevel.NONE];
    for (const p of priority) {
      if (levels.includes(p)) return p;
    }
    return ThrottleLevel.NONE;
  }

  // ─── Gate Check — Should We Proceed? ────────────────────────────
  // Call this before any expensive operation (LLM call, agent spawn).
  // Returns true if safe, false if we should wait.

  async gateCheck(tag: string = '[ResourceGovernor]'): Promise<boolean> {
    const snap = await this.snapshot();
    
    if (snap.throttleLevel === ThrottleLevel.EMERGENCY) {
      console.warn(`${tag} 🚨 EMERGENCY: CPU=${snap.cpuUsagePercent}%, MEM=${snap.memoryUsagePercent}%, GPU=${snap.gpuUsagePercent}%. BLOCKING new work.`);
      return false;
    }
    
    if (snap.throttleLevel === ThrottleLevel.HEAVY) {
      console.warn(`${tag} ⚠️ HEAVY LOAD: CPU=${snap.cpuUsagePercent}%, MEM=${snap.memoryUsagePercent}%, GPU=${snap.gpuUsagePercent}%. Proceeding with caution.`);
    }

    return true;
  }

  // ─── Wait Until System Cools Down ───────────────────────────────
  // Blocks until throttle drops below HEAVY. Max wait = 5 minutes.

  async waitForCooldown(tag: string = '[ResourceGovernor]', maxWaitMs: number = 5 * 60 * 1000): Promise<void> {
    const startTime = Date.now();
    let waited = false;

    while (Date.now() - startTime < maxWaitMs) {
      const snap = await this.snapshot();
      
      if (snap.throttleLevel !== ThrottleLevel.EMERGENCY && snap.throttleLevel !== ThrottleLevel.HEAVY) {
        if (waited) {
          console.log(`${tag} ✅ System cooled down. Resuming. (Throttle: ${snap.throttleLevel})`);
        }
        return;
      }

      if (!waited) {
        console.warn(`${tag} 🛑 System overloaded (${snap.throttleLevel}). Waiting for cooldown...`);
        waited = true;
      }

      // Wait 10 seconds between checks
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.warn(`${tag} ⏰ Cooldown timeout after ${maxWaitMs / 1000}s. Proceeding anyway.`);
  }

  // ─── Inter-Task Cooldown ────────────────────────────────────────
  // Call between sequential tasks to let the system breathe.

  async interTaskCooldown(tag: string = '[ResourceGovernor]'): Promise<void> {
    const snap = await this.snapshot();
    const cooldown = COOLDOWN_MS[snap.throttleLevel];
    
    if (cooldown > 500) {
      console.log(`${tag} 💤 Inter-task cooldown: ${cooldown / 1000}s (Throttle: ${snap.throttleLevel}, CPU: ${snap.cpuUsagePercent}%, MEM: ${snap.memoryUsagePercent}%)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, cooldown));
  }

  // ─── Get Adaptive Ollama Context Size ───────────────────────────

  getAdaptiveContextSize(): number {
    if (this.lastSnapshot) {
      return CONTEXT_SIZES[this.lastSnapshot.throttleLevel];
    }
    return CONTEXT_SIZES[ThrottleLevel.LIGHT]; // Conservative default
  }

  // ─── Get Adaptive LLM Timeout ──────────────────────────────────

  getAdaptiveLLMTimeout(): number {
    if (this.lastSnapshot) {
      return LLM_TIMEOUT_MS[this.lastSnapshot.throttleLevel];
    }
    return LLM_TIMEOUT_MS[ThrottleLevel.LIGHT]; // Conservative default
  }

  // ─── Get Last Snapshot (for dashboard/logging) ──────────────────

  getLastSnapshot(): SystemSnapshot | null {
    return this.lastSnapshot;
  }

  // ─── Format Snapshot for Logging ────────────────────────────────

  static formatSnapshot(snap: SystemSnapshot): string {
    const gpu = snap.gpuUsagePercent >= 0 
      ? `GPU: ${snap.gpuUsagePercent}% (${snap.gpuMemoryUsedMB}/${snap.gpuMemoryTotalMB}MB)` 
      : 'GPU: N/A';
    return `[${snap.throttleLevel}] CPU: ${snap.cpuUsagePercent}% | MEM: ${snap.memoryUsagePercent}% (${snap.memoryFreeGB}GB free) | ${gpu} | Ctx: ${snap.ollamaContextSize}`;
  }
}
