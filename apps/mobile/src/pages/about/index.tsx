import Taro from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import AppLayout from '../../components/AppLayout'
import PageContainer from '../../components/AppLayout/PageContainer'
import { useAuthRedirect } from '../../utils/route-guard'

import pyzJpg from '../../../pics/about/pyz.jpg'
import lycJpg from '../../../pics/about/lyc.jpg'

const APP_VERSION = 'v1.0.0'

const FEATURES = [
  { icon: 'podcasts', title: '校园播客', desc: '聆听其他同学发布的播客' },
  { icon: 'mic', title: '自由创作', desc: '编辑、发布你的播客' },
  { icon: 'forum', title: '互动交流', desc: '点赞、评论、收藏你喜爱的内容' },
  { icon: 'auto_awesome', title: '精选集', desc: '策展优质播客，让好内容被更多人听见' },
]

const DEVELOPERS = [
  {
    avatar: pyzJpg,
    name: '庞宇泽',
    role: '全栈开发',
    desc: '全栈开发与服务器维护。',
  },
  {
    avatar: lycJpg,
    name: '李远岑',
    role: 'UI · 美术',
    desc: 'UI 布局与界面设计。',
  },
]

const FEEDBACK_CHANNELS = [
  {
    icon: 'bug_report',
    title: 'Bug 反馈',
    desc: '发现问题？新功能建议？加入群聊告诉我们，我们会尽快更新修复',
    tint: '#ba1a1a',
    bg: 'rgba(186, 26, 26, 0.08)',
    action: () => Taro.previewImage({ urls: ['https://via.placeholder.com/400x400?text=QR+Code'] }),
    actionLabel: '查看二维码',
  },
  {
    icon: 'code',
    title: '参与开发',
    desc: '有相关开发经验？想参与服务器运维？请添加该微信号（添加时请注明来意）',
    tint: '#326578',
    bg: 'rgba(50, 101, 120, 0.08)',
    action: () => Taro.setClipboardData({ data: 'feedback@qingmalaya.app' }),
    actionLabel: '复制微信号',
  },
]

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.switchTab({ url: '/pages/discovery/index' }),
  })
}

