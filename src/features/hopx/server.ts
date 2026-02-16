import { createServerFn } from '@tanstack/react-start'

import {
  createHopxUiError,
  mapFileInfo,
  mapMetricsView,
  mapProcessInfo,
  mapSandboxInfo,
  mapTemplateOption,
} from './mappers'
import type {
  BuildNodeTemplateInput,
  BuildTemplateResult,
  CreateSandboxInput,
  DeleteTemplateInput,
  DeleteSandboxInput,
  ListFilesInput,
  SandboxIdInput,
  SandboxListItem,
  StartBackgroundCommandInput,
  StartBackgroundCommandResult,
  TemplateOption,
} from './types'

const SANDBOX_LIST_LIMIT = 25
const SANDBOX_INFO_CONCURRENCY = 5

export interface HopxConfig {
  apiKey: string
  baseURL: string
}

async function getHopxSdk() {
  if (!import.meta.env.SSR) {
    throw new Error('HopX SDK is only available on the server.')
  }

  if (process.env.VITEST) {
    const moduleName = '@hopx-ai/sdk'
    return import(/* @vite-ignore */ moduleName)
  }

  const loadSdk = new Function('return import("@hopx-ai/sdk")') as () => Promise<typeof import('@hopx-ai/sdk')>
  return loadSdk()
}

async function getSandboxClass() {
  const sdk = await getHopxSdk()
  return sdk.Sandbox
}

async function getTemplateTools() {
  const sdk = await getHopxSdk()
  return {
    Template: sdk.Template,
    waitForPort: sdk.waitForPort,
  }
}

export function getHopxConfig(): HopxConfig {
  const apiKey = process.env.HOPX_API_KEY

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('Missing HOPX_API_KEY environment variable. Set it in your server environment before using the control panel.')
  }

  return {
    apiKey,
    baseURL: process.env.HOPX_BASE_URL ?? 'https://api.hopx.dev',
  }
}

export async function findSandboxById(sandboxId: string) {
  const { apiKey, baseURL } = getHopxConfig()
  const Sandbox = await getSandboxClass()

  for await (const sandbox of Sandbox.iter({ apiKey, baseURL })) {
    if (sandbox.sandboxId === sandboxId) {
      return sandbox
    }
  }

  throw new Error(`Sandbox ${sandboxId} was not found.`)
}

async function connectToSandbox(sandboxId: string) {
  const { apiKey, baseURL } = getHopxConfig()
  const Sandbox = await getSandboxClass()
  return Sandbox.connect(sandboxId, apiKey, baseURL)
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let currentIndex = 0

  async function worker() {
    while (true) {
      const itemIndex = currentIndex
      currentIndex += 1

      if (itemIndex >= items.length) {
        return
      }

      results[itemIndex] = await mapper(items[itemIndex], itemIndex)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)

  return results
}

function toError(code: string, error: unknown): Error {
  const hopxError = createHopxUiError(code, error)
  return new Error(`${hopxError.message}`)
}

function isTemplateNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return message.includes('resource_not_found') && message.includes('"resource_type":"template"')
}

export const listTemplatesFn = createServerFn({ method: 'GET' }).handler(async (): Promise<TemplateOption[]> => {
  try {
    const { apiKey, baseURL } = getHopxConfig()
    const Sandbox = await getSandboxClass()
    const templates = await Sandbox.listTemplates({ apiKey, baseURL })

    return templates.map((template) => mapTemplateOption(template))
  } catch (error) {
    throw toError('LIST_TEMPLATES_FAILED', error)
  }
})

export const listSandboxesFn = createServerFn({ method: 'GET' }).handler(async (): Promise<SandboxListItem[]> => {
  try {
    const { apiKey, baseURL } = getHopxConfig()
    const Sandbox = await getSandboxClass()
    const sandboxes = await Sandbox.list({ apiKey, baseURL, limit: SANDBOX_LIST_LIMIT })

    const mapped = await mapWithConcurrency(sandboxes, SANDBOX_INFO_CONCURRENCY, async (sandbox) => {
      const info = await sandbox.getInfo()
      return mapSandboxInfo(info)
    })

    return mapped.sort((left, right) => {
      const leftValue = left.createdAt ? Date.parse(left.createdAt) : 0
      const rightValue = right.createdAt ? Date.parse(right.createdAt) : 0
      return rightValue - leftValue
    })
  } catch (error) {
    throw toError('LIST_SANDBOXES_FAILED', error)
  }
})

export const createSandboxFn = createServerFn({ method: 'POST' })
  .inputValidator((input: CreateSandboxInput) => input)
  .handler(async ({ data }): Promise<SandboxListItem> => {
    try {
      const { apiKey, baseURL } = getHopxConfig()
      const Sandbox = await getSandboxClass()

      const sandbox = await Sandbox.create({
        template: data.templateName,
        region: data.region,
        timeoutSeconds: data.timeoutSeconds,
        internetAccess: data.internetAccess,
        apiKey,
        baseURL,
      })

      const info = await sandbox.getInfo()
      return mapSandboxInfo(info)
    } catch (error) {
      throw toError('CREATE_SANDBOX_FAILED', error)
    }
  })

