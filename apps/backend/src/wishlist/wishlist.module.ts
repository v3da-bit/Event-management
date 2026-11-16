import { Module } from "@nestjs/common";
import { WishlistService, WishlistController } from "./wishlist.controller";
import { EventsModule } from "../events/events.module";
@Module({
  imports: [EventsModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
