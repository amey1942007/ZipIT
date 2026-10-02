import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FxLayer } from '@/components/comic/FxLayer'
import { MotionRoot } from '@/motion/MotionRoot'
import App from '@/App'
import '@/index.css'

// Login is the first page. A bare site URL has no hash, so send it to #/login.
if (!window.location.hash) {
  window.location.hash = '#/login'
}

const root = document.getElementById('root')
if (!root) {
  throw new Error('root element missing')
}

createRoot(root).render(
  <StrictMode>
    <MotionRoot>
      <App />
      <FxLayer />
    </MotionRoot>
  </StrictMode>,
)
