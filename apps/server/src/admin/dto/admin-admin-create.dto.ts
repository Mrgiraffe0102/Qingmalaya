import { IsIn, IsString, MinLength } from 'class-validator';

/**
 * Body for POST /admin/admins — create a new admin account.
 *
 * `studentId` doubles as the login username (matches User.studentId).
 * `role` is restricted to OPERATOR / SUPER_ADMIN — STUDENT and TEACHER are
 * not creatable through this endpoint. The created user is forced into
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

  @IsIn(['OPERATOR', 'SUPER_ADMIN'])
  role!: 'OPERATOR' | 'SUPER_ADMIN';
}
