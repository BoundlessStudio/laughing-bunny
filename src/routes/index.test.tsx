import { describe, expect, test } from 'vitest'

import {
  ROOT_PATH,
  errorMessage,
  formatDate,
  formatDuration,
  formatFileSize,
  formatMetric,
  parseEnvLines,
  parseOptionalPortInput,
  parseTimeoutSecondsInput,
  resolveWorkingDir,
  sortFileTreeItems,
  statusVariant,
} from '@/features/hopx/control-panel'

describe('route utilities', () => {
  test('parseTimeoutSecondsInput returns undefined for empty values', () => {
    expect(parseTimeoutSecondsInput('')).toBeUndefined()
    expect(parseTimeoutSecondsInput('   ')).toBeUndefined()
  })

  test('parseTimeoutSecondsInput accepts positive integers only', () => {
    expect(parseTimeoutSecondsInput('300')).toBe(300)
    expect(parseTimeoutSecondsInput('0')).toBeNull()
    expect(parseTimeoutSecondsInput('-1')).toBeNull()
    expect(parseTimeoutSecondsInput('1.5')).toBeNull()
  })

  test('parseOptionalPortInput validates optional ports', () => {
    expect(parseOptionalPortInput('')).toBeUndefined()
    expect(parseOptionalPortInput('8080')).toBe(8080)
    expect(parseOptionalPortInput('0')).toBeNull()
    expect(parseOptionalPortInput('70000')).toBeNull()
  })

  test('parseEnvLines parses KEY=VALUE lines', () => {
    const parsed = parseEnvLines('FOO=bar\n# comment\nHELLO=world')
    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      expect(parsed.envVars).toEqual({ FOO: 'bar', HELLO: 'world' })
    }

    const invalid = parseEnvLines('BAD LINE')
    expect(invalid.ok).toBe(false)
  })

  test('resolveWorkingDir falls back to workspace root', () => {
    expect(resolveWorkingDir('')).toBe(ROOT_PATH)
    expect(resolveWorkingDir('   ')).toBe(ROOT_PATH)
    expect(resolveWorkingDir('/tmp/app')).toBe('/tmp/app')
  })

  test('statusVariant maps known statuses', () => {
    expect(statusVariant('running')).toBe('default')
    expect(statusVariant('paused')).toBe('secondary')
    expect(statusVariant('failed')).toBe('destructive')
    expect(statusVariant('unknown')).toBe('outline')
  })

  test('sortFileTreeItems places directories before files', () => {
    const sorted = sortFileTreeItems([
      { path: '/workspace/b.txt', name: 'b.txt', isDirectory: false, size: 1, modifiedTime: null, permissions: null },
      { path: '/workspace/src', name: 'src', isDirectory: true, size: null, modifiedTime: null, permissions: null },
      { path: '/workspace/a.txt', name: 'a.txt', isDirectory: false, size: 1, modifiedTime: null, permissions: null },
    ])

    expect(sorted.map((entry) => entry.name)).toEqual(['src', 'a.txt', 'b.txt'])
  })

  test('formatters normalize null/valid values', () => {
    expect(formatDuration(null)).toBe('-')
    expect(formatDuration(1.234)).toBe('1.23s')
    expect(formatFileSize(null)).toBe('n/a')
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatMetric(null)).toBe('n/a')
    expect(formatMetric(42)).toBe('42')
  })

  test('formatDate handles empty and valid values', () => {
    expect(formatDate(null)).toBe('n/a')
    expect(formatDate('not-a-date')).toBe('not-a-date')
    expect(formatDate('2026-01-01T00:00:00Z')).not.toBe('n/a')
  })

  test('errorMessage returns fallback for unknown errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
    expect(errorMessage('bad')).toBe('Unexpected error')
  })

  test('root path constant remains workspace', () => {
    expect(ROOT_PATH).toBe('/workspace')
  })
})
