-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `classId` INTEGER NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('STUDENT', 'TEACHER', 'OPERATOR', 'SUPER_ADMIN') NOT NULL DEFAULT 'STUDENT',
    `avatar` VARCHAR(191) NULL,
    `bio` TEXT NULL,
    `totalListens` INTEGER NOT NULL DEFAULT 0,
    `totalLikes` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'BANNED') NOT NULL DEFAULT 'ACTIVE',
    `firstLogin` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `manageAllClasses` BOOLEAN NOT NULL DEFAULT false,
    `isStudentAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_studentId_key`(`studentId`),
    INDEX `User_classId_idx`(`classId`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Class` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `grade` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeacherClass` (
    `teacherId` INTEGER NOT NULL,
    `classId` INTEGER NOT NULL,

    INDEX `TeacherClass_classId_idx`(`classId`),
    PRIMARY KEY (`teacherId`, `classId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Podcast` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `coverPath` VARCHAR(191) NULL,
    `audioPath` VARCHAR(191) NOT NULL,
    `duration` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `classId` INTEGER NULL,
    `status` ENUM('PENDING', 'PUBLISHED', 'TAKEN_DOWN', 'FLAGGED') NOT NULL DEFAULT 'PENDING',
    `playCount` INTEGER NOT NULL DEFAULT 0,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `commentCount` INTEGER NOT NULL DEFAULT 0,
    `transcript` JSON NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Podcast_authorId_idx`(`authorId`),
    INDEX `Podcast_classId_idx`(`classId`),
    INDEX `Podcast_status_idx`(`status`),
    INDEX `Podcast_publishedAt_idx`(`publishedAt`),
    INDEX `Podcast_playCount_idx`(`playCount`),
    INDEX `Podcast_likeCount_idx`(`likeCount`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `weight` INTEGER NOT NULL DEFAULT 0,
    `color` ENUM('mint', 'purple', 'orange', 'rose', 'sky', 'teal', 'indigo', 'amber') NOT NULL DEFAULT 'mint',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PodcastTag` (
    `podcastId` INTEGER NOT NULL,
    `tagId` INTEGER NOT NULL,

    INDEX `PodcastTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`podcastId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Comment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `podcastId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `parentId` INTEGER NULL,
    `likeCount` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('VISIBLE', 'HIDDEN') NOT NULL DEFAULT 'VISIBLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Comment_podcastId_idx`(`podcastId`),
    INDEX `Comment_userId_idx`(`userId`),
    INDEX `Comment_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Like` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `targetType` ENUM('PODCAST', 'COMMENT') NOT NULL,
    `targetId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `podcastId` INTEGER NULL,
    `commentId` INTEGER NULL,

    INDEX `Like_targetType_targetId_idx`(`targetType`, `targetId`),
    UNIQUE INDEX `Like_userId_targetType_targetId_key`(`userId`, `targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Favorite` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `podcastId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Favorite_userId_podcastId_key`(`userId`, `podcastId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlayHistory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `podcastId` INTEGER NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `playedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlayHistory_userId_podcastId_idx`(`userId`, `podcastId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Banner` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `coverPath` VARCHAR(191) NOT NULL,
    `linkType` ENUM('PODCAST', 'PODCAST_LIST', 'COLLECTION', 'MARKDOWN', 'NONE') NOT NULL DEFAULT 'NONE',
    `linkTarget` VARCHAR(191) NULL,
    `markdownContent` TEXT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Banner_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Announcement` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Announcement_status_publishedAt_idx`(`status`, `publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminId` INTEGER NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` INTEGER NULL,
    `detail` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminLog_adminId_idx`(`adminId`),
    INDEX `AdminLog_targetType_targetId_idx`(`targetType`, `targetId`),
    INDEX `AdminLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserActivityLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `action` ENUM('PLAY', 'LIKE_PODCAST', 'UNLIKE_PODCAST', 'FAVORITE', 'UNFAVORITE', 'LIKE_COMMENT', 'UNLIKE_COMMENT', 'CREATE_COMMENT', 'DELETE_COMMENT', 'CREATE_PODCAST', 'UPDATE_PODCAST', 'DELETE_PODCAST', 'UPDATE_PROFILE') NOT NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` INTEGER NULL,
    `detail` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserActivityLog_userId_idx`(`userId`),
    INDEX `UserActivityLog_action_idx`(`action`),
    INDEX `UserActivityLog_createdAt_idx`(`createdAt`),
    INDEX `UserActivityLog_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BannedKeyword` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BannedKeyword_keyword_key`(`keyword`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Collection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `coverPath` VARCHAR(191) NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ONLINE', 'OFFLINE') NOT NULL DEFAULT 'ONLINE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Collection_status_sort_idx`(`status`, `sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionPodcast` (
    `collectionId` INTEGER NOT NULL,
    `podcastId` INTEGER NOT NULL,
    `sort` INTEGER NOT NULL DEFAULT 0,

    INDEX `CollectionPodcast_podcastId_idx`(`podcastId`),
    PRIMARY KEY (`collectionId`, `podcastId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UploadedFile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mimetype` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UploadedFile_mimetype_idx`(`mimetype`),
    INDEX `UploadedFile_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Notification` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('BROADCAST', 'PODCAST_APPROVED', 'PODCAST_REJECTED', 'PODCAST_LIKED', 'PODCAST_COMMENTED', 'PODCAST_FLAGGED', 'COMMENT_REPORTED') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `podcastId` INTEGER NULL,
    `actorId` INTEGER NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Notification_userId_read_idx`(`userId`, `read`),
    INDEX `Notification_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PodcastReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `podcastId` INTEGER NOT NULL,
    `reviewerId` INTEGER NOT NULL,
    `action` ENUM('APPROVE', 'FLAG', 'REJECT') NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PodcastReview_podcastId_idx`(`podcastId`),
    INDEX `PodcastReview_reviewerId_idx`(`reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CommentReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `commentId` INTEGER NOT NULL,
    `reporterId` INTEGER NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('PENDING', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `resolvedById` INTEGER NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CommentReport_commentId_idx`(`commentId`),
    INDEX `CommentReport_reporterId_idx`(`reporterId`),
    INDEX `CommentReport_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppRelease` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `version` VARCHAR(191) NOT NULL,
    `versionCode` INTEGER NOT NULL,
    `updateContent` TEXT NOT NULL,
    `apkPath` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AppRelease_version_key`(`version`),
    UNIQUE INDEX `AppRelease_versionCode_key`(`versionCode`),
    INDEX `AppRelease_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherClass` ADD CONSTRAINT `TeacherClass_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherClass` ADD CONSTRAINT `TeacherClass_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Podcast` ADD CONSTRAINT `Podcast_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Podcast` ADD CONSTRAINT `Podcast_classId_fkey` FOREIGN KEY (`classId`) REFERENCES `Class`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PodcastTag` ADD CONSTRAINT `PodcastTag_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PodcastTag` ADD CONSTRAINT `PodcastTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Comment` ADD CONSTRAINT `Comment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Like` ADD CONSTRAINT `Like_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Favorite` ADD CONSTRAINT `Favorite_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayHistory` ADD CONSTRAINT `PlayHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlayHistory` ADD CONSTRAINT `PlayHistory_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminLog` ADD CONSTRAINT `AdminLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserActivityLog` ADD CONSTRAINT `UserActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionPodcast` ADD CONSTRAINT `CollectionPodcast_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `Collection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionPodcast` ADD CONSTRAINT `CollectionPodcast_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PodcastReview` ADD CONSTRAINT `PodcastReview_podcastId_fkey` FOREIGN KEY (`podcastId`) REFERENCES `Podcast`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PodcastReview` ADD CONSTRAINT `PodcastReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommentReport` ADD CONSTRAINT `CommentReport_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `Comment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommentReport` ADD CONSTRAINT `CommentReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommentReport` ADD CONSTRAINT `CommentReport_resolvedById_fkey` FOREIGN KEY (`resolvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
