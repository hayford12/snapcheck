// Prevent browser from opening files dragged outside of upload zones
window.addEventListener('dragover', (e) => e.preventDefault())
window.addEventListener('drop', (e) => {
  if (!e.target.closest('[data-upload-zone]')) {
    e.preventDefault()
  }
})

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2, // 2 minutes
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0f0f13',
              color: '#fff',
              fontFamily: "Inter, sans-serif",
              fontSize: '13px',
              fontWeight: 500,
              borderRadius: '6px',
              padding: '12px 16px',
            },
            success: {
              style: { background: '#2d6e4e' },
              iconTheme: { primary: '#fff', secondary: '#2d6e4e' },
            },
            error: {
              style: { background: '#c8402a' },
              iconTheme: { primary: '#fff', secondary: '#c8402a' },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
