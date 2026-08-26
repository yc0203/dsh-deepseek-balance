/**
 * 构建浏览器端 bundle：esbuild 打包 src/client.js 为 CJS，
 * 再包上 window.__ModuleLoader__.load({ id, factory }) 外壳。
 * 产物 lib/client.js 由宿主 client-modules 以 /plugins/<id>/client.js 提供给浏览器。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const sourceDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(sourceDirectory, '..')
const outputPath = resolve(packageRoot, 'lib/client.js')
const loaderId = process.env.DSH_BALANCE_CLIENT_ID ?? 'dsh-deepseek-balance'

const result = await build({
  entryPoints: [resolve(packageRoot, 'src/client.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome100'],
  external: ['react', 'react-dom'],
  write: false,
  minify: process.env.NODE_ENV === 'production',
  legalComments: 'none',
})
const bundled = result.outputFiles?.[0]?.text
if (bundled === undefined) throw new Error('esbuild did not produce a client bundle')

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(loaderId)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundled}
    return module.exports;
  }
});
`

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, wrapped, 'utf8')
console.log(`Wrote ${outputPath}`)
