import { IsString, MinLength } from 'class-validator';

/**
 * Admin login request body. Unlike student login (studentId + password),
 * the admin portal accepts a generic `username` — which maps to the User.studentId
 * column (seeded as 'admin' / 'operator'). Only OPERATOR/SUPER_ADMIN roles
 * are permitted to authenticate through this endpoint.
 */
export class AdminLoginDto {
  @IsString()
  @MinLength(1)
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
