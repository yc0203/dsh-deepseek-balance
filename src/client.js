/**
 * dsh-deepseek-balance — 浏览器端（Client half）
 *
 * 把余额控件注册进 `sidebar.footer.action` 插槽（侧栏底部“设置”按钮上方）。
 * 数据通过宿主 RPC 通道 `/dsh-balance` 获取（API Key 只存在于宿主进程，不出浏览器）。
 * 每 5 秒自动刷新一次，点击任意位置或刷新按钮立即查询。
 *
 * 构建：scripts/build-client.mjs 用 esbuild 打成 CJS 并包上
 * window.__ModuleLoader__.load({ id, factory }) 外壳，由宿主 /plugins/<id>/client.js
 * 动态提供给浏览器（模块表提供 react / cordis 等外部依赖）。
 */
import * as React from 'react'

const h = React.createElement

const CHANNEL = '/dsh-balance'
const ENDPOINT = 'get'
const POLL_INTERVAL_MS = 5000
const STYLE_TAG_ID = 'dsh-deepseek-balance-styles'

const STYLES = `
.dsb-root{display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;min-height:32px;padding:4px 10px;box-sizing:border-box;border-radius:10px;border:none;cursor:pointer;background:transparent;color:var(--dsw-alias-label-secondary, #9a9a9a);font-family:inherit;font-size:12px;line-height:16px;text-align:left}
.dsb-root:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12));color:var(--dsw-alias-label-primary, #eee)}
.dsb-badge{display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1}
.dsb-icon{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--dsw-alias-label-primary, #eee);color:var(--dsw-alias-label-primary-inverted, #111);font-weight:600;font-size:11px}
.dsb-value{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsb-label{flex:none;opacity:.75}
.dsb-refresh{flex:none;display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border:none;border-radius:6px;padding:0;background:transparent;color:inherit;cursor:pointer}
.dsb-refresh:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12))}
.dsb-refresh svg{display:block}
.dsb-spin svg{animation:dsb-spin .8s linear infinite}
@keyframes dsb-spin{to{transform:rotate(360deg)}}
.dsb-rail{width:36px;height:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:none;padding:0;background:transparent;color:var(--dsw-alias-label-primary, #eee);cursor:pointer}
.dsb-rail:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.12))}
.dsb-railBadge{width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-label-primary, #eee);color:var(--dsw-alias-label-primary-inverted, #111);font-size:12px;font-weight:600}
.dsb-error{color:#e5484d}
.dsb-ok{color:var(--dsw-alias-label-primary, #eee)}
`

const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$', EUR: '€', HKD: 'HK$', JPY: '¥' }

/** 把余额对象格式化成 "¥ 12.34" 这样的展示文本。 */
export function formatBalance(data) {
  const total = Number(data?.totalBalance)
  if (!Number.isFinite(total)) {
    return data?.totalBalance !== undefined && data.totalBalance !== ''
      ? String(data.totalBalance)
      : '--'
  }
  const symbol = CURRENCY_SYMBOLS[data?.currency] ?? (data?.currency !== undefined ? `${data.currency} ` : '')
  return `${symbol}${total.toFixed(2)}`
}

/** 完整信息（标题 tooltip 用）：总额 / 赠送 / 充值 + 更新时间。 */
export function describeBalance(data, updatedAt) {
  const lines = [
    `DeepSeek 余额：${formatBalance(data)}`,
    data?.toppedUpBalance !== undefined && data.toppedUpBalance !== ''
      ? `充值余额：${data.toppedUpBalance}${data?.currency ?? ''}`
      : null,
    data?.grantedBalance !== undefined && data.grantedBalance !== ''
      ? `赠送余额：${data.grantedBalance}${data?.currency ?? ''}`
      : null,
    updatedAt !== undefined ? `更新于 ${new Date(updatedAt).toLocaleTimeString()}` : null,
  ].filter(Boolean)
  return lines.join('\n')
}

function RefreshIcon({ spinning }) {
  return h('svg', {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  },
  h('path', { d: 'M21 12a9 9 0 1 1-2.64-6.36' }),
  h('polyline', { points: '21 3 21 9 15 9' }))
}

