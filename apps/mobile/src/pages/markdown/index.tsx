import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'
import { get } from '../../utils/request'
import { STATIC_ORIGIN } from '../../config/env'
import type { BannerWithMarkdown } from '@qingmalaya/shared'

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

// Reusable style for the inline `<code>` chip. The block-level `<pre><code>`
// is fully styled by .markdown-body in app.css (surface-container-low with
// a soft border); inline code uses a very low-alpha primary tint so it
// reads as a different kind of element at a glance, without screaming for
// attention — same restrained tone as cards in the rest of the app.
const inlineCodeStyle = {
  background: 'rgba(77, 98, 101, 0.08)',
  color: '#424849',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '0.88em',
  fontFamily:
    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontWeight: 500,
} as const

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
                color: '#1b1c1c',
                fontSize: '15px',
                lineHeight: '1.85',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, [rehypeHighlight, { detect: true }]]}
                components={{
                  // Inline elements
                  img: ({ src, alt }) => (
                    <img
                      src={resolveImgSrc(src ?? '')}
                      alt={alt ?? ''}
                      style={{
                        maxWidth: '100%',
                        borderRadius: '12px',
                        margin: '14px 0',
                        boxShadow: '0 2px 8px rgba(28, 28, 28, 0.06)',
                      }}
                    />
                  ),
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      style={{ color: '#4d6265' }}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {children}
                    </a>
                  ),
                  // rehype-highlight emits a <code> with class="language-xxx"
                  // for both <pre><code> and inline <code> when not inside a
                  // <pre>. We only want to style inline code; pre > code is
                  // handled by the highlight.js theme in app.css.
                  code: ({ inline, className, children, ...props }: any) => {
                    if (inline) {
                      return (
                        <code className={className} style={inlineCodeStyle} {...props}>
                          {children}
                        </code>
                      )
                    }
                    return (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                  // Headings — full visual treatment lives in app.css
                  // (h1 with bottom rule, h2 with brand gradient bar,
                  // h3-h6 with progressively lighter weight/color). The
                  // inline styles here are minimum guarantees so the
                  // elements render correctly even if CSS is cached stale.
                  h1: ({ children }) => (
                    <h1
                      style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        margin: '28px 0 14px',
                        paddingBottom: '10px',
                        borderBottom: '1px solid rgba(194, 199, 200, 0.5)',
                        color: '#1b1c1c',
                      }}
                    >
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2
                      style={{
                        fontSize: '20px',
                        fontWeight: 700,
                        margin: '24px 0 10px',
                        color: '#1b1c1c',
                        borderLeft: '3px solid #4d6265',
                        paddingLeft: '12px',
                      }}
                    >
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3
                      style={{
                        fontSize: '17px',
                        fontWeight: 600,
                        margin: '20px 0 8px',
                        color: '#424849',
                      }}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        margin: '16px 0 6px',
                        color: '#424849',
                      }}
                    >
                      {children}
                    </h4>
                  ),
                  h5: ({ children }) => (
                    <h5
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        margin: '14px 0 6px',
                        color: '#424849',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {children}
                    </h5>
                  ),
                  h6: ({ children }) => (
                    <h6
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        margin: '12px 0 4px',
                        color: '#727879',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {children}
                    </h6>
                  ),
                  p: ({ children }) => (
                    <p style={{ margin: '10px 0' }}>{children}</p>
                  ),
                  // Lists
                  ul: ({ children }) => (
                    // listStyle must be set inline because Tailwind's
                    // preflight (`@tailwind base`) applies `list-style: none`
                    // to all ul/ol — without an explicit listStyle the
                    // bullets/numbers are stripped and lists look like plain
                    // stacked text.
                    <ul
                      style={{
                        paddingLeft: '26px',
                        margin: '10px 0',
                        listStyle: 'disc outside',
                      }}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children, start, type }: any) => (
                    <ol
                      start={start}
                      type={type}
                      style={{
                        paddingLeft: '26px',
                        margin: '10px 0',
                        listStyle:
                          type === 'a'
                            ? 'lower-alpha outside'
                            : type === 'A'
                              ? 'upper-alpha outside'
                              : type === 'i'
                                ? 'lower-roman outside'
                                : type === 'I'
                                  ? 'upper-roman outside'
                                  : 'decimal outside',
                      }}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    // display: list-item keeps the bullet/number anchored to
                    // the item; preflight inherits the parent list-style.
                    <li style={{ margin: '6px 0', display: 'list-item' }}>
                      {children}
                    </li>
                  ),
                  // Block elements
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{
                        background: 'rgba(77, 98, 101, 0.06)',
                        borderLeft: '2px solid #4d6265',
                        borderRadius: '0 8px 8px 0',
                        padding: '10px 14px',
                        margin: '14px 0',
                        color: '#424849',
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                  pre: ({ children, ...props }: any) => (
                    <pre
                      {...props}
                      style={{
                        background: '#f5f3f3',
                        border: '1px solid rgba(194, 199, 200, 0.45)',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        overflow: 'auto',
                        margin: '14px 0',
                        fontSize: '13px',
                        lineHeight: 1.7,
                        color: '#1b1c1c',
                      }}
                    >
                      {children}
                    </pre>
                  ),
                  hr: () => (
                    <hr
                      style={{
                        border: 'none',
                        borderTop: '1px solid rgba(194, 199, 200, 0.5)',
                        margin: '20px 0',
                      }}
                    />
                  ),
                  // Tables (GFM)
                  table: ({ children }) => (
                    <div style={{ overflowX: 'auto', margin: '14px 0' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'separate',
                          borderSpacing: 0,
                          fontSize: '14px',
                          border: '1px solid rgba(194, 199, 200, 0.45)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ background: 'rgba(77, 98, 101, 0.06)' }}>
                      {children}
                    </thead>
                  ),
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr>{children}</tr>,
                  th: ({ children, style }: any) => (
                    <th
                      style={{
                        borderBottom: '1px solid rgba(194, 199, 200, 0.45)',
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#424849',
                        background: 'rgba(77, 98, 101, 0.06)',
                        ...(style ?? {}),
                      }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children, style }: any) => (
                    <td
                      style={{
                        borderTop: '1px solid rgba(194, 199, 200, 0.25)',
                        padding: '10px 12px',
                        color: '#1b1c1c',
                        background: '#ffffff',
                        ...(style ?? {}),
                      }}
                    >
                      {children}
                    </td>
                  ),
                  // GFM task list checkboxes — react-markdown already
                  // renders an <input type="checkbox" disabled> at the
                  // start of the <li>. Tailwind preflight also hides
                  // native checkboxes by default, so we restore a
                  // visible one with our own accent color.
                  input: ({ type, checked, disabled, ...rest }: any) => {
                    if (type === 'checkbox') {
                      return (
                        <input
                          type='checkbox'
                          checked={!!checked}
                          disabled={disabled}
                          readOnly
                          {...rest}
                          style={{
                            marginRight: '8px',
                            verticalAlign: 'middle',
                            width: '16px',
                            height: '16px',
                            accentColor: '#4d6265',
                          }}
                        />
                      )
                    }
                    return <input type={type} {...rest} />
                  },
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
