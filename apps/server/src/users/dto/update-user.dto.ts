import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

/**
 * Update-self request body for PUT /users/me. All fields optional — only
 * the provided ones are written. avatar is a relative upload path
 * (e.g. "2026/07/uuid.jpg"), not a public URL.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe, not via a constructor).
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(30)
  name?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  bio?: string;
}
