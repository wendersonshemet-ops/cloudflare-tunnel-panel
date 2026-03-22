import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '战争进化史 - War Evolution',
}

export default function WarPage() {
  return (
    <iframe 
      src="/war/index.html" 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        border: 'none',
        position: 'fixed',
        top: 0,
        left: 0
      }} 
      title="War Evolution"
    />
  )
}
