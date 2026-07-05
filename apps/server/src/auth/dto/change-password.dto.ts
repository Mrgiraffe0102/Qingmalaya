import {
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator ensuring newPassword === confirmPassword.
 */
@ValidatorConstraint({ name: 'MatchPassword', async: false })
export class MatchPassword implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ChangePasswordDto;
    return dto.newPassword === dto.confirmPassword;
  }

  defaultMessage(): string {
    return '两次输入的密码不一致';
  }
}

/**
 * Change-password request body. newPassword must match confirmPassword,
 * enforced by the @Validate(MatchPassword) decorator on confirmPassword.
 *
 * The `!` definite-assignment assertions follow the NestJS DTO convention
 * (properties are populated by ValidationPipe, not via a constructor).
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;

  @IsString()
  @MinLength(6)
  @Validate(MatchPassword)
  confirmPassword!: string;
}
