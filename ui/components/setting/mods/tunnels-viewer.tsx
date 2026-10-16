import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from 'lucide-react'
import {
  forwardRef,
  type ReactNode,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useClash } from '@/hooks/use-clash'
import { useProxiesData } from '@/providers/app-data-context'
import { probeListener, type ListenerTransport } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import {
  isInteractableMember,
  rebindMemberOccurrence,
  resolveMember,
  toMemberOccurrenceBinding,
  type ProxyMemberOccurrenceBinding,
  type ResolvedProxyMember,
} from '@/types/proxy-view'
import {
  formatHostPort,
  isValidPort,
  normalizeHost,
  normalizeListenHost,
} from '@/utils/network'
import { BaseDialog } from '@ui/components/base'
import { Button } from '@ui/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@ui/components/ui/collapsible'
import { Field, FieldGroup, FieldLabel } from '@ui/components/ui/field'
import { Input } from '@ui/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from '@ui/components/ui/item'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/ui/select'
import { Separator } from '@ui/components/ui/separator'

interface TunnelsViewerRef {
  open: () => void
  close: () => void
}

interface TunnelEntry {
  network: string[]
  address: string
  target: string
  proxy?: string
}

interface TunnelProxyOption {
  memberIndex: number
  member: ResolvedProxyMember
}

type TunnelNetwork = ListenerTransport | 'tcp+udp'

interface TunnelFormValues {
  localAddr: string
  localPort: string
  targetAddr: string
  targetPort: string
  network: TunnelNetwork
  group: string
  proxy: ProxyMemberOccurrenceBinding | null
}

const DEFAULT_OPTION = '__default__'

const proxyOptionToken = ({ memberIndex, member }: TunnelProxyOption) =>
  `${memberIndex}:${
    member.kind === 'node' ? member.node.recordId : member.ref.name
  }`

const FormRow = ({
  id,
  label,
  children,
}: {
  id: string
  label: ReactNode
  children: ReactNode
}) => (
  <Field orientation="horizontal">
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    {children}
  </Field>
)

