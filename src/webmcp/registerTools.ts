import { marketToolDefinitions } from './marketTools'
import { researchToolDefinitions } from './researchTools'
import { workspaceToolDefinitions } from './workspaceTools'

export type WebMcpRegistrationStatus = 'available' | 'registering' | 'registered' | 'unavailable' | 'error'
const listeners = new Set<(status: WebMcpRegistrationStatus) => void>()
const definitions = [...workspaceToolDefinitions, ...marketToolDefinitions, ...researchToolDefinitions]
interface RegistrationLifecycle { status: WebMcpRegistrationStatus; registration: Promise<WebMcpRegistrationStatus> | null; abortController: AbortController | null }
const lifecycleKey = '__quantMcpWebMcpLifecycle__'
const lifecycleHost = globalThis as typeof globalThis & { [lifecycleKey]?: RegistrationLifecycle }
const lifecycle = lifecycleHost[lifecycleKey] ?? (lifecycleHost[lifecycleKey] = { status: 'available', registration: null, abortController: null })

function emit(next: WebMcpRegistrationStatus) { lifecycle.status = next; listeners.forEach((listener) => listener(lifecycle.status)) }
function supported() { return typeof document !== 'undefined' && typeof document.modelContext?.registerTool === 'function' }

export function getWebMcpRegistrationStatus(): WebMcpRegistrationStatus {
  if (!supported() && lifecycle.status !== 'registered' && lifecycle.status !== 'registering' && lifecycle.status !== 'error') lifecycle.status = 'unavailable'
  return lifecycle.status
}

export function subscribeWebMcpStatus(listener: (next: WebMcpRegistrationStatus) => void) {
  listeners.add(listener); return () => { listeners.delete(listener) }
}

/** Registers the native imperative WebMCP tools once per page lifetime. */
export function registerWebMcpTools(): Promise<WebMcpRegistrationStatus> {
  if (!supported()) { emit('unavailable'); return Promise.resolve('unavailable') }
  if (lifecycle.status === 'registered') return Promise.resolve(lifecycle.status)
  if (lifecycle.registration) return lifecycle.registration
  emit('registering'); lifecycle.abortController = new AbortController()
  lifecycle.registration = Promise.all(definitions.map((tool) => document.modelContext!.registerTool(tool, { signal: lifecycle.abortController!.signal })))
    .then(() => { emit('registered'); return lifecycle.status })
    .catch((error: unknown) => {
      lifecycle.abortController?.abort(); lifecycle.registration = null; emit('error')
      if (import.meta.env.DEV) console.error('QuantMCP WebMCP registration failed.', error)
      return lifecycle.status
    })
  return lifecycle.registration
}

export const registeredWebMcpToolNames = definitions.map((tool) => tool.name)
