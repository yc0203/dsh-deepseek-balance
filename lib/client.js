window.__ModuleLoader__.load({
  id: "dsh-deepseek-balance",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  BalanceWidget: () => BalanceWidget,
  apply: () => apply,
  describeBalance: () => describeBalance,
  formatBalance: () => formatBalance,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var React = __toESM(require("react"), 1);
var h = React.createElement;
var CHANNEL = "/dsh-balance";
var ENDPOINT = "get";
var POLL_INTERVAL_MS = 5e3;
var STYLE_TAG_ID = "dsh-deepseek-balance-styles";
var STYLES = `
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
`;
var CURRENCY_SYMBOLS = { CNY: "\xA5", USD: "$", EUR: "\u20AC", HKD: "HK$", JPY: "\xA5" };
function formatBalance(data) {
  const total = Number(data?.totalBalance);
  if (!Number.isFinite(total)) {
    return data?.totalBalance !== void 0 && data.totalBalance !== "" ? String(data.totalBalance) : "--";
  }
  const symbol = CURRENCY_SYMBOLS[data?.currency] ?? (data?.currency !== void 0 ? `${data.currency} ` : "");
  return `${symbol}${total.toFixed(2)}`;
}
function describeBalance(data, updatedAt) {
  const lines = [
    `DeepSeek \u4F59\u989D\uFF1A${formatBalance(data)}`,
    data?.toppedUpBalance !== void 0 && data.toppedUpBalance !== "" ? `\u5145\u503C\u4F59\u989D\uFF1A${data.toppedUpBalance}${data?.currency ?? ""}` : null,
    data?.grantedBalance !== void 0 && data.grantedBalance !== "" ? `\u8D60\u9001\u4F59\u989D\uFF1A${data.grantedBalance}${data?.currency ?? ""}` : null,
    updatedAt !== void 0 ? `\u66F4\u65B0\u4E8E ${new Date(updatedAt).toLocaleTimeString()}` : null
  ].filter(Boolean);
  return lines.join("\n");
}
function RefreshIcon({ spinning }) {
  return h(
    "svg",
    {
      width: 14,
      height: 14,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true"
    },
    h("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }),
    h("polyline", { points: "21 3 21 9 15 9" })
  );
}
function BalanceWidget({ wide, fetchBalance }) {
  const [view, setView] = React.useState({ status: "loading" });
  const busyRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const controllerRef = React.useRef(null);
  const load = React.useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = Date.now();
    try {
      const result = await fetchBalance(controller.signal);
      if (!mountedRef.current) return;
      if (result.ok) {
        setView({ status: "ok", data: result.value, updatedAt: startedAt });
      } else {
        setView({
          status: "error",
          message: result.error?.message ?? "\u83B7\u53D6\u5931\u8D25",
          updatedAt: startedAt
        });
      }
    } catch (error) {
      if (!mountedRef.current) return;
      if (error?.name === "AbortError") return;
      setView({ status: "error", message: "\u8BF7\u6C42\u5931\u8D25", updatedAt: startedAt });
    } finally {
      busyRef.current = false;
    }
  }, [fetchBalance]);
  React.useEffect(() => {
    mountedRef.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [load]);
  const spinning = view.status === "loading" || busyRef.current;
  const title = view.status === "ok" ? describeBalance(view.data, view.updatedAt) : view.status === "error" ? `\u4F59\u989D\u83B7\u53D6\u5931\u8D25\uFF1A${view.message}` : "\u6B63\u5728\u83B7\u53D6 DeepSeek \u4F59\u989D\u2026";
  if (!wide) {
    return h(
      "button",
      {
        type: "button",
        className: "dsb-rail",
        title,
        "aria-label": `DeepSeek \u4F59\u989D ${view.status === "ok" ? formatBalance(view.data) : "\u83B7\u53D6\u4E2D"}`,
        onClick: () => {
          void load();
        }
      },
      h("span", { className: "dsb-railBadge", "aria-hidden": "true" }, "\xA5")
    );
  }
  return h(
    "button",
    {
      type: "button",
      className: "dsb-root",
      title,
      onClick: () => {
        void load();
      }
    },
    h(
      "span",
      { className: "dsb-badge" },
      h("span", { className: "dsb-icon", "aria-hidden": "true" }, "\xA5"),
      view.status === "ok" ? h("span", { className: `dsb-value ${view.data?.isAvailable === false ? "dsb-error" : "dsb-ok"}` }, formatBalance(view.data)) : view.status === "error" ? h("span", { className: "dsb-value dsb-error" }, "\u83B7\u53D6\u5931\u8D25") : h("span", { className: "dsb-value" }, "\u67E5\u8BE2\u4E2D\u2026")
    ),
    h("span", {
      className: `dsb-refresh${spinning ? " dsb-spin" : ""}`,
      role: "button",
      "aria-label": "\u5237\u65B0\u4F59\u989D",
      onClick: (event) => {
        event.stopPropagation();
        void load();
      }
    }, h(RefreshIcon, { spinning }))
  );
}
var name = "dsh-balance";
var inject = ["slots", "connection"];
function apply(ctx) {
  const fetchBalance = (signal) => ctx.connection.rpc.call(CHANNEL, ENDPOINT, null, signal);
  ctx.effect(() => {
    if (typeof document === "undefined") return () => {
    };
    let tag = document.getElementById(STYLE_TAG_ID);
    if (tag === null) {
      tag = document.createElement("style");
      tag.id = STYLE_TAG_ID;
      tag.dataset.plugin = "dsh-deepseek-balance";
      tag.dataset.pluginCss = "dsh-deepseek-balance/styles.css";
      tag.textContent = STYLES;
      document.head.appendChild(tag);
    }
    return () => {
      tag?.remove();
    };
  }, "dsh-balance: styles");
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "dsh-balance",
    order: 0,
    inject: () => ({ fetchBalance })
  }, BalanceWidget));
}

    return module.exports;
  }
});
