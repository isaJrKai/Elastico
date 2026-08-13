'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log full error info to the page title so we can read it
    document.title = `ERROR: ${error.message} | ${error.stack?.slice(0, 500) || 'no stack'}`
  }, [error])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <h2>Application Error</h2>
      <p style={{ color: 'red' }}>{error.message}</p>
      <p style={{ fontSize: 12, color: '#888', marginTop: 20 }}>Stack:</p>
      <pre style={{ fontSize: 11, background: '#1a1a2e', color: '#eee', padding: 16, borderRadius: 8, overflow: 'auto', maxHeight: 400 }}>
        {error.stack}
      </pre>
      <button onClick={reset} style={{ marginTop: 20, padding: '8px 16px', cursor: 'pointer' }}>
        Try Again
      </button>
    </div>
  )
}
