import { IsString, IsInt, IsOptional, Min, IsNotEmpty } from 'class-validator';

/**
 * DTO for creating a new app release.
 * The APK file is uploaded separately via the upload-apk endpoint and its
 * relative path is passed here as `apkPath`.
 */
export class CreateReleaseDto {
  @IsString()
  @IsNotEmpty({ message: '版本号不能为空' })
  version!: string;

  @IsInt()
  @Min(1, { message: '版本号(数字)必须大于 0' })
  versionCode!: number;

  @IsString()
  @IsNotEmpty({ message: '更新内容不能为空' })
  updateContent!: string;

  @IsOptional()
  @IsString()
  apkPath?: string;
}
