/**
 * Prisma seed script for the 万卷回响 campus podcast platform (Task 7).
 *
 * Idempotent: safe to run repeatedly. Uses upsert for entities with a unique
 * business key (User.studentId, Tag.name, SystemSetting.key) and a
 * find-then-update-or-create pattern for entities without one (Class, Banner,
 * Announcement). Podcasts are recreated by title (PodcastTag rows cascade).
 *
 * Run via: pnpm --filter @qingmalaya/server prisma:seed
 */

/* eslint-disable no-console */
import {
  PrismaClient,
  Role,
  UserStatus,
  PodcastStatus,
  TagColor,
  BannerLinkType,
  BannerStatus,
  AnnouncementStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Hash a plaintext password with bcrypt (cost 10). */
function hash(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

/** Inclusive random integer in [min, max]. */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

/**
 * Upsert a Class by its (non-unique) name. Class has no unique business key
 * besides the autoincrement id, so look it up by name then update or create.
 */
async function upsertClass(def: {
  name: string;
  grade: string;
}): Promise<{ id: number; name: string }> {
  const existing = await prisma.class.findFirst({ where: { name: def.name } });
  if (existing) {
    return prisma.class.update({
      where: { id: existing.id },
      data: { grade: def.grade },
    });
  }
  return prisma.class.create({ data: def });
}

async function main(): Promise<void> {
  console.log('[seed] Start seeding 万卷回响 database...');

  // ----------------------------------------------------------------- Classes
  console.log('[seed] Classes (3)');
  const cs1 = await upsertClass({
    name: '计算机2024-1班',
    grade: '2024',
  });
  const cs2 = await upsertClass({
    name: '计算机2024-2班',
    grade: '2024',
  });
  const ph = await upsertClass({
    name: '哲学2024班',
    grade: '2024',
  });

  // ---------------------------------------------------------------- Students
  // 20 students: 2024001-2024020. Distribution:
  //   2024001-2024008 -> CS2024-1
  //   2024009-2024016 -> CS2024-2
  //   2024017-2024020 -> PH2024
  console.log('[seed] Students (20)');
  const studentNames = [
    '张伟', '王芳', '李明', '陈静', '刘洋', '杨晨', '赵雪', '周涛',
    '孙琳', '朱琪', '徐磊', '胡敏', '郭鹏', '何婷', '高峰', '林娜',
    '郑浩', '梁玉', '谢军', '唐丽',
  ];
  const createdStudents: { studentId: string; id: number; classId: number | null }[] = [];
  for (let i = 1; i <= 20; i++) {
    const studentId = `2024${String(i).padStart(3, '0')}`; // 2024001 .. 2024020
    const name = studentNames[i - 1];
    // Password = last 6 characters of the studentId (e.g. "024001" for "2024001").
    const password = studentId.slice(-6);
    let classId: number;
    if (i >= 17) classId = ph.id;
    else if (i >= 9) classId = cs2.id;
    else classId = cs1.id;

    const user = await prisma.user.upsert({
      where: { studentId },
      update: {
        name,
        classId,
        passwordHash: hash(password),
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        totalListens: randInt(0, 500),
        totalLikes: randInt(0, 200),
      },
      create: {
        studentId,
        name,
        classId,
        passwordHash: hash(password),
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        totalListens: randInt(0, 500),
        totalLikes: randInt(0, 200),
      },
    });
    createdStudents.push({ studentId: user.studentId, id: user.id, classId: user.classId });
  }

  // ----------------------------------------------------------------- Teacher
  console.log('[seed] Teacher (1)');
  const teacher = await prisma.user.upsert({
    where: { studentId: 'T2024' },
    update: {
      name: '王老师',
      classId: cs1.id,
      passwordHash: hash('teacher123'),
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      firstLogin: true,
      manageAllClasses: false,
    },
    create: {
      studentId: 'T2024',
      name: '王老师',
      classId: cs1.id,
      passwordHash: hash('teacher123'),
      role: Role.TEACHER,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
      firstLogin: true,
      manageAllClasses: false,
    },
  });

  // Assign teacher to manage cs1 + cs2
  console.log('[seed] Teacher class assignments (2)');
  await prisma.teacherClass.deleteMany({ where: { teacherId: teacher.id } });
  await prisma.teacherClass.createMany({
    data: [
      { teacherId: teacher.id, classId: cs1.id },
      { teacherId: teacher.id, classId: cs2.id },
    ],
  });

  // ---------------------------------------------------------------- Operator
  console.log('[seed] Operator (1)');
  await prisma.user.upsert({
    where: { studentId: 'operator' },
    update: {
      name: '运营管理员',
      passwordHash: hash('operator123'),
      role: Role.OPERATOR,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
    create: {
      studentId: 'operator',
      name: '运营管理员',
      passwordHash: hash('operator123'),
      role: Role.OPERATOR,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });

  // ------------------------------------------------------------- Super Admin
  console.log('[seed] Super Admin (1)');
  await prisma.user.upsert({
    where: { studentId: 'admin' },
    update: {
      name: '超级管理员',
      passwordHash: hash('admin123'),
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
    create: {
      studentId: 'admin',
      name: '超级管理员',
      passwordHash: hash('admin123'),
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
    },
  });

  // -------------------------------------------------------------------- Tags
  console.log('[seed] Tags (8)');
  const tagDefs: { name: string; weight: number; color: TagColor }[] = [
    { name: '哲学', weight: 100, color: TagColor.purple },
    { name: '设计', weight: 90, color: TagColor.orange },
    { name: '文学', weight: 80, color: TagColor.mint },
    { name: '科技', weight: 85, color: TagColor.purple },
    { name: '音乐', weight: 75, color: TagColor.orange },
    { name: '历史', weight: 60, color: TagColor.mint },
    { name: '心理', weight: 70, color: TagColor.purple },
    { name: '校园生活', weight: 95, color: TagColor.mint },
  ];
  for (const t of tagDefs) {
    await prisma.tag.upsert({
      where: { name: t.name },
      update: { weight: t.weight, color: t.color },
      create: t,
    });
  }

  // ---------------------------------------------------------------- Podcasts
  // 5 published podcasts authored by students from different classes.
  console.log('[seed] Podcasts (5)');
  const podcastDefs: {
    title: string;
    description: string;
    authorStudentId: string;
    tagNames: string[];
  }[] = [
    {
      title: '关于存在主义的思考',
      description:
        '存在主义是20世纪重要的哲学流派,强调个人自由与选择。本期播客我们从萨特、加缪谈起,聊聊如何在平凡生活中寻找属于自己的意义。',
      authorStudentId: '2024017',
      tagNames: ['哲学', '文学', '心理'],
    },
    {
      title: 'UI设计入门心得',
      description:
        '作为计算机专业的学生,我在自学UI设计的过程中总结了一些经验。从配色、排版到组件库的使用,这里分享给同样刚入门的你。',
      authorStudentId: '2024001',
      tagNames: ['设计', '科技'],
    },
    {
      title: '校园音乐节的那些事',
      description:
        '去年的校园音乐节是我大学生活最难忘的回忆之一。从筹备到正式演出,台前幕后都有哪些有趣的故事?一起来听听吧。',
      authorStudentId: '2024009',
      tagNames: ['音乐', '校园生活'],
    },
    {
      title: '从算法看世界',
      description:
        '算法不只是代码,更是一种思维方式。本集聊聊排序、搜索背后的思想,以及它们如何潜移默化地影响我们看待世界的角度。',
      authorStudentId: '2024003',
      tagNames: ['科技', '哲学'],
    },
    {
      title: '心理学与日常生活',
      description:
        '心理学离我们并不遥远。从情绪管理到人际交往,本期分享几个实用的心理学小知识,帮助你更好地理解自己与他人。',
      authorStudentId: '2024011',
      tagNames: ['心理', '校园生活', '文学'],
    },
  ];

  for (let i = 0; i < podcastDefs.length; i++) {
    const def = podcastDefs[i];
    const author = createdStudents.find((s) => s.studentId === def.authorStudentId);
    if (!author) {
      throw new Error(`Author student not found: ${def.authorStudentId}`);
    }

    // Idempotent: remove any previously seeded podcast with this title (cascades
    // PodcastTag), then recreate with fresh random stats and tag links.
    await prisma.podcast.deleteMany({ where: { title: def.title } });

    await prisma.podcast.create({
      data: {
        title: def.title,
        description: def.description,
        coverPath: null,
        audioPath: `uploads/2024/07/sample-${i + 1}.mp3`,
        duration: randInt(300, 3600),
        authorId: author.id,
        classId: author.classId,
        status: PodcastStatus.PUBLISHED,
        publishedAt: daysAgo(randInt(1, 60)),
        playCount: randInt(50, 5000),
        likeCount: randInt(10, 1000),
        commentCount: randInt(0, 100),
        tags: {
          create: def.tagNames.map((name) => ({
            tag: { connect: { name } },
          })),
        },
      },
    });
  }

  // ------------------------------------------------------------------ Banner
  console.log('[seed] Banner (1)');
  const bannerTitle = 'G25 播客大赛火热进行中';
  const bannerData = {
    title: bannerTitle,
    coverPath: 'uploads/2024/07/banner1.jpg',
    linkType: BannerLinkType.NONE,
    sort: 0,
    status: BannerStatus.ONLINE,
    startAt: daysAgo(7),
    endAt: daysFromNow(30),
  };
  const existingBanner = await prisma.banner.findFirst({ where: { title: bannerTitle } });
  if (existingBanner) {
    await prisma.banner.update({ where: { id: existingBanner.id }, data: bannerData });
  } else {
    await prisma.banner.create({ data: bannerData });
  }

  // ----------------------------------------------------------- Announcement
  console.log('[seed] Announcement (1)');
  const announcementTitle = '欢迎来到万卷回响';
  const announcementContent =
    '万卷回响是 G25 学生的专属播客平台,在这里你可以收听同学的分享,也可以上传自己的播客。请使用学号登录,首次登录后请及时修改密码。';
  const announcementData = {
    title: announcementTitle,
    content: announcementContent,
    status: AnnouncementStatus.PUBLISHED,
    publishedAt: new Date(),
  };
  const existingAnnouncement = await prisma.announcement.findFirst({
    where: { title: announcementTitle },
  });
  if (existingAnnouncement) {
    await prisma.announcement.update({
      where: { id: existingAnnouncement.id },
      data: announcementData,
    });
  } else {
    await prisma.announcement.create({ data: announcementData });
  }

  // ---------------------------------------------------------- SystemSettings
  console.log('[seed] SystemSettings (4)');
  const settings: { key: string; value: string }[] = [
    { key: 'max_cover_size', value: '5242880' }, // 5 MB
    { key: 'max_audio_size', value: '209715200' }, // 200 MB
    { key: 'max_audio_duration', value: '3600' }, // 60 min
    { key: 'login_whitelist_enabled', value: 'false' },
  ];
  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  console.log('[seed] Done. Summary:');
  console.log('  - Students: 20 (2024001-2024020, password = last 6 digits of studentId)');
  console.log('  - Teacher: T2024 (password: teacher123)');
  console.log('  - Operator: operator (password: operator123)');
  console.log('  - Super Admin: admin (password: admin123)');
  console.log(`  - Classes: 3 | Tags: ${tagDefs.length} | Podcasts: ${podcastDefs.length}`);
  console.log('  - Banner: 1 | Announcement: 1 | SystemSettings: 4');
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
