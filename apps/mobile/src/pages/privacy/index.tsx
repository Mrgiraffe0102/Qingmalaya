import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.redirectTo({ url: '/pages/login/index' }),
  })
}

export default function PrivacyPage() {
  return (
    <View className='relative min-h-screen w-full overflow-hidden bg-surface text-on-surface'>
      {/* Header */}
      <View
        className='sticky top-0 z-20 flex items-center'
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: 'rgba(251, 249, 248, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(114, 120, 121, 0.08)',
        }}
      >
        <View
          onClick={handleBack}
          className='flex h-12 w-12 items-center justify-center text-primary'
        >
          <Text className='material-symbols-outlined' style={{ fontSize: '22px' }}>
            arrow_back
          </Text>
        </View>
        <Text
          className='text-on-surface'
          style={{ fontSize: '17px', fontWeight: '600', flex: 1, textAlign: 'center', paddingRight: '48px' }}
        >
          隐私政策
        </Text>
      </View>

      <ScrollView scrollY className='relative z-10' style={{ height: 'calc(100vh - 49px - env(safe-area-inset-top, 0px))' }}>
        <View style={{ padding: '24px 20px 60px' }}>
          <Text
            className='block text-center text-on-surface-variant'
            style={{ fontSize: '12px', marginBottom: '6px' }}
          >
            更新日期：2026年7月10日
          </Text>
          <Text
            className='block text-center text-outline'
            style={{ fontSize: '11px', marginBottom: '28px' }}
          >
            生效日期：2026年7月10日
          </Text>

          <Section title='引言'>
            <Para>
              清马拉雅（以下简称"本平台"）高度重视用户隐私保护。本隐私政策旨在向您说明我们收集、使用、存储和保护您个人信息的方式，以保障您的合法权益。
            </Para>
            <Para>
              请您在使用本平台前仔细阅读本隐私政策。您点击同意或使用本平台服务，即表示您同意本政策所述的信息收集和使用方式。
            </Para>
          </Section>

          <Section title='一、我们收集的信息'>
            <Para>为了提供服务，本平台会收集以下信息：</Para>
            <Para>
              1. <Bold>账号信息</Bold>：您的学号，用于身份验证与登录。学号是本平台的唯一登录凭证。
            </Para>
            <Para>
              2. <Bold>内容信息</Bold>：您发布的播客音频、封面图片、标题与描述，以及您发表的评论、点赞、收藏等互动数据。
            </Para>
            <Para>
              3. <Bold>使用记录</Bold>：您的播放历史、浏览记录、搜索记录等，用于提供个性化服务和内容推荐。
            </Para>
            <Para>
              4. <Bold>设备信息</Bold>：在您使用过程中自动收集的设备型号、浏览器类型等基础信息，用于服务优化和问题排查。
            </Para>
            <Para>
              我们不会收集您的姓名、手机号、身份证号等个人身份信息，除非您主动在播客内容中披露。
            </Para>
          </Section>

          <Section title='二、信息的使用'>
            <Para>我们收集的信息将用于以下目的：</Para>
            <Para>1. 提供登录、播客发布、收听、评论等核心功能服务；</Para>
            <Para>2. 保存您的播放进度、收藏和历史记录，以便您跨设备继续使用；</Para>
            <Para>3. 向您发送通知，包括播客审核结果、评论提醒、点赞提醒等；</Para>
            <Para>4. 维护平台安全，防范违规行为和恶意攻击；</Para>
            <Para>5. 改进和优化平台功能，提升用户体验。</Para>
            <Para>
              我们不会将您的信息用于商业广告推送，也不会向任何第三方出售您的个人信息。
            </Para>
          </Section>

          <Section title='三、信息的存储与保护'>
            <Para>
              1. 您的信息存储在平台服务器中，服务器部署在学校或开发团队管理的安全环境中。
            </Para>
            <Para>
              2. 我们采用密码加密存储、访问控制、安全传输（HTTPS）等技术手段，保护您的信息安全。
            </Para>
            <Para>
              3. 仅授权的开发与运维人员可在必要范围内访问数据，并负有保密义务。
            </Para>
            <Para>
              4. 尽管我们采取了合理的安全措施，但在互联网环境下仍不存在绝对的安全。我们将尽最大努力保护您的信息，但不对信息安全做绝对保证。
            </Para>
          </Section>

          <Section title='四、信息的共享与披露'>
            <Para>
              本平台为校园内部平台，不会主动向第三方共享或披露您的个人信息。但以下情况除外：
            </Para>
            <Para>
              1. 获得您的明确同意；
            </Para>
            <Para>
              2. 根据法律法规要求或有权机关的合法指令；
            </Para>
            <Para>
              3. 为维护平台合法权益，在合理必要范围内向相关方披露；
            </Para>
            <Para>
              4. 在平台合并、转让等情况下，相关信息将按照法律规定进行转移。
            </Para>
          </Section>

          <Section title='五、本地存储与缓存'>
            <Para>
              本平台会在您的设备本地存储登录凭证（Token）和使用偏好，以便您保持登录状态和快速恢复使用。您可以通过清除浏览器数据来删除这些本地存储信息，但可能导致需要重新登录。
            </Para>
          </Section>

          <Section title='六、您的权利'>
            <Para>您对个人信息享有以下权利：</Para>
            <Para>
              1. <Bold>查询与访问</Bold>：您可在"我的"页面查看您的账号信息和发布内容。
            </Para>
            <Para>
              2. <Bold>更正与修改</Bold>：您可修改密码，编辑已发布的播客信息。
            </Para>
            <Para>
              3. <Bold>删除</Bold>：您可删除自己发布的播客和评论，清除播放历史和收藏。
            </Para>
            <Para>
              4. <Bold>账号注销</Bold>：如需注销账号，请联系平台管理员，我们将在核实后为您处理。
            </Para>
          </Section>

          <Section title='七、未成年人保护'>
            <Para>
              本平台面向在校学生使用。我们将按照相关法律法规要求，保护未成年用户的个人信息。如果您是未满 14 周岁的学生，请在监护人的指导下使用本平台并阅读本隐私政策。
            </Para>
          </Section>

          <Section title='八、政策更新'>
            <Para>
              本平台可能根据法律法规变化或服务调整修订本隐私政策。修订后的政策将在平台内公布。若您在政策修订后继续使用本平台，即视为您接受修订后的内容。
            </Para>
          </Section>

          <Section title='九、联系我们'>
            <Para>
              如您对本隐私政策有任何疑问、意见或建议，可通过平台"关于"页面中的反馈渠道与开发团队联系。我们将在收到您的反馈后尽快回复。
            </Para>
          </Section>
        </View>
      </ScrollView>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: '28px' }}>
      <Text
        className='block text-on-surface'
        style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#1c1b1f' }}
      >
        {title}
      </Text>
      <View>{children}</View>
    </View>
  )
}

function Para({ children }: { children: React.ReactNode }) {
  return (
    <Text
      className='block'
      style={{
        fontSize: '14px',
        lineHeight: '1.85',
        color: '#424849',
        marginBottom: '10px',
      }}
    >
      {children}
    </Text>
  )
}

function Bold({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontWeight: '700', color: '#1c1b1f' }}>
      {children}
    </Text>
  )
}
