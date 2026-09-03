import type { AgentActivityEntry } from '../data/types'
import { WorkspaceServiceError } from '../services/workspaceService'
import { workspaceStore } from '../store/workspaceStore'

export interface ToolResponse<T> { success: boolean; summary: string; data?: T; error?: { code: string; message: string } }
function activityId(tool: string) { return `${tool}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }

export async function runWithActivity<T>(tool: string, action: () => Promise<T> | T, summary: (data: T) => string): Promise<ToolResponse<T>> {
  const startedAt = performance.now(); const id = activityId(tool)
  const running: AgentActivityEntry = { id, timestamp: new Date().toISOString(), tool, status: 'running', summary: 'Running…' }
  workspaceStore.addAgentActivity(running)
  try {
    const data = await action(); const message = `${summary(data)} · ${Math.round(performance.now() - startedAt)}ms`
    workspaceStore.updateAgentActivity(id, { status: 'success', summary: message })
    return { success: true, summary: message, data }
  } catch (error) {
    const safe = error instanceof WorkspaceServiceError ? error : new WorkspaceServiceError('INVALID_INPUT', 'The tool could not complete safely.')
    workspaceStore.updateAgentActivity(id, { status: 'error', summary: `${safe.code}: ${safe.message}`, detail: safe.message })
    return { success: false, summary: safe.message, error: { code: safe.code, message: safe.message } }
  }
}
