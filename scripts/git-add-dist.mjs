import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexHtml = resolve(distDir, 'index.html')

if (!existsSync(indexHtml)) {
  console.error('dist/index.html не найден. Сначала: npm run build:deploy')
  process.exit(1)
}

const add = spawnSync('git', ['add', '-A', 'dist'], { stdio: 'inherit' })
if (add.status !== 0) process.exit(add.status ?? 1)

console.log('')
console.log('dist/ добавлен в индекс git.')
console.log('Дальше на локальной машине:')
console.log('  git commit -m "build: update dist"')
console.log('  git push')
console.log('')
console.log('На VDS:')
console.log('  cd /var/www/heavy && ./scripts/deploy-vps.sh')
