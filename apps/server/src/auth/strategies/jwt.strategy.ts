import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

/**
 * Payload shape we put into the access token at login time.
 */
export interface JwtPayload {
  sub: number;
  role: string;
}

/**
 * Request user shape attached by the JWT strategy's validate() return.
 */
export interface RequestUser {
  id: number;
  role: string;
}

/**
 * Passport-JWT strategy. Extracts the Bearer token from the Authorization
 * header, verifies it against JWT_SECRET, and returns { id, role } as
 * req.user for downstream guards/decorators.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload): RequestUser {
    return { id: payload.sub, role: payload.role };
  }
}
