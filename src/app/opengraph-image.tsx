import { ImageResponse } from 'next/og'

export const alt = 'nextjs-revalidator'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: 80,
          color: '#fafafa',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: '-0.02em' }}>
          nextjs-revalidator
        </div>
        <div style={{ fontSize: 36, color: '#a1a1aa', textAlign: 'center' }}>
          On-demand Next.js cache revalidation
        </div>
      </div>
    ),
    size
  )
}
