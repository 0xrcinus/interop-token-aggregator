import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  // Simply return the logo from public directory
  const logoPath = join(process.cwd(), 'public', 'logo.png')
  const logo = readFileSync(logoPath)

  return new Response(logo, {
    headers: {
      'Content-Type': 'image/png',
    },
  })
}
