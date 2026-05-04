import React, { useMemo } from 'react';
import { ReactFlow, Controls, Background } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { PipelineTask } from '../types/pipeline';

interface ChronicleDebuggerProps {
  dagTasks: PipelineTask[];
  pipelineLogs: any[];
}

export const ChronicleDebugger: React.FC<ChronicleDebuggerProps> = ({ dagTasks, pipelineLogs: _pipelineLogs }) => {
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);

  const selectedTask = useMemo(() => {
    return dagTasks.find(t => t.id === selectedTaskId);
  }, [selectedTaskId, dagTasks]);

  // Convert DAG tasks into React Flow nodes and edges
  const { nodes, edges } = useMemo(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];

    // Base layout calculation (simple horizontal layout for now)
    const levelWidth = 300;
    const levelHeight = 150;
    
    // Group tasks by depth to calculate X/Y
    const taskDepths = new Map<string, number>();
    const getDepth = (taskId: string): number => {
      if (taskDepths.has(taskId)) return taskDepths.get(taskId)!;
      const task = dagTasks.find(t => t.id === taskId);
      if (!task || !task.dependencies || task.dependencies.length === 0) {
        taskDepths.set(taskId, 0);
        return 0;
      }
      const maxDepDepth = Math.max(...task.dependencies.map(depId => getDepth(depId)));
      taskDepths.set(taskId, maxDepDepth + 1);
      return maxDepDepth + 1;
    };

    dagTasks.forEach(t => getDepth(t.id));
    const depthCounts = new Map<number, number>();

    dagTasks.forEach((task) => {
      const depth = taskDepths.get(task.id) || 0;
      const countAtDepth = depthCounts.get(depth) || 0;
      depthCounts.set(depth, countAtDepth + 1);

      let borderColor = '#3f3f46';
      let bgColor = '#18181b';
      
      if (task.status === 'completed') {
        borderColor = '#10b981'; bgColor = '#064e3b';
      } else if (task.status === 'failed') {
        borderColor = '#ef4444'; bgColor = '#7f1d1d';
      } else if (task.status === 'working' || task.status === 'in_review') {
        borderColor = '#8b5cf6'; bgColor = '#4c1d95';
      } else if (task.status === 'blocked') {
        borderColor = '#f59e0b'; bgColor = '#78350f';
      }

      newNodes.push({
        id: task.id,
        position: { x: depth * levelWidth, y: countAtDepth * levelHeight },
        data: { 
          label: (
            <div className="flex flex-col text-left p-1 text-xs">
              <div className="font-bold text-zinc-100 truncate w-40">{task.goal}</div>
              <div className="text-[10px] text-zinc-400 mt-1 uppercase">{task.status}</div>
              {task.assignedAgentId && <div className="text-[9px] text-violet-400 mt-1">Worker: {task.assignedAgentId}</div>}
            </div>
          ) 
        },
        style: {
          background: bgColor,
          border: `2px solid ${borderColor}`,
          borderRadius: '8px',
          color: 'white',
          padding: '8px',
          width: 180,
          boxShadow: selectedTaskId === task.id ? `0 0 0 4px rgba(255, 255, 255, 0.2)` : 'none',
        }
      });

      task.dependencies.forEach(depId => {
        newEdges.push({
          id: `e-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          animated: task.status === 'working' || task.status === 'in_review',
          style: { stroke: '#a1a1aa', strokeWidth: 2 }
        });
      });
    });

    return { nodes: newNodes, edges: newEdges };
  }, [dagTasks, selectedTaskId]);

  const onNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedTaskId(node.id);
  };

  const renderSuggestions = (task: PipelineTask) => {
    if (task.status === 'blocked') {
      const blockers = task.dependencies.filter(depId => dagTasks.find(d => d.id === depId)?.status !== 'completed');
      return (
        <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400 text-xs">
          <strong>Blocker Found:</strong> Waiting on {blockers.length} task(s) to finish before execution can begin.
          <br/><strong>Fix:</strong> Ensure the upstream dependencies succeed.
        </div>
      );
    }
    
    if (task.status === 'failed') {
      const lastLog = task.logs[task.logs.length - 1] || '';
      let suggestion = "The agent encountered an unknown error. Try restarting the task.";
      if (lastLog.includes('API')) suggestion = "API connection failed. Check the Agent Fleet configuration to ensure the API key and endpoint are valid.";
      if (lastLog.includes('JSON')) suggestion = "The LLM returned a malformed response that could not be parsed. This usually means the model hallucinated. Try lowering the temperature in settings.";
      if (lastLog.includes('quota')) suggestion = "You have hit a rate limit or quota on your LLM API. Wait a few minutes and try again.";

      return (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-xs">
          <strong>Error Diagnosis:</strong> {lastLog.replace('Execution failed:', '').trim()}
          <br/><strong>AI Suggestion:</strong> {suggestion}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col p-4 bg-[#09090b]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Chronicle Debugger</h1>
        <p className="text-sm text-zinc-500 mt-1">Macro-level data flow trace of your multi-agent workforce.</p>
      </div>
      
      <div className="flex-1 rounded-xl border border-zinc-800 bg-[#18181b] overflow-hidden relative">
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={onNodeClick} fitView>
          <Background color="#27272a" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      <div className="mt-4 h-56 border border-zinc-800 bg-[#18181b] rounded-xl p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2">
        <h3 className="text-xs font-bold text-violet-400 uppercase tracking-widest">Selected Node Data</h3>
        
        {!selectedTask ? (
          <p className="text-sm text-zinc-500 mt-2">Click on a node in the graph above to view its data lineage, errors, and suggestions.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-zinc-100">{selectedTask.goal}</h4>
                <span className="text-[10px] text-zinc-400">Assigned: {selectedTask.assignedAgentId || 'Unassigned'} | Priority: {selectedTask.priority}</span>
              </div>
              <div className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-zinc-800 border border-zinc-700 text-zinc-300">
                {selectedTask.status}
              </div>
            </div>
            
            {renderSuggestions(selectedTask)}

            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500">Execution Logs</span>
              <div className="mt-1 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-400 max-h-24 overflow-y-auto">
                {selectedTask.logs.length > 0 ? selectedTask.logs.map((l, i) => <div key={i}>{l}</div>) : 'No logs recorded.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
