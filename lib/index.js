/**
 * dsh-deepseek-balance — 宿主端（Host half）
 *
 * 一个零依赖的 cordis 插件：通过宿主 Connection RPC 通道注册 `/dsh-balance`，
 * 浏览器端调用 `POST /dsh-balance/get` 即可拿到 DeepSeek 账号余额。
 *
 * API Key 来源：credentials seam（`ctx.credentials.resolve(ref)`），默认读取
 * `DEEPSEEK_API_KEY`（与 `deepseek-official` provider 同一个 ref，即
 * 设置 → 模型 页面写入的那个 Key）。Key 只在本进程内使用，永不回传浏览器。
 *
 * 可通过 patch 配置覆盖：
 *   - config.baseUrl      DeepSeek API 根地址，默认 https://api.deepseek.com
 *   - config.credentialRef 使用的 credential ref，默认 DEEPSEEK_API_KEY
 */

export const name = 'dsh-balance'

/** 需要的宿主服务：Connection（RPC 通道）与 credentials（解析 API Key）。 */
export const inject = ['connection', 'credentials']

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_CREDENTIAL_REF = 'DEEPSEEK_API_KEY'

/** RPC 逻辑通道（与 /api 保留通道不冲突，满足 /^\/[A-Za-z0-9._~-]+$/）。 */
const CHANNEL = '/dsh-balance'
const ENDPOINT = 'get'

/** credential ref 必须是环境变量风格的名称。 */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 把 DeepSeek /user/balance 响应规整成客户端可直接展示的 JSON。
 * @param data - DeepSeek 返回的原始 JSON。
 * @returns 规整后的余额对象。
 */
export function normalizeBalance(data) {
  const first = Array.isArray(data?.balance_infos) ? data.balance_infos[0] : undefined
  const text = (value, fallback = '') => {
    if (typeof value === 'string' && value !== '') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    return fallback
  }
  return {
    isAvailable: data?.is_available === true,
    ...(isRecord(first)
      ? {
          currency: text(first.currency, 'CNY'),
          totalBalance: text(first.total_balance),
          grantedBalance: text(first.granted_balance),
          toppedUpBalance: text(first.topped_up_balance),
        }
      : {}),
  }
}

/**
 * 插件入口：注册 /dsh-balance RPC 通道。
 * @param ctx - cordis 上下文（已注入 connection、credentials）。
 * @param config - patch 配置（可选）。
 */
export function apply(ctx, config = {}) {
  const baseUrl = String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const ref = String(config.credentialRef ?? DEFAULT_CREDENTIAL_REF)
  if (!REF_PATTERN.test(ref)) {
    throw new Error(`dsh-balance: credentialRef "${ref}" 必须是环境变量风格名称（如 DEEPSEEK_API_KEY）`)
  }

  const dispose = ctx.connection.rpc.handle(
    CHANNEL,
    async (endpoint, payload, signal) => {
      if (endpoint !== ENDPOINT || payload !== null) {
        return {
          ok: false,
          error: { code: 'bad-request', message: `expected: POST ${CHANNEL}/${ENDPOINT} with a null payload` },
        }
      }
      try {
        const resolved = await ctx.credentials.resolve(ref)
        if (resolved === undefined) {
          return {
            ok: false,
            error: {
              code: 'credential-missing',
              message: `未找到 API Key（credential ref: ${ref}）。请在 设置 → 模型 中配置 DeepSeek API Key，或写入 .env。`,
            },
          }
        }
        const response = await fetch(`${baseUrl}/user/balance`, {
          method: 'GET',
          headers: {
            authorization: `Bearer ${resolved.value}`,
            accept: 'application/json',
          },
          signal,
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          return {
            ok: false,
            error: {
              code: 'upstream-error',
              message: `DeepSeek API 返回 ${String(response.status)}${body !== '' ? `：${body.slice(0, 200)}` : ''}`,
            },
          }
        }
        const data = await response.json()
        return { ok: true, value: normalizeBalance(data) }
      } catch (error) {
        if (signal !== undefined && signal.aborted) {
          return { ok: false, error: { code: 'cancelled', message: '请求已取消' } }
        }
        return {
          ok: false,
          error: { code: 'balance-error', message: error instanceof Error ? error.message : String(error) },
        }
      }
    },
    { authority: 'loopback' },
  )

  ctx.effect(() => () => { void dispose() }, 'dsh-balance: rpc channel')
}
