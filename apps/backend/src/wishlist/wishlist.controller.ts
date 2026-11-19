import {
  Injectable,
  Controller,
  UseGuards,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JwtGuard, validId } from "../auth/security";
import { EventsService } from "../events/events.service";
import { WishlistDto, UpdateWishlistDto, ToggleDto } from "../common/dto";
@Injectable()
export class WishlistService {
  constructor(
    @InjectModel("Wishlist") private items: Model<any>,
    private events: EventsService,
  ) {}
  async list(eventId: string) {
    await this.events.get(eventId);
    return this.items.find({ eventId }).sort({ createdAt: 1 });
  }
  async add(eventId: string, dto: WishlistDto, user: any) {
    await this.events.own(eventId, user);
    const item = await this.items.create({ ...dto, eventId, createdBy: user._id });
    await this.events.refreshCalendar(eventId);
    return item;
  }
  async update(eventId: string, id: string, dto: any, user: any) {
    await this.events.own(eventId, user);
    validId(id);
    const item = await this.items.findOneAndUpdate(
      { _id: id, eventId },
      { $set: dto },
      { new: true },
    );
    if (!item) throw new NotFoundException("Wishlist item not found");
    await this.events.refreshCalendar(eventId);
    return item;
  }
  async toggle(eventId: string, id: string, completed: boolean, user: any) {
    return this.update(
      eventId,
      id,
      {
        isCompleted: completed,
        completedBy: completed ? user._id : null,
        completedAt: completed ? new Date() : null,
      },
      user,
    );
  }
  async remove(eventId: string, id: string, user: any) {
    await this.events.own(eventId, user);
    validId(id);
    await this.items.deleteOne({ _id: id, eventId });
    await this.events.refreshCalendar(eventId);
    return { message: "Item deleted" };
  }
}
@Controller("events/:eventId/wishlist")
@UseGuards(JwtGuard)
export class WishlistController {
  constructor(private wishlist: WishlistService) {}
  @Get() list(@Param("eventId") eventId: string) {
    return this.wishlist.list(eventId);
  }
  @Post() create(
    @Param("eventId") eventId: string,
    @Body() dto: WishlistDto,
    @Req() req: any,
  ) {
    return this.wishlist.add(eventId, dto, req.user);
  }
  @Patch(":itemId") update(
    @Param("eventId") eventId: string,
    @Param("itemId") id: string,
    @Body() dto: UpdateWishlistDto,
    @Req() req: any,
  ) {
    return this.wishlist.update(eventId, id, dto, req.user);
  }
  @Patch(":itemId/toggle") toggle(
    @Param("eventId") eventId: string,
    @Param("itemId") id: string,
    @Body() dto: ToggleDto,
    @Req() req: any,
  ) {
    return this.wishlist.toggle(eventId, id, dto.isCompleted, req.user);
  }
  @Delete(":itemId") remove(
    @Param("eventId") eventId: string,
    @Param("itemId") id: string,
    @Req() req: any,
  ) {
    return this.wishlist.remove(eventId, id, req.user);
  }
}
