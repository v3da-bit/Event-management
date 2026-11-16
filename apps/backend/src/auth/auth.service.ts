import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { hash, compare } from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { RegisterDto, LoginDto, ProfileDto, PasswordDto } from "../common/dto";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
@Injectable()
export class AuthService {
  constructor(
    @InjectModel("User") private users: Model<any>,
    @InjectModel("Session") private sessions: Model<any>,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}
  async register(dto: RegisterDto) {
    try {
      const user = await this.users.create({
        ...dto,
        email: dto.email.toLowerCase().trim(),
        passwordHash: await hash(dto.password, 12),
      });
      return this.issue(user);
    } catch (e: any) {
      if (e.code === 11000)
        throw new ConflictException("This email is already registered");
      throw e;
    }
  }
  async login(dto: LoginDto) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase().trim() })
      .select("+passwordHash");
    if (!user || !(await compare(dto.password, user.passwordHash)))
      throw new UnauthorizedException("Incorrect email or password");
    return this.issue(user);
  }
  async issue(user: any) {
    const sid = randomUUID();
    const refresh = this.jwt.sign(
      { sub: String(user._id), sid },
      {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
        expiresIn: "30d",
      },
    );
    await this.sessions.create({
      userId: user._id,
      sid,
      tokenHash: digest(refresh),
      expiresAt: new Date(Date.now() + 30 * 86400000),
    });
    const access = this.jwt.sign(
      { sub: String(user._id), sid },
      { secret: this.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: "15m" },
    );
    return { access, refresh, user: this.publicUser(user) };
  }
  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    try {
      this.jwt.verify(token, {
        secret: this.config.getOrThrow("JWT_REFRESH_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Session expired");
    }
    // Atomic consume: exactly one request may rotate this session.
    const session = await this.sessions.findOneAndDelete({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw new UnauthorizedException("Session expired");
    const user = await this.users.findById(session.userId);
    if (!user) throw new UnauthorizedException();
    return this.issue(user);
  }
  async logout(token?: string) {
    if (token) await this.sessions.deleteOne({ tokenHash: digest(token) });
  }
  publicUser(user: any) {
    return {
      _id: String(user._id),
      fullName: user.fullName,
      email: user.email,
      team: user.team,
      profileImage: user.profileImage,
      googleCalendarConnected: user.googleCalendarConnected,
    };
  }
  async profile(id: string, dto: ProfileDto) {
    return this.publicUser(
      await this.users.findByIdAndUpdate(id, { $set: dto }, { new: true }),
    );
  }
  async password(id: string, dto: PasswordDto) {
    const user = await this.users.findById(id).select("+passwordHash");
    if (!user || !(await compare(dto.currentPassword, user.passwordHash)))
      throw new BadRequestException("Current password is incorrect");
    await this.users.updateOne(
      { _id: id },
      { passwordHash: await hash(dto.newPassword, 12) },
    );
    await this.sessions.deleteMany({ userId: id });
    return { message: "Password changed. Please sign in again." };
  }
}
