import { View } from '@tarojs/components'
import type { ReactNode } from 'react'
import { useIsDesktop } from './useIsDesktop'

interface PageContainerProps {
  children: ReactNode
  /** Extra classes on the wrapper (e.g. page-specific padding). */
  className?: string
}

/**
 * Centers page content with a responsive max-width.
 *
 * - <1024px (mobile/iPad): unconstrained (pages use their own px-4 + max-w-md)
 * - >=1024px (desktop): 1200px max — 12-col grid target
 *
 * Uses inline style (not Tailwind max-w-*) because Taro's H5 pxtransform
 * scales rem/px values in generated CSS, breaking standard max-w classes.
 */
export default function PageContainer({ children, className = '' }: PageContainerProps) {
  const isDesktop = useIsDesktop()
  return (
    <View
      className={`mx-auto w-full ${className}`}
      style={isDesktop ? { maxWidth: '1200px' } : undefined}
    >
      {children}
    </View>
  )
}
