export interface HopxUiError {
  code: string
  message: string
  cause?: string
}

export interface SandboxResources {
  vcpu: number | null
  memoryMb: number | null
  diskMb: number | null
}

export interface SandboxListItem {
  id: string
  status: string
  templateName: string | null
  templateId: string | null
  region: string | null
  createdAt: string | null
  expiresAt: string | null
  timeoutSeconds: number | null
  internetAccess: boolean | null
  publicHost: string | null
  resources: SandboxResources | null
}

export interface TemplateOption {
  id: string
  name: string
  displayName: string
  category: string | null
  status: string | null
  description: string | null
  isPublic: boolean | null
  isActive: boolean | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ProcessItem {
  processId: string
  executionId: string | null
  name: string | null
  status: string
  language: string | null
  pid: number | null
  startedAt: string | null
  endTime: string | null
  durationSeconds: number | null
  exitCode: number | null
}

export interface FileTreeItem {
  path: string
  name: string
  isDirectory: boolean
  size: number | null
  modifiedTime: string | null
  permissions: string | null
}

export interface MetricsView {
  uptimeSeconds: number | null
  totalExecutions: number | null
  activeExecutions: number | null
  requestsTotal: number | null
  errorCount: number | null
  avgDurationMs: number | null
  p95DurationMs: number | null
  raw: Record<string, unknown>
}

export interface CreateSandboxInput {
  templateName: string
  region?: string
  timeoutSeconds?: number
  internetAccess?: boolean
}

export interface DeleteSandboxInput {
  sandboxId: string
}

export interface SandboxIdInput {
  sandboxId: string
}

export interface StartBackgroundCommandInput {
  sandboxId: string
  command: string
  workingDir: string
}

export interface ListFilesInput {
  sandboxId: string
  path: string
}

export interface StartBackgroundCommandResult {
  processId: string
}

export interface BuildNodeTemplateInput {
  name: string
  nodeVersion?: string
  baseImage?: string
  installCommand?: string
  workingDir?: string
  startCommand: string
  startPort?: number
  envVars?: Record<string, string>
  update?: boolean
}

export interface BuildTemplateResult {
  templateId: string
  buildId: string
  durationSeconds: number
}

export interface DeleteTemplateInput {
  templateId: string
}
