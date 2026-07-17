import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Upsert-popup request body for PUT /admin/popup.
 *
 * 因为 `Popup` 表始终只有一条记录（id=1），所以这个 DTO 既用于"创建"也用于"整体替换"。
 * - `title` 必填，1-120 字符
 * - `content` 必填，1-4000 字符
 * - `enabled` 可选，默认 true（启用弹窗）
 *
 * DTO 的字段子集对应 shared 的 `PopupUpdatePayload`——服务端在 controller 处做
 * 转换（或直接由前端用同一个类型）。Dart-style 的 `!` 断言沿用 NestJS 约定
 * （ValidationPipe 负责赋值）。
 */
export class PopupUpdateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content!: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
