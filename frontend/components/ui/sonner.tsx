'use client'

import { useTheme } from 'next-themes'
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner'

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme()
  return (
    <SonnerToaster
      theme={(theme ?? 'dark') as ToasterProps['theme']}
      {...props}
    />
  )
}
