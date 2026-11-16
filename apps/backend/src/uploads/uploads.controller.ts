import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { JwtGuard } from "../auth/security";
@Controller("uploads")
@UseGuards(JwtGuard)
export class UploadsController {
  constructor(private config: ConfigService) {}
  @Post("image")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async image(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("Choose an image");
    const { fileTypeFromBuffer } = await import("file-type");
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
      throw new BadRequestException(
        "Only JPEG, PNG and WebP images are accepted",
      );
    if (!this.config.get("CLOUDINARY_API_KEY"))
      throw new ServiceUnavailableException(
        "Image uploads require Cloudinary configuration",
      );
    cloudinary.config({
      cloud_name: this.config.getOrThrow("CLOUDINARY_CLOUD_NAME"),
      api_key: this.config.getOrThrow("CLOUDINARY_API_KEY"),
      api_secret: this.config.getOrThrow("CLOUDINARY_API_SECRET"),
    });
    const result: any = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "everafter",
          resource_type: "image",
          allowed_formats: ["jpg", "png", "webp"],
          transformation: [{ width: 1800, height: 1200, crop: "limit" }],
        },
        (error, result) => (error ? reject(error) : resolve(result)),
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url };
  }
}
