import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
  ValidateIf,
  IsISO8601,
  IsUrl,
  IsBoolean,
  Matches,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import { Type } from "class-transformer";
export class RegisterDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;
  @ApiProperty({ type: String, format: "email" })
  @IsEmail()
  @MaxLength(254)
  email: string;
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: "Password needs uppercase, lowercase and a number",
  })
  password: string;
  @ApiProperty({ enum: ["GROOM", "BRIDE"] }) @IsEnum(["GROOM", "BRIDE"]) team:
    "GROOM" | "BRIDE";
}
export class LoginDto {
  @ApiProperty({ type: String, format: "email" }) @IsEmail() email: string;
  @ApiProperty({ type: String }) @IsString() @MaxLength(128) password: string;
}
export class ProfileDto {
  @ValidateIf((_object, value) => value !== undefined)
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;
  @IsOptional()
  @ApiProperty({ type: String, format: "uri" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  profileImage?: string | null;
}
export class PasswordDto {
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(128)
  currentPassword: string;
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  newPassword: string;
}
export class EventDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  @Matches(/\S/)
  title: string;
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @Matches(/\S/)
  description: string;
  @ApiProperty({ type: String, format: "date-time" })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  startDate: string;
  @ApiProperty({ type: String, format: "date-time" })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  endDate: string;
  @ValidateIf((_object, value) => value !== undefined)
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(100)
  timezone?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(300)
  location?: string;
  @IsOptional()
  @ApiProperty({ type: String, format: "uri" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  coverImage?: string | null;
}
export class UpdateEventDto extends PartialType(EventDto, {
  skipNullProperties: false,
}) {}
export class WishlistDto {
  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/\S/)
  title: string;
  @ValidateIf((_object, value) => value !== undefined)
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(2000)
  description?: string;
  @IsOptional()
  @ApiProperty({ type: String, format: "uri" })
  @IsUrl({ protocols: ["https"], require_protocol: true })
  image?: string | null;
}
export class UpdateWishlistDto extends PartialType(WishlistDto, {
  skipNullProperties: false,
}) {}
export class ToggleDto {
  @ApiProperty({ type: Boolean }) @IsBoolean() isCompleted: boolean;
}
export class EventQuery {
  @IsOptional()
  @ApiProperty({ enum: ["GROOM", "BRIDE"] })
  @IsEnum(["GROOM", "BRIDE"])
  team?: string;
  @ValidateIf((_object, value) => value !== undefined)
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(100)
  search?: string;
  @IsOptional()
  @ApiProperty({ enum: ["upcoming", "past"] })
  @IsEnum(["upcoming", "past"])
  period?: string;
  @IsOptional()
  @ApiProperty({ type: String, format: "date-time" })
  @IsISO8601()
  from?: string;
  @IsOptional()
  @ApiProperty({ type: String, format: "date-time" })
  @IsISO8601()
  to?: string;
  @IsOptional()
  @ApiProperty({ type: Number, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;
  @IsOptional()
  @ApiProperty({ type: Number, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
