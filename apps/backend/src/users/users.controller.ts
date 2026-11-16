import { Controller, Get, Patch, Body, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { JwtGuard } from "../auth/security";
import { ProfileDto, PasswordDto } from "../common/dto";
@Controller("users")
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private auth: AuthService) {}
  @Get("me") me(@Req() req: any) {
    return this.auth.publicUser(req.user);
  }
  @Patch("me") update(@Req() req: any, @Body() dto: ProfileDto) {
    return this.auth.profile(req.user.id, dto);
  }
  @Patch("me/password") password(@Req() req: any, @Body() dto: PasswordDto) {
    return this.auth.password(req.user.id, dto);
  }
}
