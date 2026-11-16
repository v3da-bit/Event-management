import {
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { JwtGuard } from "../auth/security";
import { EventsService } from "./events.service";
import { EventDto, UpdateEventDto, EventQuery } from "../common/dto";
@Controller("events")
@UseGuards(JwtGuard)
export class EventsController {
  constructor(private events: EventsService) {}
  @Post() create(@Body() dto: EventDto, @Req() req: any) {
    return this.events.create(dto, req.user);
  }
  @Get() list(@Query() q: EventQuery, @Req() req: any) {
    return this.events.list(q, req.user);
  }
  @Get("my-team") own(@Query() q: EventQuery, @Req() req: any) {
    return this.events.list(q, req.user, "own");
  }
  @Get("joined") joined(@Query() q: EventQuery, @Req() req: any) {
    return this.events.list(q, req.user, "joined");
  }
  @Get("summary") summary(@Req() req: any) {
    return this.events.summary(req.user);
  }
  @Get(":id") detail(@Param("id") id: string, @Req() req: any) {
    return this.events.detail(id, req.user);
  }
  @Patch(":id") update(
    @Param("id") id: string,
    @Body() dto: UpdateEventDto,
    @Req() req: any,
  ) {
    return this.events.update(id, dto, req.user);
  }
  @Delete(":id") delete(@Param("id") id: string, @Req() req: any) {
    return this.events.remove(id, req.user);
  }
  @Post(":id/join") join(@Param("id") id: string, @Req() req: any) {
    return this.events.join(id, req.user);
  }
  @Delete(":id/leave") leave(@Param("id") id: string, @Req() req: any) {
    return this.events.leave(id, req.user);
  }
  @Get(":id/participants") participants(@Param("id") id: string) {
    return this.events.people(id);
  }
}
