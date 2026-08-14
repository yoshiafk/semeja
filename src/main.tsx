import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/inter'
import './index.css'
import App from './App.tsx'
import { MemberProvider } from './contexts/MemberContext.tsx'
import { ActivityProvider } from './contexts/ActivityContext.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MemberProvider>
        <ActivityProvider>
          <App />
        </ActivityProvider>
      </MemberProvider>
    </QueryClientProvider>
  </StrictMode>,
)
