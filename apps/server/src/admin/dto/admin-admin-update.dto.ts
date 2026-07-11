import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body for PUT /admin/admins/:id — partial update of an admin account.
 *
 * All fields are optional. When `password` is present it is re-hashed with
 * bcrypt and mustChangePassword is reset to true so the targeted admin is
 * forced to pick a new one on next login.
 */
export class AdminAdminUpdateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
