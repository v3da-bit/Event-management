import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { PassportStrategy, AuthGuard } from "@nestjs/passport";
import { Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel("User") private users: Model<any>,
    @InjectModel("Session") private sessions: Model<any>,
  ) {
    super({
      jwtFromRequest: (req: any) => req.cookies?.access_token,
      secretOrKey: config.getOrThrow("JWT_ACCESS_SECRET"),
    });
  }
  async validate(payload: { sub: string; sid?: string }) {
    if (
      !payload.sid ||
      !(await this.sessions.exists({
        sid: payload.sid,
        userId: payload.sub,
        expiresAt: { $gt: new Date() },
      }))
    )
      return null;
    return this.users
      .findById(payload.sub)
      .select("_id fullName email team profileImage googleCalendarConnected");
  }
}
@Injectable()
export class JwtGuard extends AuthGuard("jwt") {}
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private config: ConfigService) {}
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    if (req.headers.origin !== this.config.getOrThrow("FRONTEND_URL"))
      throw new ForbiddenException("Untrusted request origin");
    return true;
  }
}
export function validId(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id))
    throw new BadRequestException("Invalid resource ID");
}
