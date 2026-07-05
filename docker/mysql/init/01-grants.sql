-- Ensure qingmalaya user has full privileges including for shadow database used by Prisma
GRANT ALL PRIVILEGES ON *.* TO 'qingmalaya'@'%';
FLUSH PRIVILEGES;
