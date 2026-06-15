import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrismDataProvider } from './api/PrismDataProvider'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'
import './styles/modules.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <PrismDataProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PrismDataProvider>
    </QueryClientProvider>
  </StrictMode>,
)
