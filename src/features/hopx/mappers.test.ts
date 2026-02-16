import { describe, expect, test } from 'vitest'

import {
  createHopxUiError,
  mapFileInfo,
  mapMetricsView,
  mapProcessInfo,
  mapSandboxInfo,
  mapTemplateOption,
} from './mappers'

describe('mappers', () => {
  test('mapTemplateOption handles partial values', () => {
    const result = mapTemplateOption({ name: 'desktop' })

    expect(result).toEqual({
      id: 'desktop',
      name: 'desktop',
      displayName: 'desktop',
      category: null,
      status: null,
      description: null,
      isPublic: null,
      isActive: null,
      createdAt: null,
      updatedAt: null,
    })
  })

  test('mapTemplateOption supports snake_case fields', () => {
    const result = mapTemplateOption({
      template_id: 'tmpl_1',
      template_name: 'ubuntu',
      display_name: 'Ubuntu Desktop',
    })

    expect(result).toEqual({
      id: 'tmpl_1',
      name: 'ubuntu',
      displayName: 'Ubuntu Desktop',
      category: null,
      status: null,
      description: null,
      isPublic: null,
      isActive: null,
      createdAt: null,
      updatedAt: null,
    })
  })

  test('mapTemplateOption maps visibility and timestamps', () => {
    const result = mapTemplateOption({
      id: 'tmpl_custom',
      name: 'node-opencode',
      isPublic: false,
      isActive: true,
      createdAt: '2026-02-16T00:00:00Z',
    })

    expect(result).toMatchObject({
      id: 'tmpl_custom',
      isPublic: false,
      isActive: true,
      createdAt: '2026-02-16T00:00:00Z',
    })
  })

  test('mapSandboxInfo handles mixed casing and missing resources', () => {
    const result = mapSandboxInfo({
      sandboxId: 'sbx_1',
      status: 'running',
      createdAt: '2026-01-01T00:00:00Z',
      resources: { vcpu: 2, memoryMb: 2048, diskMb: 10240 },
    })

    expect(result.id).toBe('sbx_1')
    expect(result.status).toBe('running')
    expect(result.resources).toEqual({
      vcpu: 2,
      memoryMb: 2048,
      diskMb: 10240,
    })
  })

  test('mapSandboxInfo handles snake_case fields', () => {
    const result = mapSandboxInfo({
      sandbox_id: 'sbx_2',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-01T01:00:00Z',
      timeout_seconds: 3600,
      internet_access: true,
      resources: { memory_mb: 512, disk_mb: 1024, vcpu_count: 1 },
    })

    expect(result).toMatchObject({
      id: 'sbx_2',
      timeoutSeconds: 3600,
      internetAccess: true,
      resources: { memoryMb: 512, diskMb: 1024, vcpu: 1 },
    })
  })

  test('mapProcessInfo supports API field variants', () => {
    const result = mapProcessInfo({
      process_id: 'proc_1',
      status: 'completed',
      start_time: '2026-01-01T00:00:00Z',
      end_time: '2026-01-01T00:00:03Z',
      execution_time: 3,
    })

    expect(result).toMatchObject({
      processId: 'proc_1',
      status: 'completed',
      durationSeconds: 3,
    })
  })

  test('mapFileInfo maps directory flag and metadata', () => {
    const result = mapFileInfo({
      path: '/workspace/src',
      name: 'src',
      is_dir: true,
      modified: '2026-01-01T00:00:00Z',
    })

    expect(result).toEqual({
      path: '/workspace/src',
      name: 'src',
      isDirectory: true,
      size: null,
      modifiedTime: '2026-01-01T00:00:00Z',
      permissions: null,
    })
  })

  test('mapMetricsView keeps raw payload', () => {
    const result = mapMetricsView({
      uptime_seconds: 100,
      requests_total: 20,
      custom: 'value',
    })

    expect(result.uptimeSeconds).toBe(100)
    expect(result.requestsTotal).toBe(20)
    expect(result.raw.custom).toBe('value')
  })

  test('mapMetricsView supports camelCase fields', () => {
    const result = mapMetricsView({
      uptimeSeconds: 9,
      avgDurationMs: 120,
      p95DurationMs: 300,
    })

    expect(result).toMatchObject({
      uptimeSeconds: 9,
      avgDurationMs: 120,
      p95DurationMs: 300,
    })
  })

  test('createHopxUiError captures Error metadata', () => {
    const error = createHopxUiError('TEST', new TypeError('boom'))

    expect(error).toEqual({
      code: 'TEST',
      message: 'boom',
      cause: 'TypeError',
    })
  })
})
