import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { JwtGuard } from "./security";
import { RegisterDto, LoginDto } from "../common/dto";
@Controller("auth")
export class AuthController {
  constructor(
    private auth: AuthService,
    private config: ConfigService,
  ) {}
  private cookies(res: Response, result: any) {
    const options = {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") === "production",
      sameSite: "lax" as const,
      path: "/",
    };
    res.cookie("access_token", result.access, { ...options, maxAge: 900000 });
    res.cookie("refresh_token", result.refresh, {
      ...options,
      maxAge: 30 * 86400000,
    });
    return result.user;
  }
  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(res, await this.auth.register(dto));
  }
  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(res, await this.auth.login(dto));
  }
  @Post("refresh") @HttpCode(200) async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.cookies(
      res,
      await this.auth.refresh(req.cookies?.refresh_token),
    );
  }
  @Post("logout") @HttpCode(200) async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.cookies?.refresh_token);
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
    return { message: "Signed out" };
  }
  @Get("me") @UseGuards(JwtGuard) me(@Req() req: any) {
    return this.auth.publicUser(req.user);
  }
}
