import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Plus,
  RefreshCw,
  Rocket,
  Trash2,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  buildNodeTemplateFn,
  createSandboxFn,
  deleteSandboxFn,
  deleteTemplateFn,
  getMetricsFn,
  getSandboxInfoFn,
  listFilesFn,
  listProcessesFn,
  listSandboxesFn,
  listTemplatesFn,
  startBackgroundCommandFn,
} from '@/features/hopx/server'
import type {
  FileTreeItem,
  MetricsView,
  ProcessItem,
  SandboxListItem,
  TemplateOption,
} from '@/features/hopx/types'

export const ROOT_PATH = '/workspace'
const SANDBOX_POLL_INTERVAL_MS = 12000
const PANEL_POLL_INTERVAL_MS = 5000

type ControlTab = 'processes' | 'commands' | 'filesystem' | 'metrics' | 'desktop'

export function HopxControlPanel() {
  const [sandboxes, setSandboxes] = useState<SandboxListItem[]>([])
  const [isSandboxesLoading, setIsSandboxesLoading] = useState(true)
  const [isSandboxesRefreshing, setIsSandboxesRefreshing] = useState(false)
  const [sandboxesError, setSandboxesError] = useState<string | null>(null)

  const [selectedSandboxId, setSelectedSandboxId] = useState<string | null>(null)
  const [selectedSandboxInfo, setSelectedSandboxInfo] = useState<SandboxListItem | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [isTemplatesLoading, setIsTemplatesLoading] = useState(false)
  const [templateBuildName, setTemplateBuildName] = useState('node-opencode')
  const [templateNodeVersion, setTemplateNodeVersion] = useState('22')
  const [templateBaseImage, setTemplateBaseImage] = useState('node:22-bookworm')
  const [templateInstallCommand, setTemplateInstallCommand] = useState('npm install -g opencode-ai')
  const [templateWorkingDir, setTemplateWorkingDir] = useState('/workspace')
  const [templateStartCommand, setTemplateStartCommand] = useState('opencode server --port 8080')
  const [templateStartPort, setTemplateStartPort] = useState('8080')
  const [templateEnvVarsInput, setTemplateEnvVarsInput] = useState('')
  const [templateBuildUpdate, setTemplateBuildUpdate] = useState(true)
  const [templateBuildError, setTemplateBuildError] = useState<string | null>(null)
  const [templateBuildResult, setTemplateBuildResult] = useState<string | null>(null)
  const [templateDeleteError, setTemplateDeleteError] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<TemplateOption | null>(null)

  const [createTemplateName, setCreateTemplateName] = useState('')
  const [createRegion, setCreateRegion] = useState('')
  const [createTimeoutSeconds, setCreateTimeoutSeconds] = useState('')
  const [createInternetAccess, setCreateInternetAccess] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)

  const [sandboxToDelete, setSandboxToDelete] = useState<SandboxListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<ControlTab>('processes')

  const [processes, setProcesses] = useState<ProcessItem[]>([])
  const [isProcessesLoading, setIsProcessesLoading] = useState(false)
  const [processesError, setProcessesError] = useState<string | null>(null)

  const [command, setCommand] = useState('')
  const [commandWorkingDir, setCommandWorkingDir] = useState(ROOT_PATH)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [commandResult, setCommandResult] = useState<string | null>(null)

  const [filesByPath, setFilesByPath] = useState<Record<string, FileTreeItem[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([ROOT_PATH]))
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())
  const [filesError, setFilesError] = useState<string | null>(null)

  const [metrics, setMetrics] = useState<MetricsView | null>(null)
  const [isMetricsLoading, setIsMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState<string | null>(null)

  const [isCreatePending, startCreateTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [isCommandPending, startCommandTransition] = useTransition()
  const [isTemplateBuildPending, startTemplateBuildTransition] = useTransition()
  const [isTemplateDeletePending, startTemplateDeleteTransition] = useTransition()

  const selectedFromList = useMemo(
    () => sandboxes.find((sandbox) => sandbox.id === selectedSandboxId) ?? null,
    [sandboxes, selectedSandboxId],
  )

  const selectedSandbox = selectedSandboxInfo ?? selectedFromList

  const loadSandboxes = useCallback(async (isBackgroundRefresh: boolean) => {
    if (isBackgroundRefresh) {
      setIsSandboxesRefreshing(true)
    } else {
      setIsSandboxesLoading(true)
    }

    try {
      const nextSandboxes = await listSandboxesFn()
      setSandboxes(nextSandboxes)
      setSandboxesError(null)

      if (selectedSandboxId && !nextSandboxes.some((sandbox) => sandbox.id === selectedSandboxId)) {
        setSelectedSandboxId(null)
        setSelectedSandboxInfo(null)
      }
    } catch (error) {
      setSandboxesError(errorMessage(error))
    } finally {
      setIsSandboxesLoading(false)
      setIsSandboxesRefreshing(false)
    }
  }, [selectedSandboxId])

  const loadTemplates = useCallback(async (forceRefresh: boolean) => {
    if (!forceRefresh && templates.length > 0) {
      return
    }

    setIsTemplatesLoading(true)

    try {
      const nextTemplates = await listTemplatesFn()
      setTemplates(nextTemplates)
      setTemplatesError(null)

      if (nextTemplates.length > 0 && createTemplateName.length === 0) {
        setCreateTemplateName(nextTemplates[0].name)
      }
    } catch (error) {
      setTemplatesError(errorMessage(error))
    } finally {
      setIsTemplatesLoading(false)
    }
  }, [templates.length, createTemplateName])

  const loadSelectedSandboxInfo = useCallback(async (sandboxId: string) => {
    try {
      const info = await getSandboxInfoFn({ data: { sandboxId } })
      setSelectedSandboxInfo(info)
    } catch {
      setSelectedSandboxInfo(null)
    }
  }, [])

  const loadProcesses = useCallback(async () => {
    if (!selectedSandboxId) {
      return
    }

    if (processes.length === 0) {
      setIsProcessesLoading(true)
    }

    try {
      const nextProcesses = await listProcessesFn({ data: { sandboxId: selectedSandboxId } })
      setProcesses(nextProcesses)
      setProcessesError(null)
    } catch (error) {
      setProcessesError(errorMessage(error))
    } finally {
      setIsProcessesLoading(false)
    }
  }, [selectedSandboxId, processes.length])

  const loadDirectory = useCallback(async (path: string) => {
    if (!selectedSandboxId) {
      return
    }

    if (filesByPath[path] || loadingPaths.has(path)) {
      return
    }

    setLoadingPaths((prev) => {
      const next = new Set(prev)
      next.add(path)
      return next
    })

    try {
      const files = await listFilesFn({ data: { sandboxId: selectedSandboxId, path } })
      const sorted = sortFileTreeItems(files)

      setFilesByPath((prev) => ({ ...prev, [path]: sorted }))
      setFilesError(null)
    } catch (error) {
      setFilesError(errorMessage(error))
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev)
        next.delete(path)
        return next
      })
    }
  }, [selectedSandboxId, filesByPath, loadingPaths])

  const loadMetrics = useCallback(async () => {
    if (!selectedSandboxId) {
      return
    }

    if (!metrics) {
      setIsMetricsLoading(true)
    }

    try {
      const nextMetrics = await getMetricsFn({ data: { sandboxId: selectedSandboxId } })
      setMetrics(nextMetrics)
      setMetricsError(null)
    } catch (error) {
      setMetricsError(errorMessage(error))
    } finally {
      setIsMetricsLoading(false)
    }
  }, [selectedSandboxId, metrics])

  useEffect(() => {
    void loadSandboxes(false)

    const intervalId = window.setInterval(() => {
      void loadSandboxes(true)
    }, SANDBOX_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [loadSandboxes])

  useEffect(() => {
    void loadTemplates(false)
  }, [loadTemplates])

  useEffect(() => {
    if (!isCreateDialogOpen) {
      return
    }

    void loadTemplates(false)
  }, [isCreateDialogOpen, loadTemplates])

  useEffect(() => {
    if (!selectedSandboxId) {
      return
    }

    setSelectedSandboxInfo(null)
    setActiveTab('processes')
    setProcesses([])
    setProcessesError(null)
    setCommandError(null)
    setCommandResult(null)
    setFilesByPath({})
    setExpandedPaths(new Set([ROOT_PATH]))
    setFilesError(null)
    setMetrics(null)
    setMetricsError(null)

    void loadSelectedSandboxInfo(selectedSandboxId)
  }, [selectedSandboxId, loadSelectedSandboxInfo])

  useEffect(() => {
    if (!selectedSandboxId || activeTab !== 'processes') {
      return
    }

    void loadProcesses()

    const intervalId = window.setInterval(() => {
      void loadProcesses()
    }, PANEL_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeTab, selectedSandboxId, loadProcesses])

  useEffect(() => {
    if (!selectedSandboxId || activeTab !== 'metrics') {
      return
    }

    void loadMetrics()

    const intervalId = window.setInterval(() => {
      void loadMetrics()
    }, PANEL_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeTab, selectedSandboxId, loadMetrics])

  useEffect(() => {
    if (!selectedSandboxId || activeTab !== 'filesystem') {
      return
    }

    void loadDirectory(ROOT_PATH)
  }, [activeTab, selectedSandboxId, loadDirectory])

  const handleCreateSandbox = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!createTemplateName) {
      setCreateError('Select a template before creating a sandbox.')
      return
    }

    const parsedTimeout = parseTimeoutSecondsInput(createTimeoutSeconds)

    if (parsedTimeout === null) {
      setCreateError('Timeout must be a positive integer.')
      return
    }

    setCreateError(null)

    startCreateTransition(() => {
      void (async () => {
        try {
          const created = await createSandboxFn({
            data: {
              templateName: createTemplateName,
              region: createRegion.trim().length > 0 ? createRegion.trim() : undefined,
              timeoutSeconds: parsedTimeout,
              internetAccess: createInternetAccess,
            },
          })

          setIsCreateDialogOpen(false)
          setCreateRegion('')
          setCreateTimeoutSeconds('')
          setCreateInternetAccess(true)
          setSelectedSandboxId(created.id)

          await loadSandboxes(true)
        } catch (error) {
          setCreateError(errorMessage(error))
        }
      })()
    })
  }, [
    createTemplateName,
    createTimeoutSeconds,
    createRegion,
    createInternetAccess,
    loadSandboxes,
  ])

  const handleDeleteSandbox = useCallback(() => {
    if (!sandboxToDelete) {
      return
    }

    setDeleteError(null)

    startDeleteTransition(() => {
      void (async () => {
        try {
          await deleteSandboxFn({ data: { sandboxId: sandboxToDelete.id } })

          if (selectedSandboxId === sandboxToDelete.id) {
            setSelectedSandboxId(null)
            setSelectedSandboxInfo(null)
          }

          setSandboxToDelete(null)
          await loadSandboxes(true)
        } catch (error) {
          setDeleteError(errorMessage(error))
        }
      })()
    })
  }, [sandboxToDelete, selectedSandboxId, loadSandboxes])

  const handleBuildTemplate = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const name = templateBuildName.trim()
    const startCommand = templateStartCommand.trim()

    if (name.length === 0) {
      setTemplateBuildError('Template name is required.')
      return
    }

    if (startCommand.length === 0) {
      setTemplateBuildError('Start command is required.')
      return
    }

    const parsedStartPort = parseOptionalPortInput(templateStartPort)
    if (parsedStartPort === null) {
      setTemplateBuildError('Start port must be an integer from 1 to 65535.')
      return
    }

    const parsedEnvResult = parseEnvLines(templateEnvVarsInput)
    if (!parsedEnvResult.ok) {
      setTemplateBuildError(parsedEnvResult.error)
      return
    }

    setTemplateBuildError(null)
    setTemplateBuildResult(null)

    startTemplateBuildTransition(() => {
      void (async () => {
        try {
          const result = await buildNodeTemplateFn({
            data: {
              name,
              nodeVersion: templateNodeVersion.trim().length > 0 ? templateNodeVersion.trim() : undefined,
              baseImage: templateBaseImage.trim().length > 0 ? templateBaseImage.trim() : undefined,
              installCommand: templateInstallCommand.trim().length > 0 ? templateInstallCommand.trim() : undefined,
              workingDir: templateWorkingDir.trim().length > 0 ? templateWorkingDir.trim() : undefined,
              startCommand,
              startPort: parsedStartPort,
              envVars: parsedEnvResult.envVars,
              update: templateBuildUpdate,
            },
          })

          setTemplateBuildResult(`Template ${result.templateId} built in ${formatDuration(result.durationSeconds)}.`)
          await loadTemplates(true)
        } catch (error) {
          setTemplateBuildError(errorMessage(error))
        }
      })()
    })
  }, [
    templateBuildName,
    templateStartCommand,
    templateStartPort,
    templateEnvVarsInput,
    templateNodeVersion,
    templateBaseImage,
    templateInstallCommand,
    templateWorkingDir,
    templateBuildUpdate,
    loadTemplates,
  ])

  const handleDeleteTemplate = useCallback(() => {
    if (!templateToDelete) {
      return
    }

    setTemplateDeleteError(null)

    startTemplateDeleteTransition(() => {
      void (async () => {
        try {
          await deleteTemplateFn({ data: { templateId: templateToDelete.id } })
          setTemplateToDelete(null)
          await loadTemplates(true)
        } catch (error) {
          setTemplateDeleteError(errorMessage(error))
        }
      })()
    })
  }, [templateToDelete, loadTemplates])

  const handleStartCommand = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedSandboxId) {
      setCommandError('Select a sandbox before running commands.')
      return
    }

    if (command.trim().length === 0) {
      setCommandError('Enter a command to start.')
      return
    }

    const workingDir = resolveWorkingDir(commandWorkingDir)
    setCommandError(null)

    startCommandTransition(() => {
      void (async () => {
        try {
          const result = await startBackgroundCommandFn({
            data: {
              sandboxId: selectedSandboxId,
              command: command.trim(),
              workingDir,
            },
          })

          setCommandResult(`Started process ${result.processId}`)
          setCommand('')
          await loadProcesses()
        } catch (error) {
          setCommandError(errorMessage(error))
        }
      })()
    })
  }, [selectedSandboxId, command, commandWorkingDir, loadProcesses])

  const toggleDirectory = useCallback((path: string) => {
    const isCurrentlyExpanded = expandedPaths.has(path)

    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })

    if (!isCurrentlyExpanded) {
      void loadDirectory(path)
    }
  }, [expandedPaths, loadDirectory])

  const renderDirectoryEntries = useCallback((path: string, depth: number) => {
    const entries = filesByPath[path] ?? []

    if (entries.length === 0 && !loadingPaths.has(path)) {
      return <p className="text-muted-foreground px-3 py-1 text-xs">This directory is empty.</p>
    }

    return entries.map((entry) => {
      const isExpanded = expandedPaths.has(entry.path)
      const hasLoadedChildren = Boolean(filesByPath[entry.path])

      return (
        <div key={entry.path}>
          <div
            className="hover:bg-accent/40 flex items-center gap-2 rounded-md px-3 py-1 text-sm"
            style={{ paddingLeft: `${depth * 16}px` }}
          >
            {entry.isDirectory ? (
              <button
                className="flex flex-1 items-center gap-2 text-left"
                onClick={() => toggleDirectory(entry.path)}
                type="button"
              >
                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                <span>{entry.name}</span>
                <span className="text-muted-foreground text-xs">dir</span>
              </button>
            ) : (
              <>
                <span className="text-muted-foreground inline-flex size-4 items-center justify-center">-</span>
                <span className="flex-1 truncate">{entry.name}</span>
              </>
            )}
            {!entry.isDirectory && (
              <span className="text-muted-foreground text-xs">{formatFileSize(entry.size)}</span>
            )}
            <span className="text-muted-foreground hidden text-xs md:block">{formatDate(entry.modifiedTime)}</span>
          </div>

          {entry.isDirectory && isExpanded && (
            <div>
              {!hasLoadedChildren && loadingPaths.has(entry.path) && (
                <div className="text-muted-foreground flex items-center gap-2 px-3 py-1 text-xs" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
                  <Spinner className="size-3" /> Loading...
                </div>
              )}
              {hasLoadedChildren && renderDirectoryEntries(entry.path, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }, [filesByPath, loadingPaths, expandedPaths, toggleDirectory])

  const selectedStatus = selectedSandbox ? selectedSandbox.status : 'unknown'

  return (
    <main className="relative z-10 min-h-screen bg-linear-to-b from-[#f7fafc]/90 via-[#f9fafb]/90 to-[#ecf4f7]/90 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 lg:gap-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-muted-foreground text-sm">HopX Control Plane</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Sandbox Control Panel</h1>
          </div>
          <Badge className="rounded-md px-3 py-1" variant="outline">
            SDK-only mode
          </Badge>
        </header>

        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-6">
          <Card className="h-[calc(100vh-9.5rem)] py-4">
            <CardHeader className="px-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Sandboxes</CardTitle>
                  <CardDescription>Up to 25 instances with auto-refresh every 12s.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setIsCreateDialogOpen(true)
                    }}
                    size="sm"
                    type="button"
                  >
                    <Plus className="size-4" />
                    Create
                  </Button>
                  <Button
                    onClick={() => {
                      void loadSandboxes(true)
                    }}
                    size="icon-sm"
                    type="button"
                    variant="outline"
                  >
                    {isSandboxesRefreshing ? <Spinner /> : <RefreshCw className="size-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-2">
              {sandboxesError && (
                <Alert className="mx-2 mb-3" variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Unable to load sandboxes</AlertTitle>
                  <AlertDescription>{sandboxesError}</AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[calc(100vh-15rem)] px-2">
                {isSandboxesLoading ? (
                  <div className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
                    <Spinner /> Loading sandboxes...
                  </div>
                ) : sandboxes.length === 0 ? (
                  <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
                    No sandboxes found. Create one to get started.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sandboxes.map((sandbox) => {
                      const isSelected = sandbox.id === selectedSandboxId

                      return (
                        <button
                          className={`w-full rounded-lg border p-3 text-left transition ${
                            isSelected
                              ? 'border-cyan-300 bg-cyan-50/80 shadow-xs'
                              : 'hover:bg-accent/50 border-border bg-card'
                          }`}
                          key={sandbox.id}
                          onClick={() => {
                            setSelectedSandboxId(sandbox.id)
                          }}
                          type="button"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div>
                              <p className="truncate font-medium">{sandbox.id}</p>
                              <p className="text-muted-foreground text-xs">{sandbox.templateName ?? 'Unknown template'}</p>
                            </div>
                            <Badge variant={statusVariant(sandbox.status)}>{sandbox.status}</Badge>
                          </div>

                          <div className="text-muted-foreground space-y-1 text-xs">
                            <p>Region: {sandbox.region ?? 'n/a'}</p>
                            <p>Created: {formatDate(sandbox.createdAt)}</p>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              onClick={(event) => {
                                event.stopPropagation()
                                setDeleteError(null)
                                setSandboxToDelete(sandbox)
                              }}
                              size="xs"
                              type="button"
                              variant="destructive"
                            >
                              <Trash2 className="size-3" /> Destroy
                            </Button>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="h-[calc(100vh-9.5rem)] py-4">
            {!selectedSandboxId || !selectedSandbox ? (
              <CardContent className="flex h-full items-center justify-center px-8">
                <div className="max-w-md text-center">
                  <HardDrive className="text-muted-foreground mx-auto mb-3 size-7" />
                  <h2 className="text-lg font-semibold">Select a sandbox</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Pick a sandbox from the left panel to inspect processes, run commands, browse files, and watch metrics.
                  </p>
                </div>
              </CardContent>
            ) : (
              <>
                <CardHeader className="px-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{selectedSandbox.id}</CardTitle>
                      <CardDescription>
                        {selectedSandbox.templateName ?? 'Unknown template'} • {selectedSandbox.region ?? 'n/a'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusVariant(selectedStatus)}>{selectedStatus}</Badge>
                      <Button
                        onClick={() => {
                          void loadSelectedSandboxInfo(selectedSandbox.id)
                        }}
                        size="icon-sm"
                        type="button"
                        variant="outline"
                      >
                        <RefreshCw className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-muted-foreground grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                    <p>Created: {formatDate(selectedSandbox.createdAt)}</p>
                    <p>Expires: {formatDate(selectedSandbox.expiresAt)}</p>
                    <p>Timeout: {selectedSandbox.timeoutSeconds ? `${selectedSandbox.timeoutSeconds}s` : 'none'}</p>
                  </div>
                </CardHeader>

                <CardContent className="flex min-h-0 flex-1 flex-col px-4">
                  <Tabs
                    className="flex min-h-0 flex-1 flex-col"
                    onValueChange={(value) => {
                      setActiveTab(value as ControlTab)
                    }}
                    value={activeTab}
                  >
                    <TabsList className="w-full justify-start" variant="line">
                      <TabsTrigger value="processes">Processes</TabsTrigger>
                      <TabsTrigger value="commands">Commands</TabsTrigger>
                      <TabsTrigger value="filesystem">File System</TabsTrigger>
                      <TabsTrigger value="metrics">Metrics</TabsTrigger>
                      <TabsTrigger value="desktop">Desktop</TabsTrigger>
                    </TabsList>

                    <TabsContent className="min-h-0 flex-1 pt-3" value="processes">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-medium">Background processes</h3>
                        <Button
                          onClick={() => {
                            void loadProcesses()
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RefreshCw className="size-4" /> Refresh
                        </Button>
                      </div>

                      {processesError && (
                        <Alert className="mb-3" variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>Failed to load processes</AlertTitle>
                          <AlertDescription>{processesError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="rounded-md border">
                        <ScrollArea className="h-[calc(100vh-24rem)]">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40 sticky top-0">
                              <tr className="text-muted-foreground border-b text-left text-xs">
                                <th className="px-3 py-2 font-medium">Process ID</th>
                                <th className="px-3 py-2 font-medium">Name</th>
                                <th className="px-3 py-2 font-medium">Status</th>
                                <th className="px-3 py-2 font-medium">PID</th>
                                <th className="px-3 py-2 font-medium">Started</th>
                                <th className="px-3 py-2 font-medium">End</th>
                                <th className="px-3 py-2 font-medium">Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {isProcessesLoading ? (
                                <tr>
                                  <td className="text-muted-foreground px-3 py-4" colSpan={7}>
                                    <span className="inline-flex items-center gap-2"><Spinner /> Loading processes...</span>
                                  </td>
                                </tr>
                              ) : processes.length === 0 ? (
                                <tr>
                                  <td className="text-muted-foreground px-3 py-4" colSpan={7}>
                                    No background processes found.
                                  </td>
                                </tr>
                              ) : (
                                processes.map((process) => (
                                  <tr className="border-b" key={process.processId}>
                                    <td className="px-3 py-2 font-mono text-xs">{process.processId}</td>
                                    <td className="px-3 py-2">{process.name ?? '-'}</td>
                                    <td className="px-3 py-2"><Badge variant={statusVariant(process.status)}>{process.status}</Badge></td>
                                    <td className="px-3 py-2 font-mono text-xs">{process.pid ?? '-'}</td>
                                    <td className="px-3 py-2 text-xs">{formatDate(process.startedAt)}</td>
                                    <td className="px-3 py-2 text-xs">{formatDate(process.endTime)}</td>
                                    <td className="px-3 py-2 text-xs">{formatDuration(process.durationSeconds)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent className="pt-3" value="commands">
                      <form className="space-y-3" onSubmit={handleStartCommand}>
                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor="command-input">Command</label>
                          <Textarea
                            id="command-input"
                            onChange={(event) => {
                              setCommand(event.target.value)
                            }}
                            placeholder="npm run dev"
                            rows={3}
                            value={command}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-sm font-medium" htmlFor="workdir-input">Working directory</label>
                          <Input
                            id="workdir-input"
                            onChange={(event) => {
                              setCommandWorkingDir(event.target.value)
                            }}
                            placeholder={ROOT_PATH}
                            value={commandWorkingDir}
                          />
                        </div>

                        {commandError && (
                          <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>Command failed</AlertTitle>
                            <AlertDescription>{commandError}</AlertDescription>
                          </Alert>
                        )}

                        {commandResult && (
                          <Alert>
                            <Rocket className="size-4" />
                            <AlertTitle>Command queued</AlertTitle>
                            <AlertDescription>{commandResult}</AlertDescription>
                          </Alert>
                        )}

                        <Button disabled={isCommandPending} type="submit">
                          {isCommandPending ? <Spinner /> : <Rocket className="size-4" />} Start Background Command
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent className="min-h-0 flex-1 pt-3" value="filesystem">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-medium">Read-only tree</h3>
                        <Button
                          onClick={() => {
                            setFilesByPath({})
                            void loadDirectory(ROOT_PATH)
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RefreshCw className="size-4" /> Refresh root
                        </Button>
                      </div>

                      {filesError && (
                        <Alert className="mb-3" variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>Unable to load file system</AlertTitle>
                          <AlertDescription>{filesError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="rounded-md border bg-background">
                        <ScrollArea className="h-[calc(100vh-26rem)] p-2 font-mono text-sm">
                          <div>
                            <button
                              className="hover:bg-accent/40 flex w-full items-center gap-2 rounded-md px-3 py-1 text-left"
                              onClick={() => {
                                toggleDirectory(ROOT_PATH)
                              }}
                              type="button"
                            >
                              {expandedPaths.has(ROOT_PATH) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                              <span>{ROOT_PATH}</span>
                            </button>

                            {loadingPaths.has(ROOT_PATH) && (
                              <div className="text-muted-foreground flex items-center gap-2 px-3 py-1 text-xs" style={{ paddingLeft: '16px' }}>
                                <Spinner className="size-3" /> Loading...
                              </div>
                            )}

                            {expandedPaths.has(ROOT_PATH) && filesByPath[ROOT_PATH] && renderDirectoryEntries(ROOT_PATH, 1)}
                          </div>
                        </ScrollArea>
                      </div>
                    </TabsContent>

                    <TabsContent className="min-h-0 flex-1 pt-3" value="metrics">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-medium">Runtime metrics</h3>
                        <Button
                          onClick={() => {
                            void loadMetrics()
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          <RefreshCw className="size-4" /> Refresh
                        </Button>
                      </div>

                      {metricsError && (
                        <Alert className="mb-3" variant="destructive">
                          <AlertCircle className="size-4" />
                          <AlertTitle>Unable to load metrics</AlertTitle>
                          <AlertDescription>{metricsError}</AlertDescription>
                        </Alert>
                      )}

                      {isMetricsLoading && !metrics ? (
                        <div className="text-muted-foreground inline-flex items-center gap-2 text-sm"><Spinner /> Loading metrics...</div>
                      ) : metrics ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                            <MetricCard label="Uptime (s)" value={formatMetric(metrics.uptimeSeconds)} />
                            <MetricCard label="Requests" value={formatMetric(metrics.requestsTotal)} />
                            <MetricCard label="Errors" value={formatMetric(metrics.errorCount)} />
                            <MetricCard label="Total exec" value={formatMetric(metrics.totalExecutions)} />
                            <MetricCard label="Active exec" value={formatMetric(metrics.activeExecutions)} />
                            <MetricCard label="Avg ms" value={formatMetric(metrics.avgDurationMs)} />
                            <MetricCard label="P95 ms" value={formatMetric(metrics.p95DurationMs)} />
                          </div>

                          <Separator />

                          <div className="space-y-1">
                            <p className="text-sm font-medium">Raw snapshot</p>
                            <ScrollArea className="h-[calc(100vh-33rem)] rounded-md border bg-slate-950 p-3">
                              <pre className="text-xs text-slate-100">{JSON.stringify(metrics.raw, null, 2)}</pre>
                            </ScrollArea>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No metrics available.</p>
                      )}
                    </TabsContent>

                    <TabsContent className="pt-3" value="desktop">
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <p className="font-medium">Desktop automation coming next</p>
                        <p className="text-muted-foreground mt-1 text-sm">
                          This placeholder reserves the panel for future noVNC integration and desktop control actions.
                        </p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            )}
          </Card>
        </div>

        <Card className="py-4">
          <CardHeader className="px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Templates</CardTitle>
                <CardDescription>
                  List templates and build a Node template with OpenCode pre-installed.
                  {' '}
                  <a className="underline" href="https://docs.hopx.ai/core-concepts/templates/building" rel="noreferrer" target="_blank">
                    Docs
                  </a>
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  void loadTemplates(true)
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw className="size-4" /> Refresh templates
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 px-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              {templatesError && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Unable to load templates</AlertTitle>
                  <AlertDescription>{templatesError}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <ScrollArea className="h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 sticky top-0">
                      <tr className="text-muted-foreground border-b text-left text-xs">
                        <th className="px-3 py-2 font-medium">Template</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Visibility</th>
                        <th className="px-3 py-2 font-medium">Updated</th>
                        <th className="px-3 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {isTemplatesLoading ? (
                        <tr>
                          <td className="text-muted-foreground px-3 py-4" colSpan={5}>
                            <span className="inline-flex items-center gap-2"><Spinner /> Loading templates...</span>
                          </td>
                        </tr>
                      ) : templates.length === 0 ? (
                        <tr>
                          <td className="text-muted-foreground px-3 py-4" colSpan={5}>
                            No templates found.
                          </td>
                        </tr>
                      ) : (
                        templates.map((template) => (
                          <tr className="border-b" key={template.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium">{template.displayName}</p>
                              <p className="text-muted-foreground font-mono text-xs">{template.name}</p>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={statusVariant(template.status ?? 'unknown')}>{template.status ?? 'unknown'}</Badge>
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {template.isPublic === null ? 'n/a' : template.isPublic ? 'public' : 'private'}
                            </td>
                            <td className="px-3 py-2 text-xs">{formatDate(template.updatedAt ?? template.createdAt)}</td>
                            <td className="px-3 py-2 text-right">
                              {template.isPublic === false && (
                                <Button
                                  onClick={() => {
                                    setTemplateDeleteError(null)
                                    setTemplateToDelete(template)
                                  }}
                                  size="xs"
                                  type="button"
                                  variant="destructive"
                                >
                                  <Trash2 className="size-3" /> Delete
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">Build Node Template</h3>
                <Button
                  onClick={() => {
                    setTemplateBuildName('node-opencode')
                    setTemplateNodeVersion('22')
                    setTemplateBaseImage('node:22-bookworm')
                    setTemplateInstallCommand('npm install -g opencode-ai')
                    setTemplateWorkingDir('/workspace')
                    setTemplateStartCommand('opencode server --port 8080')
                    setTemplateStartPort('8080')
                    setTemplateEnvVarsInput('')
                    setTemplateBuildUpdate(true)
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  OpenCode preset
                </Button>
              </div>

              <form className="space-y-3" onSubmit={handleBuildTemplate}>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-build-name">Template name</label>
                  <Input
                    id="template-build-name"
                    onChange={(event) => {
                      setTemplateBuildName(event.target.value)
                    }}
                    placeholder="node-opencode"
                    value={templateBuildName}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="template-node-version">Node version</label>
                    <Input
                      id="template-node-version"
                      onChange={(event) => {
                        setTemplateNodeVersion(event.target.value)
                      }}
                    placeholder="22"
                      value={templateNodeVersion}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="template-start-port">Ready port (optional)</label>
                    <Input
                      id="template-start-port"
                      onChange={(event) => {
                        setTemplateStartPort(event.target.value)
                      }}
                      placeholder="8080"
                      type="number"
                      value={templateStartPort}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-base-image">Base image</label>
                  <Input
                    id="template-base-image"
                    onChange={(event) => {
                      setTemplateBaseImage(event.target.value)
                    }}
                    placeholder="node:22-bookworm"
                    value={templateBaseImage}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-install-cmd">Install command</label>
                  <Input
                    id="template-install-cmd"
                    onChange={(event) => {
                      setTemplateInstallCommand(event.target.value)
                    }}
                    placeholder="npm install -g opencode"
                    value={templateInstallCommand}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-workdir">Working directory</label>
                  <Input
                    id="template-workdir"
                    onChange={(event) => {
                      setTemplateWorkingDir(event.target.value)
                    }}
                    placeholder="/workspace"
                    value={templateWorkingDir}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-start-cmd">Start command</label>
                  <Input
                    id="template-start-cmd"
                    onChange={(event) => {
                      setTemplateStartCommand(event.target.value)
                    }}
                    placeholder="opencode server --port 8080"
                    value={templateStartCommand}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="template-env-vars">Environment variables (KEY=VALUE per line)</label>
                  <Textarea
                    id="template-env-vars"
                    onChange={(event) => {
                      setTemplateEnvVarsInput(event.target.value)
                    }}
                    placeholder="OPENCODE_HOST=0.0.0.0"
                    rows={4}
                    value={templateEnvVarsInput}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Update existing name</p>
                    <p className="text-muted-foreground text-xs">Replace template if this name already exists.</p>
                  </div>
                  <Switch
                    checked={templateBuildUpdate}
                    onCheckedChange={(checked) => {
                      setTemplateBuildUpdate(checked)
                    }}
                  />
                </div>

                {templateBuildError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Template build failed</AlertTitle>
                    <AlertDescription>{templateBuildError}</AlertDescription>
                  </Alert>
                )}

                {templateBuildResult && (
                  <Alert>
                    <AlertTitle>Template build started</AlertTitle>
                    <AlertDescription>{templateBuildResult}</AlertDescription>
                  </Alert>
                )}

                <Button disabled={isTemplateBuildPending} type="submit">
                  {isTemplateBuildPending ? <Spinner /> : <Plus className="size-4" />} Build template
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog onOpenChange={setIsCreateDialogOpen} open={isCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create sandbox</DialogTitle>
            <DialogDescription>Create a HopX sandbox from template with optional region and timeout.</DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleCreateSandbox}>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="template-select">Template</label>
              <Select
                onValueChange={(value) => {
                  setCreateTemplateName(value)
                }}
                value={createTemplateName}
              >
                <SelectTrigger className="w-full" id="template-select">
                  <SelectValue placeholder={isTemplatesLoading ? 'Loading templates...' : 'Select template'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.name}>
                      {template.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {templatesError && <p className="text-destructive text-xs">{templatesError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="region-input">Region (optional)</label>
              <Input
                id="region-input"
                onChange={(event) => {
                  setCreateRegion(event.target.value)
                }}
                placeholder="us-east"
                value={createRegion}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="timeout-input">Timeout seconds (optional)</label>
              <Input
                id="timeout-input"
                onChange={(event) => {
                  setCreateTimeoutSeconds(event.target.value)
                }}
                placeholder="3600"
                type="number"
                value={createTimeoutSeconds}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Internet access</p>
                <p className="text-muted-foreground text-xs">Enable outbound internet for the sandbox.</p>
              </div>
              <Switch
                checked={createInternetAccess}
                onCheckedChange={(checked) => {
                  setCreateInternetAccess(checked)
                }}
              />
            </div>

            {createError && <p className="text-destructive text-sm">{createError}</p>}

            <DialogFooter>
              <Button
                onClick={() => {
                  setIsCreateDialogOpen(false)
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={isCreatePending || isTemplatesLoading || createTemplateName.length === 0} type="submit">
                {isCreatePending ? <Spinner /> : <Plus className="size-4" />} Create sandbox
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSandboxToDelete(null)
            setDeleteError(null)
          }
        }}
        open={Boolean(sandboxToDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Destroy sandbox</DialogTitle>
            <DialogDescription>
              This action permanently destroys sandbox <span className="font-mono">{sandboxToDelete?.id}</span>.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Delete failed</AlertTitle>
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setSandboxToDelete(null)
                setDeleteError(null)
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isDeletePending} onClick={handleDeleteSandbox} type="button" variant="destructive">
              {isDeletePending ? <Spinner /> : <Trash2 className="size-4" />} Destroy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setTemplateToDelete(null)
            setTemplateDeleteError(null)
          }
        }}
        open={Boolean(templateToDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template</DialogTitle>
            <DialogDescription>
              This permanently deletes template <span className="font-mono">{templateToDelete?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          {templateDeleteError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Delete failed</AlertTitle>
              <AlertDescription>{templateDeleteError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              onClick={() => {
                setTemplateToDelete(null)
                setTemplateDeleteError(null)
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isTemplateDeletePending} onClick={handleDeleteTemplate} type="button" variant="destructive">
              {isTemplateDeletePending ? <Spinner /> : <Trash2 className="size-4" />} Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

export function formatDate(value: string | null): string {
  if (!value) {
    return 'n/a'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

export function formatDuration(value: number | null): string {
  if (value === null) {
    return '-'
  }

  return `${value.toFixed(2)}s`
}

export function formatFileSize(size: number | null): string {
  if (size === null) {
    return 'n/a'
  }

  if (size < 1024) {
    return `${size} B`
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function formatMetric(value: number | null): string {
  return value === null ? 'n/a' : String(value)
}

export function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const normalized = status.toLowerCase()

  if (normalized === 'running' || normalized === 'active') {
    return 'default'
  }

  if (normalized === 'paused' || normalized === 'stopped') {
    return 'secondary'
  }

  if (normalized === 'failed' || normalized === 'error' || normalized === 'killed') {
    return 'destructive'
  }

  return 'outline'
}

export function resolveWorkingDir(value: string): string {
  return value.trim().length > 0 ? value.trim() : ROOT_PATH
}

export function parseTimeoutSecondsInput(value: string): number | undefined | null {
  if (value.trim().length === 0) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export function parseOptionalPortInput(value: string): number | undefined | null {
  if (value.trim().length === 0) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return null
  }

  return parsed
}

export function parseEnvLines(value: string): { ok: true; envVars: Record<string, string> } | { ok: false; error: string } {
  const envVars: Record<string, string> = {}
  const lines = value.split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (line.length === 0 || line.startsWith('#')) {
      continue
    }

    const delimiterIndex = line.indexOf('=')
    if (delimiterIndex <= 0) {
      return { ok: false, error: `Invalid env var on line ${index + 1}. Use KEY=VALUE format.` }
    }

    const key = line.slice(0, delimiterIndex).trim()
    const valuePart = line.slice(delimiterIndex + 1).trim()

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return { ok: false, error: `Invalid env var key "${key}" on line ${index + 1}.` }
    }

    envVars[key] = valuePart
  }

  return { ok: true, envVars }
}

export function sortFileTreeItems(files: FileTreeItem[]): FileTreeItem[] {
  return [...files].sort((left, right) => {
    if (left.isDirectory && !right.isDirectory) {
      return -1
    }
    if (!left.isDirectory && right.isDirectory) {
      return 1
    }
    return left.name.localeCompare(right.name)
  })
}