/**
 * 余额控件：宽栏显示 "¥ 12.34 + 刷新按钮"，收起栏显示一个圆形 ¥ 徽标。
 * 组件自身持有轮询状态：挂载即查询，之后每 5 秒一次；点击任意位置立即刷新。
 * @param props - 组合 props：插槽 owner 的 wide 标志 + register inject 注入的 fetchBalance。
 */
export function BalanceWidget({ wide, fetchBalance }) {
  const [view, setView] = React.useState({ status: 'loading' })
  const busyRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const controllerRef = React.useRef(null)

  const load = React.useCallback(async () => {
    if (busyRef.current) return
    busyRef.current = true
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const startedAt = Date.now()
    try {
      const result = await fetchBalance(controller.signal)
      if (!mountedRef.current) return
      if (result.ok) {
        setView({ status: 'ok', data: result.value, updatedAt: startedAt })
      } else {
        setView({
          status: 'error',
          message: result.error?.message ?? '获取失败',
          updatedAt: startedAt,
        })
      }
    } catch (error) {
      if (!mountedRef.current) return
      if (error?.name === 'AbortError') return
      setView({ status: 'error', message: '请求失败', updatedAt: startedAt })
    } finally {
      busyRef.current = false
    }
  }, [fetchBalance])

  React.useEffect(() => {
    mountedRef.current = true
    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, POLL_INTERVAL_MS)
    return () => {
      mountedRef.current = false
      window.clearInterval(timer)
      controllerRef.current?.abort()
    }
  }, [load])

  const spinning = view.status === 'loading' || busyRef.current
  const title = view.status === 'ok'
    ? describeBalance(view.data, view.updatedAt)
    : view.status === 'error'
      ? `余额获取失败：${view.message}`
      : '正在获取 DeepSeek 余额…'

  if (!wide) {
    return h('button', {
      type: 'button',
      className: 'dsb-rail',
      title,
      'aria-label': `DeepSeek 余额 ${view.status === 'ok' ? formatBalance(view.data) : '获取中'}`,
      onClick: () => { void load() },
    },
    h('span', { className: 'dsb-railBadge', 'aria-hidden': 'true' }, '¥'))
  }

  return h('button', {
    type: 'button',
    className: 'dsb-root',
    title,
    onClick: () => { void load() },
  },
  h('span', { className: 'dsb-badge' },
    h('span', { className: 'dsb-icon', 'aria-hidden': 'true' }, '¥'),
    view.status === 'ok'
      ? h('span', { className: `dsb-value ${view.data?.isAvailable === false ? 'dsb-error' : 'dsb-ok'}` }, formatBalance(view.data))
      : view.status === 'error'
        ? h('span', { className: 'dsb-value dsb-error' }, '获取失败')
        : h('span', { className: 'dsb-value' }, '查询中…')),
  h('span', {
    className: `dsb-refresh${spinning ? ' dsb-spin' : ''}`,
    role: 'button',
    'aria-label': '刷新余额',
    onClick: (event) => {
      event.stopPropagation()
      void load()
    },
  }, h(RefreshIcon, { spinning })))
}

/** 稳定插件名。 */
export const name = 'dsh-balance'

/** 需要的客户端服务：插槽注册与 Connection RPC。 */
export const inject = ['slots', 'connection']

/**
 * 客户端插件入口：注入样式并把控件注册进 sidebar.footer.action。
 * @param ctx - 客户端根上下文。
 */
export function apply(ctx) {
  const fetchBalance = (signal) => ctx.connection.rpc.call(CHANNEL, ENDPOINT, null, signal)

  ctx.effect(() => {
    if (typeof document === 'undefined') return () => {}
    let tag = document.getElementById(STYLE_TAG_ID)
    if (tag === null) {
      tag = document.createElement('style')
      tag.id = STYLE_TAG_ID
      tag.dataset.plugin = 'dsh-deepseek-balance'
      tag.dataset.pluginCss = 'dsh-deepseek-balance/styles.css'
      tag.textContent = STYLES
      document.head.appendChild(tag)
    }
    return () => { tag?.remove() }
  }, 'dsh-balance: styles')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-balance',
    order: 0,
    inject: () => ({ fetchBalance }),
  }, BalanceWidget))
}
