/**
 * Build the dsh-session-input-history client bundle.
 *
 * Produces lib/client.js in the wire format the DSH web shell expects:
 * a CJS factory handed to window.__ModuleLoader__.load({ id, factory }).
 * Platform modules resolve through the injected require; everything else is
 * inlined.
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Loader entry name — must equal the patch row `name` EXACTLY. */
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const PLUGIN_ID = MANIFEST.name

/**
 * Platform module table — must stay aligned with the web shell's
 * `staticModules` map (dsh-web-frontend boot facade). These ids resolve
 * through the injected require at runtime; anything missing here gets
 * inlined into the bundle instead.
 */
const EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')

const banner = [
  `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
  'var module = { exports: {} }; var exports = module.exports;',
].join('\n')
const footer = 'return module.exports; } });'

await esbuild.build({
  entryPoints: [join(ROOT, 'src/client/index.ts')],
  outfile: join(ROOT, 'lib/client.js'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: EXTERNALS,
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: { js: banner },
  footer: { js: footer },
  logLevel: 'info',
})

console.log('lib/client.js built')
