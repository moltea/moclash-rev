import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { CopyIcon } from 'lucide-react'
import type { Ref } from 'react'
import { useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useNetworkInterfaces } from '@/hooks/use-network'
import { showNotice } from '@/services/notice-service'
import { BaseDialog, BaseEmpty, type DialogRef } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import { Separator } from '@ui/components/ui/separator'
import { Spinner } from '@ui/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@ui/components/ui/toggle-group'

export function NetworkInterfaceViewer({ ref }: { ref?: Ref<DialogRef> }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [isV4, setIsV4] = useState(true)

  useImperativeHandle(ref, () => ({
    open: () => {
      setOpen(true)
    },
    close: () => setOpen(false),
  }))

  const { networkInterfaces, loading } = useNetworkInterfaces()
  const isEmpty = networkInterfaces.length === 0
  const getAddressIp = (address: IAddress) =>
    isV4 ? address.V4?.ip : address.V6?.ip

  return (
    <BaseDialog
      open={open}
      title={t('settings.modals.networkInterface.title')}
      disableOk
      cancelBtn={t('shared.actions.close')}
      onClose={() => setOpen(false)}
      onCancel={() => setOpen(false)}
    >
      <div className="flex flex-col gap-3 py-1">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={isV4 ? 'v4' : 'v6'}
          onValueChange={(value) => {
            if (value) setIsV4(value === 'v4')
          }}
        >
          <ToggleGroupItem value="v4">Ipv4</ToggleGroupItem>
          <ToggleGroupItem value="v6">Ipv6</ToggleGroupItem>
        </ToggleGroup>

        {loading && isEmpty ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-6" />
          </div>
        ) : isEmpty ? (
          <BaseEmpty className="min-h-40" />
        ) : (
          networkInterfaces.map((item, index) => (
            <div key={item.name} className="flex flex-col gap-2">
              {index > 0 && <Separator />}
              <h4 className="text-sm font-semibold">{item.name}</h4>
              <div className="flex flex-col gap-1.5">
                {item.addr.map((address) => {
                  const ip = getAddressIp(address)
                  return (
                    ip && (
                      <AddressDisplay
                        key={ip}
                        label={t(
                          'settings.modals.networkInterface.fields.ipAddress',
                        )}
                        content={ip}
                      />
                    )
                  )
                })}
                <AddressDisplay
                  label={t(
                    'settings.modals.networkInterface.fields.macAddress',
                  )}
                  content={item.mac_addr ?? ''}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </BaseDialog>
  )
}

const AddressDisplay = ({
  label,
  content,
}: {
  label: string
  content: string
}) => {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-0.5 rounded-md bg-muted py-0.5 ps-2 pe-0.5">
        <span className="truncate font-mono select-text">{content}</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={async () => {
            await writeText(content)
            showNotice.success(
              'shared.feedback.notifications.common.copySuccess',
            )
          }}
        >
          <CopyIcon />
        </Button>
      </div>
    </div>
  )
}
