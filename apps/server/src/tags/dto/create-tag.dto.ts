import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Create-tag request body for POST /tags (user-facing, from the upload page).
 * Only `name` is required — weight defaults to 0 and color is randomly assigned.
 */
export class CreateTagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name!: string;
}
