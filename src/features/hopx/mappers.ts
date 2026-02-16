import type {
  FileTreeItem,
  MetricsView,
  ProcessItem,
  SandboxListItem,
  TemplateOption,
} from './types'

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>
  }

  return {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function fromKeys(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

export function mapTemplateOption(template: unknown): TemplateOption {
  const record = asRecord(template)
  const name = asString(fromKeys(record, 'name', 'templateName', 'template_name')) ?? 'unknown-template'
  const id = asString(fromKeys(record, 'id', 'templateId', 'template_id')) ?? name

  return {
    id,
    name,
    displayName: asString(fromKeys(record, 'displayName', 'display_name')) ?? name,
    category: asString(fromKeys(record, 'category')),
    status: asString(fromKeys(record, 'status')),
    description: asString(fromKeys(record, 'description')),
    isPublic: asBoolean(fromKeys(record, 'isPublic', 'is_public')),
    isActive: asBoolean(fromKeys(record, 'isActive', 'is_active')),
    createdAt: asString(fromKeys(record, 'createdAt', 'created_at')),
    updatedAt: asString(fromKeys(record, 'updatedAt', 'updated_at')),
  }
}

export function mapSandboxInfo(info: unknown): SandboxListItem {
  const record = asRecord(info)
  const resourcesRecord = asRecord(fromKeys(record, 'resources'))

  const resources =
    Object.keys(resourcesRecord).length > 0
      ? {
          vcpu: asNumber(fromKeys(resourcesRecord, 'vcpu', 'vCPU', 'vcpu_count')),
          memoryMb: asNumber(fromKeys(resourcesRecord, 'memoryMb', 'memory_mb')),
          diskMb: asNumber(fromKeys(resourcesRecord, 'diskMb', 'disk_mb')),
        }
      : null

  return {
    id: asString(fromKeys(record, 'sandboxId', 'sandbox_id', 'id')) ?? 'unknown-sandbox',
    status: asString(fromKeys(record, 'status')) ?? 'unknown',
    templateName: asString(fromKeys(record, 'templateName', 'template_name', 'template')),
    templateId: asString(fromKeys(record, 'templateId', 'template_id')),
    region: asString(fromKeys(record, 'region')),
    createdAt: asString(fromKeys(record, 'createdAt', 'created_at')),
    expiresAt: asString(fromKeys(record, 'expiresAt', 'expires_at')),
    timeoutSeconds: asNumber(fromKeys(record, 'timeoutSeconds', 'timeout_seconds')),
    internetAccess: asBoolean(fromKeys(record, 'internetAccess', 'internet_access')),
    publicHost: asString(fromKeys(record, 'publicHost', 'public_host', 'host')),
    resources,
  }
}

export function mapProcessInfo(process: unknown): ProcessItem {
  const record = asRecord(process)

  return {
    processId: asString(fromKeys(record, 'process_id', 'processId')) ?? 'unknown-process',
    executionId: asString(fromKeys(record, 'execution_id', 'executionId')),
    name: asString(fromKeys(record, 'name')),
    status: asString(fromKeys(record, 'status')) ?? 'unknown',
    language: asString(fromKeys(record, 'language')),
    pid: asNumber(fromKeys(record, 'pid')),
    startedAt: asString(fromKeys(record, 'started_at', 'start_time', 'startedAt')),
    endTime: asString(fromKeys(record, 'end_time', 'endTime')),
    durationSeconds: asNumber(fromKeys(record, 'duration', 'duration_seconds', 'execution_time')),
    exitCode: asNumber(fromKeys(record, 'exit_code', 'exitCode')),
  }
}

export function mapFileInfo(file: unknown): FileTreeItem {
  const record = asRecord(file)
  const path = asString(fromKeys(record, 'path')) ?? ''
  const nameFromPath = path.split('/').pop() ?? ''

  return {
    path,
    name: asString(fromKeys(record, 'name')) ?? nameFromPath,
    isDirectory: Boolean(fromKeys(record, 'is_dir', 'isDirectory')) || fromKeys(record, 'type') === 'dir',
    size: asNumber(fromKeys(record, 'size')),
    modifiedTime: asString(fromKeys(record, 'modified', 'modified_time', 'modifiedTime', 'mtime')),
    permissions: asString(fromKeys(record, 'permissions')),
  }
}

export function mapMetricsView(metrics: unknown): MetricsView {
  const record = asRecord(metrics)

  return {
    uptimeSeconds: asNumber(fromKeys(record, 'uptime_seconds', 'uptimeSeconds')),
    totalExecutions: asNumber(fromKeys(record, 'total_executions', 'totalExecutions')),
    activeExecutions: asNumber(fromKeys(record, 'active_executions', 'activeExecutions')),
    requestsTotal: asNumber(fromKeys(record, 'requests_total', 'requestsTotal')),
    errorCount: asNumber(fromKeys(record, 'error_count', 'errorCount')),
    avgDurationMs: asNumber(fromKeys(record, 'avg_duration_ms', 'avgDurationMs')),
    p95DurationMs: asNumber(fromKeys(record, 'p95_duration_ms', 'p95DurationMs')),
    raw: record,
  }
}

export function createHopxUiError(code: string, error: unknown): { code: string; message: string; cause?: string } {
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
      cause: error.name,
    }
  }

  return {
    code,
    message: 'Unexpected error while calling HopX API.',
  }
}
