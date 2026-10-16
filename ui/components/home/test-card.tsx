import {
  DragDropProvider,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/react'
import { isSortable } from '@dnd-kit/react/sortable'
import { GaugeIcon, PlusIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import apple from '@/assets/image/test/apple.svg?raw'
import github from '@/assets/image/test/github.svg?raw'
import google from '@/assets/image/test/google.svg?raw'
import youtube from '@/assets/image/test/youtube.svg?raw'
import { useVerge } from '@/hooks/use-verge'
import { emitTestAll } from '@/services/bus'
import { SortableItem } from '@ui/components/base'
import { TestItem } from '@ui/components/test/test-item'
import { TestViewer, type TestViewerRef } from '@ui/components/test/test-viewer'
import { Button } from '@ui/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@ui/components/ui/tooltip'

import { EnhancedCard } from './enhanced-card'

const DEFAULT_TEST_LIST = [
  {
    uid: nanoid(),
    name: 'Apple',
    url: 'https://www.apple.com',
    icon: apple,
  },
  {
    uid: nanoid(),
    name: 'GitHub',
    url: 'https://www.github.com',
    icon: github,
  },
  {
    uid: nanoid(),
    name: 'Google',
    url: 'https://www.google.com',
    icon: google,
  },
  {
    uid: nanoid(),
    name: 'YouTube',
    url: 'https://www.youtube.com',
    icon: youtube,
  },
]

export const TestCard = () => {
  const { t } = useTranslation()
  const { verge, mutateVerge, patchVerge } = useVerge()
  const viewerRef = useRef<TestViewerRef>(null)

  const testList = useMemo(() => {
    return verge?.test_list ?? DEFAULT_TEST_LIST
  }, [verge?.test_list])

  const onTestListItemChange = useCallback(
    (uid: string, patch?: Partial<IVergeTestItem>) => {
      if (!patch) {
        mutateVerge()
        return
      }

      const newList = testList.map((x) =>
        x.uid === uid ? { ...x, ...patch } : x,
      )

      mutateVerge({ ...verge, test_list: newList }, false)
    },
    [testList, verge, mutateVerge],
  )

  const onDeleteTestListItem = useCallback(
    (uid: string) => {
      const newList = testList.filter((x) => x.uid !== uid)
      patchVerge({ test_list: newList })
      mutateVerge({ ...verge, test_list: newList }, false)
    },
    [testList, verge, patchVerge, mutateVerge],
  )

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { operation, canceled } = event
      const { source, target } = operation

      if (canceled || !target || !isSortable(source)) return

      const { index: newIndex, initialIndex: oldIndex } = source.sortable
      if (
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= testList.length ||
        newIndex >= testList.length ||
        oldIndex === newIndex
      ) {
        return
      }

      const activeId = testList[oldIndex].uid
      const overId = testList[newIndex].uid

      if (activeId == null || overId == null || activeId === overId) return

      const newList = [...testList]
      const [removed] = newList.splice(oldIndex, 1)
      newList.splice(newIndex, 0, removed)

      mutateVerge({ ...verge, test_list: newList }, false)
      const patchFn = () => {
        try {
          patchVerge({ test_list: newList })
        } catch {}
      }
      if (window.requestIdleCallback) {
        window.requestIdleCallback(patchFn)
      } else {
        setTimeout(patchFn, 0)
      }
    },
    [testList, verge, mutateVerge, patchVerge],
  )

  useEffect(() => {
    if (verge && !verge.test_list) {
      patchVerge({ test_list: DEFAULT_TEST_LIST })
    }
  }, [verge, patchVerge])

  const renderTestItems = useMemo(
    () => (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-2 p-0.5">
        {testList.map((item, index) => (
          <SortableItem key={item.uid} id={item.uid!} index={index}>
            <TestItem
              itemData={item}
              onEdit={() => viewerRef.current?.edit(item)}
              onDelete={onDeleteTestListItem}
            />
          </SortableItem>
        ))}
      </div>
    ),
    [testList, onDeleteTestListItem],
  )

  const handleTestAll = useCallback(() => {
    emitTestAll()
  }, [])

  const handleCreateTest = useCallback(() => {
    viewerRef.current?.create()
  }, [])

  return (
    <EnhancedCard
      title={t('home.components.tests.title')}
      icon={<GaugeIcon />}
      action={
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleTestAll}
                aria-label={t('tests.page.actions.testAll')}
              >
                <GaugeIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('tests.page.actions.testAll')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCreateTest}
                aria-label={t('tests.modals.test.title.create')}
              >
                <PlusIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('tests.modals.test.title.create')}
            </TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="max-h-[180px] overflow-x-hidden overflow-y-auto">
        <DragDropProvider sensors={[PointerSensor]} onDragEnd={onDragEnd}>
          {renderTestItems}
        </DragDropProvider>
      </div>

      <TestViewer ref={viewerRef} onChange={onTestListItemChange} />
    </EnhancedCard>
  )
}
