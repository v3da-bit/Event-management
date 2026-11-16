import { Module } from "@nestjs/common";
import { EventsService } from "./events.service";
import { EventsController } from "./events.controller";
import { GoogleCalendarModule } from "../google-calendar/calendar.module";
@Module({
  imports: [GoogleCalendarModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
