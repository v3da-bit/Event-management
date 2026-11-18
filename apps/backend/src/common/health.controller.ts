import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { SkipThrottle } from "@nestjs/throttler";
import { Connection } from "mongoose";

@Controller("health")
@SkipThrottle()
export class HealthController {
  constructor(@InjectConnection() private connection: Connection) {}

  @Get()
  async ready() {
    if (this.connection.readyState !== 1 || !this.connection.db) {
      throw new ServiceUnavailableException("Database unavailable");
    }
    try {
      await this.connection.db
        .admin()
        .command({ ping: 1 }, { timeoutMS: 2000 });
    } catch {
      throw new ServiceUnavailableException("Database unavailable");
    }
    return { status: "ok" };
  }
}
