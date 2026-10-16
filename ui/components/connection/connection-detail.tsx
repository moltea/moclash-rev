import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { XIcon } from 'lucide-react'
import { useCallback, useImperativeHandle, useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { closeConnection } from 'tauri-plugin-mihomo-api'

import parseTraffic from '@/utils/parse-traffic'
import { Button } from '@ui/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@ui/components/ui/sheet'

export interface ConnectionDetailRef {
  open: (detail: IConnectionsItem, closed: boolean) => void
  close: () => void
}

export function ConnectionDetail({ ref }: { ref?: Ref<ConnectionDetailRef> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<IConnectionsItem | null>(null)
  const [closed, setClosed] = useState(false)

  const onClose = useCallback(() => {
    setOpen(false)
    setDetail(null)
    setClosed(false)
  }, [])

  useImperativeHandle(ref, () => ({
    open: (detail: IConnectionsItem, closed: boolean) => {
      if (open) return
      setOpen(true)
      setDetail(detail)
      setClosed(closed)
    },
    close: onClose,
  }))

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent className="gap-0 sm:max-w-md">
        <SheetHeader className="pe-12">
          <SheetTitle className="break-all">
            {detail
              ? detail.metadata.host ||
                detail.metadata.destinationIP ||
                detail.metadata.remoteDestination
              : t('connections.page.title')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('connections.page.title')}
          </SheetDescription>
        </SheetHeader>
        {detail && (
          <InnerConnectionDetail
            data={detail}
            closed={closed}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

interface InnerProps {
  data: IConnectionsItem
  closed: boolean
  onClose?: () => void
}

const InnerConnectionDetail = ({ data, closed, onClose }: InnerProps) => {
  const { t } = useTranslation()
  const { metadata, rulePayload } = data
  const chains = [...data.chains].reverse().join(' / ')
  const rule = rulePayload ? `${data.rule}(${rulePayload})` : data.rule
  const hostAddress =
    metadata.host || metadata.destinationIP || metadata.remoteDestination
  const host = `${hostAddress}:${metadata.destinationPort}`
  const Destination = metadata.destinationIP
    ? metadata.destinationIP
    : metadata.remoteDestination

  const information = [
    { label: t('connections.components.fields.host'), value: host },
    {
      label: t('shared.labels.downloaded'),
      value: parseTraffic(data.download).join(' '),
    },
    {
      label: t('shared.labels.uploaded'),
      value: parseTraffic(data.upload).join(' '),
    },
    {
      label: t('connections.components.fields.dlSpeed'),
      value: parseTraffic(data.curDownload ?? -1).join(' ') + '/s',
    },
    {
      label: t('connections.components.fields.ulSpeed'),
      value: parseTraffic(data.curUpload ?? -1).join(' ') + '/s',
    },
    {
      label: t('connections.components.fields.chains'),
      value: chains,
    },
    { label: t('connections.components.fields.rule'), value: rule },
    {
      label: t('connections.components.fields.process'),
      value: `${metadata.process}${metadata.processPath ? `(${metadata.processPath})` : ''}`,
    },
    {
      label: t('connections.components.fields.time'),
      value: dayjs(data.start).fromNow(),
    },
    {
      label: t('connections.components.fields.source'),
      value: `${metadata.sourceIP}:${metadata.sourcePort}`,
    },
    {
      label: t('connections.components.fields.destination'),
      value: Destination,
    },
    {
      label: t('connections.components.fields.destinationPort'),
      value: `${metadata.destinationPort}`,
    },
    {
      label: t('connections.components.fields.type'),
      value: `${metadata.type}(${metadata.network})`,
    },
  ]

  const onDelete = useLockFn(async () => closeConnection(data.id))

  return (
    <>
      <dl className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-6 pb-6 select-text">
        {information.map((each) => (
          <div key={each.label} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{each.label}</dt>
            <dd className="font-medium break-all">{each.value}</dd>
          </div>
        ))}
      </dl>

      {!closed && (
        <SheetFooter className="border-t pt-4">
          <Button
            variant="destructive"
            title={t('connections.components.actions.closeConnection')}
            onClick={() => {
              onDelete()
              onClose?.()
            }}
          >
            <XIcon data-icon="inline-start" />
            {t('connections.components.actions.closeConnection')}
          </Button>
        </SheetFooter>
      )}
    </>
  )
}
