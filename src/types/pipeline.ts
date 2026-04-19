export interface JulesWorker {
  id: string;
  alias: string;
  endpoint: string;
  token: string;
  status: 'idle' | 'working' | 'offline';
}

export interface PipelineTask {
  id: string;
  goal: string;
  assignedWorkerId: string | null;
  status: 'pending' | 'dispatched' | 'pushed' | 'tested' | 'merged' | 'failed';
  gitBranch?: string;
  logs: string[];
}

export interface ProjectState {
  repoTarget: string;
  localPath: string;
  directive: string;
  tasks: PipelineTask[];
}
