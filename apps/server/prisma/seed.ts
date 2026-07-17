/**
 * Prisma seed script for the 万卷回响 campus podcast platform.
 *
 * Seeds a fresh G25 cohort sourced from `g25-data.json`:
 *   - 19 classes named G2501..G2519, grade G25
 *   - 10 teachers whose studentId is the pinyin of their name
 *   - 816 students distributed across the 19 classes
 *   - 4 student admins per class (the first 4 by studentId)
 *   - Each teacher manages 1-2 classes via TeacherClass
 *
 * Idempotent: safe to run repeatedly. Cleans up any non-matching legacy
 * rows from the previous seed (2024-grade classes, 2024001..2024020 students,
 * the T2024 teacher, and any podcasts that referenced them) before
 * re-seeding. The OPERATOR, SUPER_ADMIN accounts and other shared resources
 * (tags, banner, announcement, system settings) are preserved.
 *
 * Run via: pnpm --filter @qingmalaya/server prisma:seed
 */

/* eslint-disable no-console */
import {
  PrismaClient,
  Role,
  UserStatus,
  TagColor,
  BannerLinkType,
  BannerStatus,
  AnnouncementStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/** Hash a plaintext password with bcrypt (cost 10). */
function hash(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

interface G25Class {
  name: string;
  grade: string;
}

interface G25Student {
  studentId: string;
  name: string;
  className: string;
  isStudentAdmin: boolean;
}

interface G25Teacher {
  name: string;
  studentId: string; // pinyin
  classNames: string[];
}

interface G25Data {
  classes: G25Class[];
  students: G25Student[];
  teachers: G25Teacher[];
}

/** Upsert a Class by (non-unique) name. */
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
  console.log('[seed] Start seeding 万卷回响 G25 database...');

  // Load G25 data from the sibling JSON file.
  const dataPath = path.join(__dirname, 'g25-data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data: G25Data = JSON.parse(raw);
  const { classes, students, teachers } = data;

  console.log(
    `[seed] Loaded G25 data: ${classes.length} classes, ${students.length} students, ${teachers.length} teachers`,
  );

  // ----------------------------------------------------------------- Cleanup
  // Remove legacy rows from the previous (2024) seed so we can re-seed
  // cleanly. The OPERATOR + SUPER_ADMIN accounts and shared resources
  // (tags, banner, announcement, system settings) are left intact.
  console.log('[seed] Cleaning up legacy 2024 data...');

  // Legacy podcasts by title (cascades to comments/likes/etc. via authorId).
  const legacyPodcastTitles = [
    '关于存在主义的思考',
    'UI设计入门心得',
    '校园音乐节的那些事',
    '从算法看世界',
    '心理学与日常生活',
  ];
  for (const title of legacyPodcastTitles) {
    await prisma.podcast.deleteMany({ where: { title } });
  }

  // Legacy student IDs (2024001..2024020). Cascade their likes/favorites/
  // play histories/notifications. AdminLog entries authored by them are
  // deleted first (AdminLog has no onDelete cascade).
  const legacyStudentIds: string[] = [];
  for (let i = 1; i <= 20; i++) {
    legacyStudentIds.push(`2024${String(i).padStart(3, '0')}`);
  }
  for (const sid of legacyStudentIds) {
    await prisma.adminLog.deleteMany({ where: { admin: { studentId: sid } } });
  }
  await prisma.user.deleteMany({ where: { studentId: { in: legacyStudentIds } } });

  // Legacy teacher T2024.
  await prisma.adminLog.deleteMany({ where: { admin: { studentId: 'T2024' } } });
  await prisma.user.deleteMany({ where: { studentId: 'T2024' } });

  // Legacy classes (2024 grade) — safe to delete now since their users are
  // gone. TeacherClass rows for legacy teachers are removed with cascade.
  await prisma.class.deleteMany({
    where: { name: { in: ['计算机2024-1班', '计算机2024-2班', '哲学2024班'] } },
  });

  // ----------------------------------------------------------------- Classes
  console.log(`[seed] Classes (${classes.length})`);
  const classByName = new Map<string, { id: number; name: string }>();
  for (const c of classes) {
    const created = await upsertClass(c);
    classByName.set(created.name, created);
  }

  // ---------------------------------------------------------------- Students
  console.log(`[seed] Students (${students.length})`);
  const studentById = new Map<
    string,
    { id: number; studentId: string; classId: number | null }
  >();
  // Bulk pre-fetch existing students to keep the loop fast.
  const existingStudents = await prisma.user.findMany({
    where: {
      studentId: { in: students.map((s) => s.studentId) },
    },
    select: { id: true, studentId: true, classId: true },
  });
  for (const e of existingStudents) {
    studentById.set(e.studentId, e);
  }

  for (const s of students) {
    const classId = classByName.get(s.className)?.id ?? null;
    const user = await prisma.user.upsert({
      where: { studentId: s.studentId },
      update: {
        name: s.name,
        classId,
        passwordHash: hash(s.studentId),
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        isStudentAdmin: s.isStudentAdmin,
      },
      create: {
        studentId: s.studentId,
        name: s.name,
        classId,
        passwordHash: hash(s.studentId),
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        isStudentAdmin: s.isStudentAdmin,
        totalListens: 0,
        totalLikes: 0,
      },
    });
    studentById.set(user.studentId, {
      id: user.id,
      studentId: user.studentId,
      classId: user.classId,
    });
  }

  // ----------------------------------------------------------------- Teacher
  console.log(`[seed] Teachers (${teachers.length})`);
  for (const t of teachers) {
    // No classId for teachers; their managed classes are tracked via
    // TeacherClass. manageAllClasses=false → scope to assigned classes only.
    const teacher = await prisma.user.upsert({
      where: { studentId: t.studentId },
      update: {
        name: t.name,
        classId: null,
        passwordHash: hash(t.studentId),
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        manageAllClasses: false,
      },
      create: {
        studentId: t.studentId,
        name: t.name,
        classId: null,
        passwordHash: hash(t.studentId),
        role: Role.TEACHER,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        firstLogin: true,
        manageAllClasses: false,
      },
    });

    // Replace TeacherClass rows for this teacher.
    await prisma.teacherClass.deleteMany({ where: { teacherId: teacher.id } });
    const teacherClassIds: number[] = [];
    for (const cn of t.classNames) {
      const cls = classByName.get(cn);
      if (cls) teacherClassIds.push(cls.id);
    }
    if (teacherClassIds.length > 0) {
      await prisma.teacherClass.createMany({
        data: teacherClassIds.map((classId) => ({
          teacherId: teacher.id,
          classId,
        })),
      });
    }
  }

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

  // ------------------------------------------------------------------ Banner
  console.log('[seed] Banner (1)');
  const bannerTitle = 'G25 播客大赛火热进行中';
  const bannerData = {
    title: bannerTitle,
    coverPath: 'uploads/2024/07/banner1.jpg',
    linkType: BannerLinkType.NONE,
    sort: 0,
    status: BannerStatus.ONLINE,
    startAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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

  // Summary
  const studentAdminCount = students.filter((s) => s.isStudentAdmin).length;
  console.log('[seed] Done. Summary:');
  console.log(`  - Classes: ${classes.length} (G2501..G2519, grade G25)`);
  console.log(`  - Students: ${students.length} (password = studentId)`);
  console.log(`  - Student admins: ${studentAdminCount} (4 per class)`);
  console.log(
    `  - Teachers: ${teachers.length} (username/password = pinyin, e.g. zhangjiaqi / zhangjiaqi)`,
  );
  for (const t of teachers) {
    console.log(`      · ${t.name} (${t.studentId}) → ${t.classNames.join(', ')}`);
  }
  console.log('  - Operator: operator (password: operator123)');
  console.log('  - Super Admin: admin (password: admin123)');
  console.log(`  - Tags: ${tagDefs.length} | Banner: 1 | Announcement: 1 | SystemSettings: 4`);
}

main()
  .catch((error) => {
    console.error('[seed] Failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
