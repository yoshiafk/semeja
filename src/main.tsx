import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { MemberProvider } from './contexts/MemberContext.tsx'
import { ActivityProvider } from './contexts/ActivityContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemberProvider>
      <ActivityProvider>
        <App />
      </ActivityProvider>
    </MemberProvider>
  </StrictMode>,
)
