import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigType } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwtConfig from '../../../config/jwt.config';
import { UsersRepository } from '../../users/users.repository';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

interface AccessTokenPayload {
  sub: string;
  role: string;
  iat: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(jwtConfig.KEY) config: ConfigType<typeof jwtConfig>,
    private readonly users: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.accessSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === 'banned') throw new UnauthorizedException('Account banned');
    if (user.status === 'suspended') throw new UnauthorizedException('Account suspended');

    const updatedTs = Math.floor(new Date(user.updated_at).getTime() / 1000);
    if (payload.iat < updatedTs) {
      throw new UnauthorizedException('Token invalidated — please log in again');
    }

    return { id: user.id, role: user.role };
  }
}
