import { beforeEach, describe, expect, test, vi } from 'vitest'

import { findSandboxById, getHopxConfig } from './server'

vi.mock('@hopx-ai/sdk', () => {
  return {
    Sandbox: {
      iter: vi.fn(),
    },
  }
})

describe('server helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HOPX_API_KEY = 'test-key'
    delete process.env.HOPX_BASE_URL
  })

  test('getHopxConfig throws when HOPX_API_KEY is missing', () => {
    delete process.env.HOPX_API_KEY

    expect(() => getHopxConfig()).toThrow('Missing HOPX_API_KEY')
  })

  test('getHopxConfig uses default base URL', () => {
    const config = getHopxConfig()

    expect(config).toEqual({
      apiKey: 'test-key',
      baseURL: 'https://api.hopx.dev',
    })
  })

  test('findSandboxById returns matching sandbox from iterator', async () => {
    const sdk = await import('@hopx-ai/sdk')
    const iterMock = vi.mocked(sdk.Sandbox.iter)

    iterMock.mockImplementation(async function* () {
      yield { sandboxId: 'sbx_1' } as never
      yield { sandboxId: 'sbx_target' } as never
    })

    const sandbox = await findSandboxById('sbx_target')

    expect(sandbox.sandboxId).toBe('sbx_target')
  })

  test('findSandboxById throws when sandbox is missing', async () => {
    const sdk = await import('@hopx-ai/sdk')
    const iterMock = vi.mocked(sdk.Sandbox.iter)

    iterMock.mockImplementation(async function* () {
      yield { sandboxId: 'sbx_1' } as never
    })

    await expect(findSandboxById('sbx_missing')).rejects.toThrow('sbx_missing')
  })
})
