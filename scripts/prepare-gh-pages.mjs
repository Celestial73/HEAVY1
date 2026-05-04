import { copyFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexPath = resolve(distDir, 'index.html')
const notFoundPath = resolve(distDir, '404.html')

await copyFile(indexPath, notFoundPath)
console.log('Created dist/404.html for GitHub Pages SPA fallback.')
