import { createFileRoute } from '@tanstack/react-router'

import { HopxControlPanel } from '@/features/hopx/control-panel'

export const Route = createFileRoute('/')({ component: HopxControlPanel })
