import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Login request body. Validated by the global ValidationPipe before
 * reaching AuthService.login.
 *
 * The `!` definite-assignment assertions are the NestJS convention for
 * class-validator DTOs: properties are populated by the ValidationPipe's
 * transform step, not via a constructor.
 */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
