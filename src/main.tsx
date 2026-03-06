import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { MemberProvider } from './contexts/MemberContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemberProvider>
      <App />
    </MemberProvider>
  </StrictMode>,
)
