import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import type { BannerWithMarkdown } from '@qingmalaya/shared'

const STATIC_ORIGIN = 'http://localhost:3000'

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
  })
}

/**
 * Resolve a markdown image src to a full URL.
 * Relative paths (e.g. "2026/07/xxx.jpg") are prefixed with /static/ and the
 * API origin so they load correctly in the H5 browser.
 */
function resolveImgSrc(src: string): string {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('/static')) return `${STATIC_ORIGIN}${src}`
  if (src.startsWith('/')) return `${STATIC_ORIGIN}/static${src}`
  return `${STATIC_ORIGIN}/static/${src}`
}

export default function MarkdownPage() {
  const ok = useAuthRedirect()
  const [banner, setBanner] = useState<BannerWithMarkdown | null>(null)
  const [loading, setLoading] = useState(true)

  const [bannerId] = useState(() => {
    const instance = Taro.getCurrentInstance()
    const id = Number(instance.router?.params.id)
    return Number.isNaN(id) ? 0 : id
  })

  useEffect(() => {
    if (!ok) return
    if (!bannerId) {
      Taro.showToast({ title: '无效的 Banner ID', icon: 'none' })
      setLoading(false)
      return
    }
    setLoading(true)
    get<BannerWithMarkdown>(`/banners/${bannerId}`)
      .then((data) => setBanner(data))
      .catch((err) => {
        console.warn('[markdown] fetch failed', err)
        Taro.showToast({ title: '加载失败', icon: 'none' })
      })
      .finally(() => setLoading(false))
  }, [ok, bannerId])

  if (!ok) return null

  if (loading && !banner) {
    return (
      <AppLayout currentTab='discovery' hideChrome>
        <View className='flex min-h-[60vh] items-center justify-center'>
          <Text className='text-sm text-on-surface-variant'>加载中...</Text>
        </View>
      </AppLayout>
    )
  }

  if (!banner) {
    return (
      <AppLayout currentTab='discovery' hideChrome>
        <View className='flex min-h-[60vh] items-center justify-center px-6'>
          <Text className='text-center text-sm text-on-surface-variant'>
            内容不存在
          </Text>
        </View>
      </AppLayout>
    )
  }

  const content = banner.markdownContent ?? ''

  return (
    <AppLayout currentTab='discovery' hideChrome>
      <PageContainer>
        {/* Back button */}
        <View className='flex items-center px-4 pt-2'>
          <View
            onClick={handleBack}
            className='flex h-10 w-10 items-center justify-center rounded-full text-primary'
          >
            <Text className='material-symbols-outlined' style={{ fontSize: '22px' }}>
              arrow_back
            </Text>
          </View>
        </View>

        <View className='px-4 pb-10 pt-4'>
          <Text className='mb-4 block text-xl font-bold text-primary'>
            {banner.title}
          </Text>
          {process.env.TARO_ENV === 'h5' ? (
            <View
              className='markdown-body'
              style={{
                color: '#1c1b1f',
                fontSize: '15px',
                lineHeight: '1.8',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => (
                    <img
                      src={resolveImgSrc(src ?? '')}
                      alt={alt ?? ''}
                      style={{
                        maxWidth: '100%',
                        borderRadius: '8px',
                        margin: '12px 0',
                      }}
                    />
                  ),
                  h1: ({ children }) => (
                    <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '20px 0 12px', color: '#1c1b1f' }}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '18px 0 10px', color: '#1c1b1f' }}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '16px 0 8px', color: '#1c1b1f' }}>
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p style={{ margin: '8px 0' }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ paddingLeft: '24px', margin: '8px 0' }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ paddingLeft: '24px', margin: '8px 0' }}>{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ margin: '4px 0' }}>{children}</li>
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      style={{ color: '#4d6265', textDecoration: 'underline' }}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{
                        borderLeft: '3px solid #4d6265',
                        paddingLeft: '12px',
                        margin: '12px 0',
                        color: '#727879',
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code
                      style={{
                        background: 'rgba(114,120,121,0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                      }}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre
                      style={{
                        background: 'rgba(114,120,121,0.08)',
                        padding: '12px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        margin: '12px 0',
                      }}
                    >
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        margin: '12px 0',
                      }}
                    >
                      {children}
                    </table>
                  ),
                  th: ({ children }) => (
                    <th
                      style={{
                        border: '1px solid rgba(114,120,121,0.2)',
                        padding: '8px',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      style={{
                        border: '1px solid rgba(114,120,121,0.2)',
                        padding: '8px',
                      }}
                    >
                      {children}
                    </td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </View>
          ) : (
            <Text className='text-sm text-on-surface-variant'>
              {content}
            </Text>
          )}
        </View>
      </PageContainer>
    </AppLayout>
  )
}
