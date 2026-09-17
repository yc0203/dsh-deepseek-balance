/**
 * dsh-deepseek-balance — 宿主端（Host half）
 *
 * 一个零依赖的 cordis 插件：把 `POST /dsh-balance/get` 挂到宿主 web 服务器上，
 * 浏览器端（lib/client.js）通过 Connection RPC 调用该端点即可拿到 DeepSeek
 * 账号余额。
 *
 * 这里走 `webCtx.webServer.register()`（与本机 dsh-pilot / dsh-email 等插件一致），
 * 而不是 Connection 的自定义 RPC 通道：当前 dsh 版本的
 * `ctx.connection.rpc.handle()` 内部用 `owner.webServer` 注册物理路由，而 owner 是
 * 经 cordis shadow 过的调用方 ctx，webServer 会沿「connection 提供者的 fiber」解析，
 * 必然抛 `cannot get property "webServer" without inject`，通道永远挂不上。
 *
 * 安全边界：只服务本机——远端地址与 Host 头都必须是环回地址；不设置 CORS 头。
 * 因此浏览器端在局域网地址打开 UI 时该控件不可用（与 1.0.0 的 loopback 语义一致）。
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

/** 需要的宿主服务：credentials（解析 API Key）。webServer 存在时才挂载路由。 */
export const inject = ['credentials']

const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_CREDENTIAL_REF = 'DEEPSEEK_API_KEY'

/** 浏览器端调用的端点：POST /dsh-balance/get（与 lib/client.js 保持一致）。 */
const CHANNEL = '/dsh-balance'
const ENDPOINT = 'get'

/** 只服务本机：远端地址与 Host 头都必须是环回地址。 */
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

/** 余额请求信封只有几十字节，给足上限的同时避免无界缓冲。 */
const MAX_BODY_BYTES = 64 * 1024

/** credential ref 必须是环境变量风格的名称。 */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** 构造 Connection RPC 失败结果（浏览器端会校验 error.details）。 */
function failure(code, message) {
  return { ok: false, error: { code, message, details: {} } }
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

/** Host 头是否是环回 authority（`127.0.0.1[:port]` / `localhost[:port]` / `[::1][:port]`）。 */
function isLoopbackAuthority(host) {
  if (typeof host !== 'string' || host === '') return false
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]'
}

/** 请求是否来自本机（远端地址 + Host 头双重校验）。 */
function isLoopbackRequest(req) {
  return LOOPBACK_ADDRESSES.has(String(req.socket?.remoteAddress ?? ''))
    && isLoopbackAuthority(req.headers?.host)
}

/** 写一个 JSON 响应；不设置 CORS 头，跨源页面读不到内容。 */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** 读取并解析 JSON 请求体（超过上限即拒绝）。 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text === '' ? undefined : JSON.parse(text)
}

/**
 * 插件入口：挂载 `POST /dsh-balance/get`。
 * @param ctx - cordis 上下文（已注入 credentials）。
 * @param config - patch 配置（可选）。
 */
export function apply(ctx, config = {}) {
  const baseUrl = String(config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const ref = String(config.credentialRef ?? DEFAULT_CREDENTIAL_REF)
  if (!REF_PATTERN.test(ref)) {
    throw new Error(`dsh-balance: credentialRef "${ref}" 必须是环境变量风格名称（如 DEEPSEEK_API_KEY）`)
  }

  /** 查询一次余额，返回 Connection RPC 结果（ok/value 或 ok/error）。 */
  const queryBalance = async (signal) => {
    try {
      const resolved = await ctx.credentials.resolve(ref)
      if (resolved === undefined) {
        return failure(
          'credential-missing',
          `未找到 API Key（credential ref: ${ref}）。请在 设置 → 模型 中配置 DeepSeek API Key，或写入 .env。`,
        )
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
        return failure(
          'upstream-error',
          `DeepSeek API 返回 ${String(response.status)}${body !== '' ? `：${body.slice(0, 200)}` : ''}`,
        )
      }
      const data = await response.json()
      return { ok: true, value: normalizeBalance(data) }
    } catch (error) {
      if (signal !== undefined && signal.aborted) return failure('cancelled', '请求已取消')
      return failure('balance-error', error instanceof Error ? error.message : String(error))
    }
  }

  ctx.inject(['webServer'], (webCtx) => {
    /** 处理一条 `POST /dsh-balance/get`（Connection RPC 信封）。 */
    const handleRequest = async (req, res) => {
      if (!isLoopbackRequest(req)) {
        sendJson(res, 403, { error: 'dsh-balance is loopback-only' })
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      if (req.method !== 'POST' || pathname !== `${CHANNEL}/${ENDPOINT}`) {
        sendJson(res, 404, { error: 'not found' })
        return
      }
      let body
      try {
        body = await readJsonBody(req)
      } catch {
        sendJson(res, 400, { error: 'body is not JSON' })
        return
      }
      if (!isRecord(body) || body.type !== 'client-request' || typeof body.rpcId !== 'string') {
        sendJson(res, 400, { error: 'invalid client-request message' })
        return
      }
      const rpcId = body.rpcId
      const reply = (result) => sendJson(res, 200, { type: 'server-response', rpcId, result })
      if (body.method !== ENDPOINT || body.payload !== null) {
        reply(failure('bad-request', `expected: POST ${CHANNEL}/${ENDPOINT} with a null payload`))
        return
      }
      // 浏览器取消请求（关闭连接）时中止上游 fetch。
      const controller = new AbortController()
      res.on('close', () => { if (!res.writableEnded) controller.abort() })
      reply(await queryBalance(controller.signal))
    }

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'prefix',
      path: CHANNEL,
      handler: handleRequest,
    }), 'dsh-balance: web route')
  })
}