export const TunnelsViewer = forwardRef<TunnelsViewerRef>((_, ref) => {
  const { t } = useTranslation()
  const { clash, mutateClash, patchClash } = useClash()

  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [values, setValues] = useState<TunnelFormValues>({
    localAddr: '',
    localPort: '',
    targetAddr: '',
    targetPort: '',
    network: 'tcp+udp',
    group: '',
    proxy: null,
  })
  const [draftTunnels, setDraftTunnels] = useState<TunnelEntry[]>([])

  useImperativeHandle(ref, () => ({
    open: () => {
      setValues(() => ({
        localAddr: '',
        localPort: '',
        targetAddr: '',
        targetPort: '',
        network: 'tcp+udp',
        group: '',
        proxy: null,
      }))
      setDraftTunnels(() => clash?.tunnels ?? [])
      setOpen(true)
      setExpanded((clash?.tunnels ?? []).length === 0)
    },
    close: () => {
      setOpen(false)
    },
  }))

  const tunnelEntries = useMemo(() => {
    const counts: Record<string, number> = {}
    return draftTunnels.map((tunnel, index) => {
      const base = `${tunnel.address}_${tunnel.target}_${tunnel.network.join('+')}`
      const occurrence = (counts[base] = (counts[base] ?? 0) + 1)
      return {
        index,
        key: `${base}_${occurrence}`,
        address: tunnel.address,
        target: tunnel.target,
        network: tunnel.network,
        proxy: tunnel.proxy,
      }
    })
  }, [draftTunnels])

  const { proxyView } = useProxiesData()

  const proxyGroups = useMemo(() => proxyView?.groups ?? [], [proxyView])

  const groupNames = useMemo<string[]>(
    () => proxyGroups.map((group) => group.name),
    [proxyGroups],
  )

  const proxyOptions = useMemo<TunnelProxyOption[]>(() => {
    if (!proxyView) return []
    const group = proxyGroups.find((item) => item.name === values.group)
    return (
      group?.members.map((member, memberIndex) => ({
        memberIndex,
        member: resolveMember(proxyView, member),
      })) ?? []
    )
  }, [proxyGroups, proxyView, values.group])
  const proxyMembers = useMemo(
    () => proxyOptions.map(({ member }) => member),
    [proxyOptions],
  )
  const selectedProxyOption = useMemo(
    () =>
      values.proxy
        ? rebindMemberOccurrence(proxyMembers, values.proxy)
        : undefined,
    [proxyMembers, values.proxy],
  )
  const selectedProxyToken = selectedProxyOption
    ? proxyOptionToken(selectedProxyOption)
    : ''
  const selectedGroupExists =
    !values.group || proxyGroups.some(({ name }) => name === values.group)
  const latestProxyStateRef = useRef({
    binding: values.proxy,
    options: proxyOptions,
  })
  latestProxyStateRef.current = {
    binding: values.proxy,
    options: proxyOptions,
  }

  if (!selectedGroupExists || (values.proxy && !selectedProxyOption)) {
    setValues(
      selectedGroupExists
        ? { ...values, proxy: null }
        : { ...values, group: '', proxy: null },
    )
  }

  const handleSave = async () => {
    try {
      await patchClash({ tunnels: draftTunnels })
      await mutateClash()
      showNotice.success('shared.feedback.notifications.common.saveSuccess')
      setOpen(false)
    } catch (err: any) {
      showNotice.error(err)
    }
  }

  const handleAdd = async () => {
    const { localAddr, localPort, targetAddr, targetPort, network } = values

    if (!localAddr || !localPort || !targetAddr || !targetPort) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.incomplete',
      )
      return
    }

    const localHost = normalizeListenHost(localAddr)
    if (!localHost) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.invalidLocalAddr',
      )
      return
    }

    if (!isValidPort(localPort)) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.invalidLocalPort',
      )
      return
    }
    const targetHost = normalizeHost(targetAddr)
    if (!targetHost) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.invalidTargetAddr',
      )
      return
    }

    if (!isValidPort(targetPort)) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.invalidTargetPort',
      )
      return
    }

    const latestProxyState = latestProxyStateRef.current
    const latestMembers = latestProxyState.options.map(({ member }) => member)
    const latestSelectedProxy = latestProxyState.binding
      ? rebindMemberOccurrence(latestMembers, latestProxyState.binding)
      : undefined
    if (latestProxyState.binding && !latestSelectedProxy) {
      showNotice.error(
        'settings.sections.clash.form.fields.tunnels.messages.incomplete',
      )
      return
    }

    const transports: ListenerTransport[] =
      network === 'tcp+udp' ? ['tcp', 'udp'] : [network]
    const entry: TunnelEntry = {
      network: transports,
      address: formatHostPort(localHost, localPort),
      target: formatHostPort(targetHost, targetPort),
      ...(latestSelectedProxy
        ? { proxy: latestSelectedProxy.member.ref.name }
        : {}),
    }

    const candidateTunnels = [...draftTunnels, entry]
    try {
      const outcome = await probeListener({
        address: entry.address,
        transports,
      })
      if (outcome.status === 'conflict') {
        showNotice.error('settings.modals.clashPort.messages.portInUse', {
          port: outcome.port,
        })
        return
      }
      if (outcome.status !== 'available') {
        showNotice.error(outcome.message)
        return
      }
    } catch (error) {
      showNotice.error(error)
      return
    }

    setDraftTunnels(candidateTunnels)

    setValues((v) => ({
      ...v,
      localAddr: '',
      localPort: '',
      targetAddr: '',
      targetPort: '',
      network: 'tcp+udp',
    }))
  }

  const handleDelete = (index: number) => {
    setDraftTunnels((prev) => prev.filter((_, i) => i !== index))
  }

  const optionalLabel = (label: ReactNode) => (
    <>
      {label}
      <span className="font-normal text-muted-foreground">
        ({t('settings.sections.clash.form.fields.tunnels.optional')})
      </span>
    </>
  )

  return (
    <BaseDialog
      open={open}
      title={t('settings.sections.clash.form.fields.tunnels.title')}
      className="sm:max-w-lg"
      okBtn={t('shared.actions.save')}
      cancelBtn={t('shared.actions.cancel')}
      onClose={() => {
        setOpen(false)
      }}
      onCancel={() => {
        setOpen(false)
      }}
      onOk={handleSave}
    >
      <div className="flex flex-col gap-3 py-1">
        {draftTunnels.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground">
              {t('settings.sections.clash.form.fields.tunnels.existing')}
            </p>
            <ItemGroup className="gap-1">
              {tunnelEntries.map((item) => (
                <Item key={`${item.key}`} size="xs" variant="outline">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="break-all">
                      {`${item.address} → ${item.target}`}
                    </ItemTitle>
                    <ItemDescription>
                      {`${item.network.join(', ')} · ${
                        item.proxy ??
                        t('settings.sections.clash.form.fields.tunnels.default')
                      }`}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label={t('shared.actions.delete')}
                      onClick={() => handleDelete(item.index)}
                    >
                      <Trash2Icon />
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
            <Separator />
          </>
        )}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              {t('settings.sections.clash.form.fields.tunnels.actions.addNew')}
              {expanded ? (
                <ChevronUpIcon data-icon="inline-end" />
              ) : (
                <ChevronDownIcon data-icon="inline-end" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <FieldGroup className="gap-3 pt-3">
              <FormRow
                id="tunnel-network"
                label={t(
                  'settings.sections.clash.form.fields.tunnels.protocols',
                )}
              >
                <Select
                  value={values.network}
                  onValueChange={(next) =>
                    setValues((v) => ({
                      ...v,
                      network: next as TunnelNetwork,
                    }))
                  }
                >
                  <SelectTrigger
                    id="tunnel-network"
                    className="w-auto min-w-48 max-w-60"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="tcp">TCP</SelectItem>
                      <SelectItem value="udp">UDP</SelectItem>
                      <SelectItem value="tcp+udp">TCP + UDP</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormRow>

              <FormRow
                id="tunnel-local-addr"
                label={t(
                  'settings.sections.clash.form.fields.tunnels.localAddr',
                )}
              >
                <Input
                  id="tunnel-local-addr"
                  className="w-48"
                  autoComplete="new-password"
                  value={values.localAddr}
                  placeholder="127.0.0.1"
                  onChange={(e) =>
                    setValues((v) => ({ ...v, localAddr: e.target.value }))
                  }
                />
              </FormRow>

              <FormRow
                id="tunnel-local-port"
                label={t(
                  'settings.sections.clash.form.fields.tunnels.localPort',
                )}
              >
                <Input
                  id="tunnel-local-port"
                  className="w-48"
                  type="number"
                  autoComplete="new-password"
                  value={values.localPort}
                  placeholder="6553"
                  onChange={(e) =>
                    setValues((v) => ({ ...v, localPort: e.target.value }))
                  }
                />
              </FormRow>

              <FormRow
                id="tunnel-target-addr"
                label={t(
                  'settings.sections.clash.form.fields.tunnels.targetAddr',
                )}
              >
                <Input
                  id="tunnel-target-addr"
                  className="w-48"
                  autoComplete="new-password"
                  value={values.targetAddr}
                  placeholder="8.8.8.8"
                  onChange={(e) =>
                    setValues((v) => ({ ...v, targetAddr: e.target.value }))
                  }
                />
              </FormRow>

              <FormRow
                id="tunnel-target-port"
                label={t(
                  'settings.sections.clash.form.fields.tunnels.targetPort',
                )}
              >
                <Input
                  id="tunnel-target-port"
                  className="w-48"
                  type="number"
                  autoComplete="new-password"
                  value={values.targetPort}
                  placeholder="53"
                  onChange={(e) =>
                    setValues((v) => ({ ...v, targetPort: e.target.value }))
                  }
                />
              </FormRow>

              <FormRow
                id="tunnel-group"
                label={optionalLabel(
                  t('settings.sections.clash.form.fields.tunnels.proxyGroup'),
                )}
              >
                <Select
                  value={values.group || DEFAULT_OPTION}
                  onValueChange={(selected) => {
                    const nextGroup =
                      selected === DEFAULT_OPTION ? '' : selected
                    const group = proxyGroups.find((g) => g.name === nextGroup)
                    const options =
                      proxyView && group
                        ? group.members.map((member, memberIndex) => ({
                            memberIndex,
                            member: resolveMember(proxyView, member),
                          }))
                        : []
                    const firstProxy = options.find(({ member }) =>
                      isInteractableMember(member),
                    )
                    const members = options.map(({ member }) => member)

                    setValues((v) => ({
                      ...v,
                      group: nextGroup,
                      proxy: firstProxy
                        ? (toMemberOccurrenceBinding(
                            members,
                            firstProxy.memberIndex,
                          ) ?? null)
                        : null,
                    }))
                  }}
                >
                  <SelectTrigger
                    id="tunnel-group"
                    className="w-auto min-w-48 max-w-60"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={DEFAULT_OPTION}>
                        {t(
                          'settings.sections.clash.form.fields.tunnels.default',
                        )}
                      </SelectItem>
                      {groupNames.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormRow>

              <FormRow
                id="tunnel-proxy"
                label={optionalLabel(
                  t('settings.sections.clash.form.fields.tunnels.proxyNode'),
                )}
              >
                <Select
                  value={selectedProxyToken || DEFAULT_OPTION}
                  disabled={!values.group}
                  onValueChange={(token) => {
                    const option = proxyOptions.find(
                      (candidate) => proxyOptionToken(candidate) === token,
                    )
                    setValues((v) => ({
                      ...v,
                      proxy: option
                        ? (toMemberOccurrenceBinding(
                            proxyMembers,
                            option.memberIndex,
                          ) ?? null)
                        : null,
                    }))
                  }}
                >
                  <SelectTrigger
                    id="tunnel-proxy"
                    className="w-auto min-w-48 max-w-60"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={DEFAULT_OPTION}>
                        {t(
                          'settings.sections.clash.form.fields.tunnels.default',
                        )}
                      </SelectItem>
                      {proxyOptions.map(({ memberIndex, member }) => (
                        <SelectItem
                          key={
                            member.kind === 'node'
                              ? `${memberIndex}:${member.node.recordId}`
                              : `${memberIndex}:${member.ref.name}`
                          }
                          value={proxyOptionToken({ memberIndex, member })}
                          disabled={!isInteractableMember(member)}
                        >
                          {member.ref.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormRow>

              <Button size="sm" className="self-end" onClick={handleAdd}>
                {t('settings.sections.clash.form.fields.tunnels.actions.add')}
              </Button>
            </FieldGroup>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </BaseDialog>
  )
})
