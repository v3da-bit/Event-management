import {
  Controller,
  Get,
  Injectable,
  Module,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel, MongooseModule } from "@nestjs/mongoose";
import { Model, Schema } from "mongoose";
import { Transform } from "class-transformer";
import { IsNumber, Max, Min } from "class-validator";
import { createHash, randomUUID } from "node:crypto";
import { JwtGuard } from "../auth/security";

class ReverseLocationQuery {
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() ? Number(value) : NaN,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Transform(({ value }) =>
    typeof value === "string" && value.trim() ? Number(value) : NaN,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

const cacheSchema = new Schema({
  _id: String,
  address: { type: String, default: null },
  expiresAt: { type: Date, index: { expires: 0 } },
});
const gateSchema = new Schema({ _id: String, owner: String, nextAt: Date });

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel("GeocodeCache") private cache: Model<any>,
    @InjectModel("GeocodeGate") private gate: Model<any>,
    private config: ConfigService,
  ) {}

  async reverse(
    lat: number,
    lng: number,
  ): Promise<{ address: string | null; retryAfterMs?: number }> {
    const fallback = { address: null };
    if (this.config.get("GEOCODING_ENABLED") === "false") return fallback;
    const base =
      this.config.get<string>("GEOCODING_BASE_URL") ||
      "https://nominatim.openstreetmap.org/";
    const url = new URL("reverse", base.endsWith("/") ? base : `${base}/`);
    url.search = new URLSearchParams({
      lat: lat.toFixed(5),
      lon: lng.toFixed(5),
      format: "jsonv2",
      "accept-language": "en",
      addressdetails: "0",
    }).toString();
    const key = createHash("sha256").update(url.href).digest("hex");
    const cached = await this.cache
      .findOne({ _id: key, expiresAt: { $gt: new Date() } })
      .lean<{ address: string | null }>();
    if (cached) return { address: cached.address };

    // A MongoDB lease coordinates all backend replicas using the same database.
    // Hold through the provider response, then allow a 1.1 second cooldown.
    const owner = randomUUID();
    try {
      await this.gate.findOneAndUpdate(
        { _id: "reverse", nextAt: { $lte: new Date() } },
        { $set: { owner, nextAt: new Date(Date.now() + 30000) } },
        { upsert: true, new: true },
      );
    } catch (error: any) {
      if (error.code === 11000) return { address: null, retryAfterMs: 1500 };
      throw error;
    }

    let cooldown = 1100;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": `EverAfter/1.0 (${this.config.getOrThrow("FRONTEND_URL")})`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
        redirect: "error",
      });
      if (!response.ok) {
        if (response.status === 429 || response.status === 403)
          cooldown = 60000;
        return fallback;
      }
      const result = (await response.json()) as { display_name?: unknown };
      const address =
        typeof result.display_name === "string"
          ? result.display_name.trim().slice(0, 300) || null
          : null;
      await this.cache.updateOne(
        { _id: key },
        {
          $set: {
            address,
            expiresAt: new Date(
              Date.now() + (address ? 30 * 86400000 : 3600000),
            ),
          },
        },
        { upsert: true },
      );
      return { address };
    } catch {
      return fallback;
    } finally {
      await this.gate.updateOne(
        { _id: "reverse", owner },
        { $set: { nextAt: new Date(Date.now() + cooldown) } },
      );
    }
  }
}

@Controller("locations")
@UseGuards(JwtGuard)
class LocationsController {
  constructor(private locations: LocationsService) {}
  @Get("reverse") reverse(@Query() query: ReverseLocationQuery) {
    return this.locations.reverse(query.lat, query.lng);
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "GeocodeCache", schema: cacheSchema },
      { name: "GeocodeGate", schema: gateSchema },
    ]),
  ],
  controllers: [LocationsController],
  providers: [LocationsService],
})
export class LocationsModule {}
