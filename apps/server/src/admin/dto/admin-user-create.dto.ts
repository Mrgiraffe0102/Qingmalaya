import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Body for POST /admin/users — create a new STUDENT or TEACHER account.
 *
 * `studentId` doubles as the login username (matches User.studentId).
 * `role` is restricted to STUDENT / TEACHER — admin accounts are created via
 * the separate /admin/admins endpoint. `classId` is optional and typically
 * set for students. When `role` is TEACHER, `managedClassIds` and
 * `manageAllClasses` control which classes the teacher can manage in the
 * admin backend. The created user is forced into mustChangePassword=true
 * so they reset it on first login.
 */
export class AdminUserCreateDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(['STUDENT', 'TEACHER'])
  role!: 'STUDENT' | 'TEACHER';

  @IsInt()
  @IsOptional()
  classId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  managedClassIds?: number[];

  @IsBoolean()
  @IsOptional()
  manageAllClasses?: boolean;
}
