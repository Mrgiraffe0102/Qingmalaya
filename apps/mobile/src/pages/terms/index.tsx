import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'

function handleBack(): void {
  Taro.navigateBack({
    fail: () => Taro.redirectTo({ url: '/pages/login/index' }),
  })
}

export default function TermsPage() {
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
          用户须知
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

          <Section title='一、服务说明'>
            <Para>
              清马拉雅（以下简称"本平台"）是面向 G25 级学生的校园播客创作与分享平台。本平台提供播客收听、发布、评论、点赞、收藏、精选集策展等功能，旨在为同学们打造一个自由表达、交流思想的校园声音社区。
            </Para>
            <Para>
              请您在使用本平台前仔细阅读本用户须知。您点击同意或使用本平台服务，即表示您已充分阅读、理解并接受本须知的全部内容。
            </Para>
          </Section>

          <Section title='二、账号与登录'>
            <Para>
              1. 本平台使用学号进行登录，仅限本校师生使用。您应使用本人真实学号登录，不得借用、转让或出售账号。
            </Para>
            <Para>
              2. 首次登录后请及时修改初始密码，并妥善保管。因账号密码保管不善导致的一切后果由您自行承担。
            </Para>
            <Para>
              3. 若发现账号被盗用或存在安全风险，请立即联系平台管理员处理。
            </Para>
          </Section>

          <Section title='三、用户行为规范'>
            <Para>您在使用本平台时应遵守以下规范：</Para>
            <Para>
              1. 遵守国家法律法规及学校规章制度，不得利用本平台从事任何违法违规活动；
            </Para>
            <Para>
              2. 尊重他人，不得发布侮辱、歧视、恐吓、骚扰等内容；
            </Para>
            <Para>
              3. 不得发布涉及政治敏感、暴力、色情、赌博、毒品等不良信息；
            </Para>
            <Para>
              4. 不得发布广告、垃圾信息或未经授权的商业推广内容；
            </Para>
            <Para>
              5. 不得利用技术手段干扰平台正常运行，包括但不限于恶意刷量、攻击服务器、爬取数据等；
            </Para>
            <Para>
              6. 不得冒充他人或虚构身份，不得发布不实信息。
            </Para>
          </Section>

          <Section title='四、内容规范'>
            <Para>
              1. 您发布播客、评论及其他内容时，应确保内容原创或已获得合法授权，不得侵犯他人知识产权。
            </Para>
            <Para>
              2. 播客内容应积极健康，鼓励分享学习经验、校园生活、思想感悟等有益内容。
            </Para>
            <Para>
              3. 平台有权对违规内容进行下架处理，并对违规用户采取警告、限制功能、封禁账号等措施。
            </Para>
            <Para>
              4. 管理员审核通过的播客方可公开展示，未通过审核的播客将予以退回并说明原因。
            </Para>
          </Section>

          <Section title='五、知识产权'>
            <Para>
              1. 您在本平台发布的原创内容，知识产权归您所有。您授权本平台在校内范围内使用、展示、传播该内容。
            </Para>
            <Para>
              2. 本平台的界面设计、Logo、图标、代码等知识产权归平台开发团队所有，未经授权不得复制或商用。
            </Para>
            <Para>
              3. 如发现平台内存在侵犯您知识产权的内容，请联系管理员，我们将在核实后及时处理。
            </Para>
          </Section>

          <Section title='六、免责声明'>
            <Para>
              1. 本平台为校园非营利性项目，不保证服务的持续性和稳定性，因网络故障、服务器维护等原因导致的服务中断不承担赔偿责任。
            </Para>
            <Para>
              2. 用户发布的内容不代表平台立场，平台不对用户内容的真实性、合法性承担责任。但因内容侵权或违规造成的后果，由内容发布者自行承担。
            </Para>
            <Para>
              3. 平台不对用户间的互动行为承担责任。如遇纠纷，建议双方协商解决，必要时可请求平台协助。
            </Para>
          </Section>

          <Section title='七、服务变更与终止'>
            <Para>
              1. 平台有权根据实际运营情况对服务内容进行调整、升级或停止，并会在平台内提前公告。
            </Para>
            <Para>
              2. 若您违反本须知，平台有权随时限制或终止您的账号使用权限。
            </Para>
            <Para>
              3. 毕业后账号将根据学校安排进行相应处理，具体以平台公告为准。
            </Para>
          </Section>

          <Section title='八、须知更新'>
            <Para>
              本平台有权根据法律法规变化及运营需要修订本须知，修订后的须知将在平台内公布。若您在须知修订后继续使用本平台，即视为您接受修订后的内容。
            </Para>
          </Section>

          <Section title='九、联系我们'>
            <Para>
              如您对本须知有任何疑问或建议，可通过平台"关于"页面中的反馈渠道与开发团队联系。
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
