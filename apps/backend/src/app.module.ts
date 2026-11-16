import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { OriginGuard } from "./auth/security";
import { DatabaseModule } from "./common/database.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { EventsModule } from "./events/events.module";
import { WishlistModule } from "./wishlist/wishlist.module";
import { GoogleCalendarModule } from "./google-calendar/calendar.module";
import { UploadsModule } from "./uploads/uploads.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/backend/.env"],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ uri: c.getOrThrow("MONGODB_URI") }),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    EventsModule,
    WishlistModule,
    GoogleCalendarModule,
    UploadsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
