import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Response } from "express";
import { randomBytes, timingSafeEqual } from "crypto";
import { JwtGuard } from "../auth/security";
import { CalendarService } from "./calendar.service";
@Controller("google-calendar")
export class CalendarController {
  constructor(
    private calendar: CalendarService,
    private config: ConfigService,
    private jwt: JwtService,
  ) {}
  @Get("connect") @UseGuards(JwtGuard) connect(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const nonce = randomBytes(32).toString("hex");
    const state = this.jwt.sign(
      { sub: req.user.id, nonce, purpose: "google-calendar" },
      { secret: this.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: "10m" },
    );
    const url = this.calendar.connectUrl(state);
    res.cookie("oauth_state", nonce, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") === "production",
      sameSite: "lax",
      maxAge: 600000,
      path: "/google-calendar",
    });
    res.redirect(url);
  }
  @Get("callback") async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    try {
      const decoded = this.jwt.verify(state, {
        secret: this.config.getOrThrow("JWT_ACCESS_SECRET"),
      });
      const cookie = req.cookies?.oauth_state;
      if (
        decoded.purpose !== "google-calendar" ||
        !cookie ||
        cookie.length !== decoded.nonce.length ||
        !timingSafeEqual(Buffer.from(cookie), Buffer.from(decoded.nonce)) ||
        !code
      )
        throw new BadRequestException();
      res.clearCookie("oauth_state", { path: "/google-calendar" });
      await this.calendar.connect(decoded.sub, code);
      res.redirect(
        `${this.config.getOrThrow("FRONTEND_URL")}/settings?calendar=connected`,
      );
    } catch {
      res.clearCookie("oauth_state", { path: "/google-calendar" });
      res.redirect(
        `${this.config.getOrThrow("FRONTEND_URL")}/settings?calendar=error`,
      );
    }
  }
  @Get("status") @UseGuards(JwtGuard) status(@Req() req: any) {
    return this.calendar.status(req.user.id);
  }
  @Post("sync") @UseGuards(JwtGuard) sync(@Req() req: any) {
    return this.calendar.enqueueUser(req.user.id);
  }
  @Delete("disconnect") @UseGuards(JwtGuard) disconnect(@Req() req: any) {
    return this.calendar.disconnect(req.user.id);
  }
}
