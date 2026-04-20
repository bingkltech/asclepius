// ═══════════════════════════════════════════════════════════════════
// SkillSeekersBridge — Knowledge Asset Generation & Management
// ═══════════════════════════════════════════════════════════════════
// Wraps the `skill-seekers` Python CLI to generate structured
// knowledge assets from docs, repos, PDFs, and local projects.
// Agents consume these assets via BaseAgent.gatherContext().

import { TerminalBridge } from './TerminalBridge';

export interface SkillAsset {
  id: string;
  name: string;
  source: string;          // URL or local path that was scraped
  filePath: string;        // Absolute path to the .skill.md file
  sizeBytes: number;
  createdAt: number;
  category: 'framework' | 'library' | 'project' | 'docs' | 'custom';
}

// Default global skills directory
const GLOBAL_SKILLS_DIR = 'C:/Users/likha/.asclepius/global-skills';

export class SkillSeekersBridge {
  /**
   * Resolves the correct command to run skill-seekers.
   * On Windows, it checks common user-scripts paths if not in PATH.
   */
  private static async resolveCommand(): Promise<string> {
    // Try raw command first
    try {
      const result = await TerminalBridge.runCommand('skill-seekers --version', '.');
      if (!result.error) return 'skill-seekers';
    } catch {}

    // Try common Windows user-scripts path
    const winUserPath = 'C:\\Users\\likha\\AppData\\Roaming\\Python\\Python314\\Scripts\\skill-seekers.exe';
    try {
      const result = await TerminalBridge.runCommand(`"${winUserPath}" --version`, '.');
      if (!result.error) return `"${winUserPath}"`;
    } catch {}

    // Fallback to raw command and hope for the best
    return 'skill-seekers';
  }

  /**
   * Check if skill-seekers is installed.
   */
  static async isInstalled(): Promise<boolean> {
    const cmd = await this.resolveCommand();
    try {
      const result = await TerminalBridge.runCommand(`${cmd} --version`, '.');
      return !result.error && result.stdout.includes('skill');
    } catch {
      return false;
    }
  }

  /**
   * Install skill-seekers via pip.
   */
  static async install(): Promise<{ success: boolean; message: string }> {
    try {
      const result = await TerminalBridge.runCommand('pip install skill-seekers', '.');
      return { success: !result.error, message: result.stdout || result.stderr || 'Installed.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Generate a skill from a documentation website URL.
   * Example: createFromUrl('https://react.dev/', 'react-19')
   */
  static async createFromUrl(
    url: string,
    skillName: string,
    outputDir: string = GLOBAL_SKILLS_DIR
  ): Promise<{ success: boolean; outputPath: string; message: string }> {
    const cmdBase = await this.resolveCommand();
    const outputPath = `${outputDir}/${skillName}`;
    try {
      const cmd = `${cmdBase} create "${url}" --output "${outputPath}"`;
      const result = await TerminalBridge.runCommand(cmd, '.');
      return {
        success: !result.error,
        outputPath,
        message: result.stdout || result.stderr || 'Skill generated.',
      };
    } catch (err: any) {
      return { success: false, outputPath, message: err.message };
    }
  }

  /**
   * Generate a skill from a GitHub repository.
   * Example: createFromRepo('facebook/react', 'react-source')
   */
  static async createFromRepo(
    repoSlug: string,
    skillName: string,
    outputDir: string = GLOBAL_SKILLS_DIR
  ): Promise<{ success: boolean; outputPath: string; message: string }> {
    const cmdBase = await this.resolveCommand();
    const outputPath = `${outputDir}/${skillName}`;
    try {
      const cmd = `${cmdBase} create "${repoSlug}" --output "${outputPath}"`;
      const result = await TerminalBridge.runCommand(cmd, '.');
      return {
        success: !result.error,
        outputPath,
        message: result.stdout || result.stderr || 'Skill generated.',
      };
    } catch (err: any) {
      return { success: false, outputPath, message: err.message };
    }
  }

  /**
   * Generate a skill from a local project directory.
   * This is the project-specific skill that lives inside the project.
   */
  static async createFromProject(
    projectPath: string
  ): Promise<{ success: boolean; outputPath: string; message: string }> {
    const cmdBase = await this.resolveCommand();
    const outputPath = `${projectPath}/.asclepius/skills`;
    try {
      const cmd = `${cmdBase} create "${projectPath}" --output "${outputPath}"`;
      const result = await TerminalBridge.runCommand(cmd, projectPath);
      return {
        success: !result.error,
        outputPath,
        message: result.stdout || result.stderr || 'Project skill generated.',
      };
    } catch (err: any) {
      return { success: false, outputPath, message: err.message };
    }
  }

  /**
   * List all available skill assets in a directory.
   */
  static async listSkills(skillsDir: string = GLOBAL_SKILLS_DIR): Promise<SkillAsset[]> {
    try {
      const entries = await TerminalBridge.listDir(skillsDir);
      const skills: SkillAsset[] = [];

      for (const entry of entries) {
        if (entry.isDirectory) {
          // Each subdirectory is a skill (e.g. react-19/)
          try {
            const children = await TerminalBridge.listDir(`${skillsDir}/${entry.name}`);
            const skillFile = children.find(f =>
              f.name === 'SKILL.md' || f.name.endsWith('.skill.md') || f.name === 'README.md'
            );

            if (skillFile) {
              skills.push({
                id: `skill_${entry.name}`,
                name: entry.name,
                source: 'unknown', // Would need metadata file to know
                filePath: `${skillsDir}/${entry.name}/${skillFile.name}`,
                sizeBytes: 0,
                createdAt: Date.now(),
                category: 'framework',
              });
            }
          } catch { /* skip unreadable dirs */ }
        } else if (entry.name.endsWith('.skill.md') || entry.name === 'SKILL.md') {
          // Standalone skill file
          skills.push({
            id: `skill_${entry.name.replace('.skill.md', '')}`,
            name: entry.name.replace('.skill.md', ''),
            source: 'unknown',
            filePath: `${skillsDir}/${entry.name}`,
            sizeBytes: 0,
            createdAt: Date.now(),
            category: 'custom',
          });
        }
      }

      return skills;
    } catch {
      return [];
    }
  }

  /**
   * Read a skill file's content. Used by agents to inject into context.
   */
  static async readSkill(filePath: string): Promise<string> {
    return await TerminalBridge.readFile(filePath);
  }
}
