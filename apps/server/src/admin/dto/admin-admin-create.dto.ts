import { IsIn, IsString, MinLength } from 'class-validator';

/**
 * Body for POST /admin/admins — create a new admin account.
 *
 * `studentId` doubles as the login username (matches User.studentId).
 * `role` is restricted to SUPER_ADMIN — other roles are created via the
 * /admin/users endpoint. The created user is forced into
 * mustChangePassword=true so the new admin resets it on first login.
 */
export class AdminAdminCreateDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['SUPER_ADMIN'])
  role!: 'SUPER_ADMIN';
}