export default function AboutPage() {
  const ok = useAuthRedirect()
  if (!ok) return null

  return (
    <AppLayout currentTab='profile' hideChrome>
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

        {/* Hero */}
        <View
          className='mx-4 mt-2 overflow-hidden rounded-3xl'
          style={{
            background: 'linear-gradient(135deg, #4d6265 0%, #326578 100%)',
            padding: '32px 24px 28px',
          }}
        >
          <View
            className='flex items-center justify-center rounded-3xl'
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 16px',
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Text
              className='material-symbols-outlined text-white'
              style={{ fontSize: '40px' }}
            >
              podcasts
            </Text>
          </View>
          <Text
            className='block text-center text-white'
            style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.02em' }}
          >
            万卷回响
          </Text>
          <Text
            className='block text-center'
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: '14px',
              marginTop: '6px',
            }}
          >
            G25 的校园播客平台
          </Text>
          <View
            className='mx-auto'
            style={{
              marginTop: '14px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <View
              className='rounded-full'
              style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '4px 14px',
              }}
            >
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '600',
                  letterSpacing: '0.05em',
                }}
              >
                {APP_VERSION}
              </Text>
            </View>
          </View>
        </View>

        {/* App introduction */}
        <Section title='关于万卷回响' icon='info'>
          <Text
            className='block'
            style={{
              fontSize: '14px',
              lineHeight: '1.8',
              color: '#424849',
            }}
          >
            万卷回响是一个面向 G25 级学生的校园播客平台。在这里，你可以收听同学们创作的播客节目，分享你的观点与灵感，也可以拿起麦克风，记录属于你的校园之声。
          </Text>
        </Section>

        {/* Features */}
        <Section title='核心功能' icon='stars'>
          <View className='grid grid-cols-2' style={{ gap: '12px' }}>
            {FEATURES.map((f) => (
              <View
                key={f.title}
                className='rounded-2xl'
                style={{
                  background: '#f5f3f3',
                  padding: '16px',
                  border: '1px solid rgba(194, 199, 200, 0.15)',
                }}
              >
                <View
                  className='flex items-center justify-center rounded-full text-primary'
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(77, 98, 101, 0.1)',
                    marginBottom: '10px',
                  }}
                >
                  <Text className='material-symbols-outlined' style={{ fontSize: '20px' }}>
                    {f.icon}
                  </Text>
                </View>
                <Text
                  className='block text-on-surface'
                  style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}
                >
                  {f.title}
                </Text>
                <Text
                  className='block text-on-surface-variant'
                  style={{ fontSize: '12px', lineHeight: '16px' }}
                >
                  {f.desc}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Developer */}
        <Section title='开发团队' icon='code'>
          <View className='grid grid-cols-2' style={{ gap: '12px' }}>
            {DEVELOPERS.map((dev) => (
              <View
                key={dev.name}
                className='rounded-2xl'
                style={{
                  background: '#f5f3f3',
                  padding: '16px',
                  border: '1px solid rgba(194, 199, 200, 0.15)',
                }}
              >
                <View
                  className='rounded-full overflow-hidden'
                  style={{
                    width: '56px',
                    height: '56px',
                    margin: '0 auto 10px',
                  }}
                >
                  <Image
                    src={dev.avatar}
                    style={{ width: '100%', height: '100%' }}
                    mode='aspectFill'
                  />
                </View>
                <Text
                  className='block text-center text-on-surface'
                  style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}
                >
                  {dev.name}
                </Text>
                <Text
                  className='block text-center text-primary'
                  style={{ fontSize: '11px', fontWeight: '600', marginBottom: '2px' }}
                >
                  {dev.role}
                </Text>
                <Text
                  className='block text-center text-on-surface-variant'
                  style={{ fontSize: '12px', lineHeight: '1.7', marginTop: '10px' }}
                >
                  {dev.desc}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Feedback channels */}
        <Section title='反馈与交流' icon='support_agent'>
          <View
            className='overflow-hidden rounded-2xl'
            style={{
              background: '#ffffff',
              border: '1px solid rgba(194, 199, 200, 0.15)',
            }}
          >
            {FEEDBACK_CHANNELS.map((ch, idx) => (
              <View key={ch.title}>
                <View
                  onClick={ch.action}
                  className='flex items-center'
                  style={{ padding: '16px', gap: '14px' }}
                >
                  <View
                    className='flex items-center justify-center rounded-full'
                    style={{
                      width: '40px',
                      height: '40px',
                      background: ch.bg,
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      className='material-symbols-outlined'
                      style={{ fontSize: '20px', color: ch.tint }}
                    >
                      {ch.icon}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      className='block text-on-surface'
                      style={{ fontSize: '15px', fontWeight: '500' }}
                    >
                      {ch.title}
                    </Text>
                    <Text
                      className='block text-on-surface-variant'
                      style={{ fontSize: '12px', marginTop: '2px' }}
                    >
                      {ch.desc}
                    </Text>
                  </View>
                  <View
                    className='rounded-full'
                    style={{
                      background: 'rgba(77, 98, 101, 0.08)',
                      padding: '5px 12px',
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      className='text-primary'
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    >
                      {ch.actionLabel}
                    </Text>
                  </View>
                </View>
                {idx < FEEDBACK_CHANNELS.length - 1 && (
                  <View
                    style={{
                      height: '1px',
                      background: 'rgba(194, 199, 200, 0.2)',
                      marginLeft: '70px',
                    }}
                  />
                )}
              </View>
            ))}
          </View>
        </Section>

        {/* Footer */}
        <View
          className='flex flex-col items-center'
          style={{ padding: '24px 16px 40px' }}
        >
          <Text
            className='block text-outline'
            style={{ fontSize: '12px', marginBottom: '4px' }}
          >
            Made with ♥ by 庞宇泽 & 李远岑
          </Text>
          <Text
            className='block text-outline'
            style={{ fontSize: '11px', opacity: 0.7 }}
          >
            © 2026 万卷回响 · 保留所有权利
          </Text>
        </View>
      </PageContainer>
    </AppLayout>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <View style={{ padding: '0 16px', marginTop: '24px' }}>
      <View
        className='flex items-center'
        style={{ gap: '6px', marginBottom: '12px', marginLeft: '2px' }}
      >
        <Text
          className='material-symbols-outlined text-primary'
          style={{ fontSize: '18px' }}
        >
          {icon}
        </Text>
        <Text
          className='text-on-surface'
          style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.01em' }}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  )
}