export const deleteSandboxFn = createServerFn({ method: 'POST' })
  .inputValidator((input: DeleteSandboxInput) => input)
  .handler(async ({ data }) => {
    try {
      const sandbox = await findSandboxById(data.sandboxId)
      await sandbox.kill()
      return { success: true as const }
    } catch (error) {
      throw toError('DELETE_SANDBOX_FAILED', error)
    }
  })

export const listProcessesFn = createServerFn({ method: 'GET' })
  .inputValidator((input: SandboxIdInput) => input)
  .handler(async ({ data }) => {
    try {
      const sandbox = await connectToSandbox(data.sandboxId)
      const processes = await sandbox.listProcesses()
      return processes.map((process) => mapProcessInfo(process))
    } catch (error) {
      throw toError('LIST_PROCESSES_FAILED', error)
    }
  })

export const startBackgroundCommandFn = createServerFn({ method: 'POST' })
  .inputValidator((input: StartBackgroundCommandInput) => input)
  .handler(async ({ data }): Promise<StartBackgroundCommandResult> => {
    try {
      const sandbox = await connectToSandbox(data.sandboxId)
      const result = await sandbox.commands.runBackground(data.command, {
        workingDir: data.workingDir,
      })

      return {
        processId: result.process_id,
      }
    } catch (error) {
      throw toError('START_COMMAND_FAILED', error)
    }
  })

export const listFilesFn = createServerFn({ method: 'GET' })
  .inputValidator((input: ListFilesInput) => input)
  .handler(async ({ data }) => {
    try {
      const sandbox = await connectToSandbox(data.sandboxId)
      const files = await sandbox.files.list(data.path)
      return files.map((file) => mapFileInfo(file))
    } catch (error) {
      throw toError('LIST_FILES_FAILED', error)
    }
  })

export const getMetricsFn = createServerFn({ method: 'GET' })
  .inputValidator((input: SandboxIdInput) => input)
  .handler(async ({ data }) => {
    try {
      const sandbox = await connectToSandbox(data.sandboxId)
      const metrics = await sandbox.getAgentMetrics()
      return mapMetricsView(metrics)
    } catch (error) {
      throw toError('GET_METRICS_FAILED', error)
    }
  })

export const getSandboxInfoFn = createServerFn({ method: 'GET' })
  .inputValidator((input: SandboxIdInput) => input)
  .handler(async ({ data }) => {
    try {
      const sandbox = await findSandboxById(data.sandboxId)
      const info = await sandbox.getInfo()
      return mapSandboxInfo(info)
    } catch (error) {
      throw toError('GET_SANDBOX_INFO_FAILED', error)
    }
  })

export const buildNodeTemplateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: BuildNodeTemplateInput) => input)
  .handler(async ({ data }): Promise<BuildTemplateResult> => {
    try {
      const { apiKey, baseURL } = getHopxConfig()
      const { Template, waitForPort } = await getTemplateTools()

      const templateName = data.name.trim()
      if (templateName.length === 0) {
        throw new Error('Template name is required.')
      }

      const startCommand = data.startCommand.trim()
      if (startCommand.length === 0) {
        throw new Error('Start command is required.')
      }

      if (data.startPort !== undefined && (!Number.isInteger(data.startPort) || data.startPort <= 0 || data.startPort > 65535)) {
        throw new Error('Start port must be an integer from 1 to 65535.')
      }

      const nodeVersion = data.nodeVersion?.trim().length ? data.nodeVersion.trim() : '22'
      const baseImage = data.baseImage?.trim().length ? data.baseImage.trim() : `node:${nodeVersion}-bookworm`
      const workingDir = data.workingDir?.trim().length ? data.workingDir.trim() : '/workspace'
      const installCommand = data.installCommand?.trim()

      const template = new Template(baseImage)
        .setWorkdir(workingDir)

      if (installCommand) {
        template.runCmd(installCommand)
      }

      if (data.envVars && Object.keys(data.envVars).length > 0) {
        template.setEnvs(data.envVars)
      }

      if (data.startPort !== undefined) {
        template.setStartCmd(startCommand, waitForPort(data.startPort))
      } else {
        template.setStartCmd(startCommand)
      }

      const buildTemplate = async (update: boolean) =>
        Template.build(template, {
          name: templateName,
          apiKey,
          baseURL,
          update,
        })

      let result: Awaited<ReturnType<typeof buildTemplate>>
      const shouldUpdate = data.update ?? true

      try {
        result = await buildTemplate(shouldUpdate)
      } catch (error) {
        if (shouldUpdate && isTemplateNotFoundError(error)) {
          result = await buildTemplate(false)
        } else {
          throw error
        }
      }

      return {
        templateId: result.templateID,
        buildId: result.buildID,
        durationSeconds: result.duration / 1000,
      }
    } catch (error) {
      throw toError('BUILD_TEMPLATE_FAILED', error)
    }
  })

export const deleteTemplateFn = createServerFn({ method: 'POST' })
  .inputValidator((input: DeleteTemplateInput) => input)
  .handler(async ({ data }) => {
    try {
      const { apiKey, baseURL } = getHopxConfig()
      const Sandbox = await getSandboxClass()
      await Sandbox.deleteTemplate(data.templateId, { apiKey, baseURL })

      return { success: true as const }
    } catch (error) {
      throw toError('DELETE_TEMPLATE_FAILED', error)
    }
  })
