import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV) {
  const originalWarn = console.warn
  const mutedWarnings = [
    'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
    'using deprecated parameters for the initialization function; pass a single object instead',
  ]

  console.warn = (...args) => {
    const first = typeof args[0] === 'string' ? args[0] : ''
    if (mutedWarnings.some((warning) => first.includes(warning))) return
    originalWarn(...args)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
