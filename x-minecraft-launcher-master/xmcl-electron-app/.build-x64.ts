import { build } from 'electron-builder'
import { config } from './build/electron-builder.config'

async function main() {
  const base = config as any
  const merged = {
    ...base,
    win: {
      ...(base.win ?? {}),
      target: [
        { target: 'nsis', arch: ['x64'] },
        { target: 'portable', arch: ['x64'] },
      ],
    },
  }
  const files = await build({ publish: 'never', config: merged, x64: true, arm64: false } as any)
  for (const file of files) console.log('ARTIFACT', file)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
