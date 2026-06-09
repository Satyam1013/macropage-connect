import { Injectable, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IMAGE_TYPES, DOC_TYPES, AUDIO_TYPES } from "./upload.constants";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get("DO_SPACES_BUCKET", "macropage-media");
    this.endpoint = this.config.get(
      "DO_SPACES_ENDPOINT",
      "https://blr1.digitaloceanspaces.com",
    );

    this.s3 = new S3Client({
      region: this.config.get("DO_SPACES_REGION", "blr1"),
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.config.get("DO_SPACES_KEY", ""),
        secretAccessKey: this.config.get("DO_SPACES_SECRET", ""),
      },
    });
  }

  async uploadImage(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Only image files are allowed");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException("Image must be under 5MB");
    }

    const key = `media/${tenantId}/${randomUUID()}.${file.mimetype.split("/")[1]}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      }),
    );

    return { url: `${this.endpoint}/${this.bucket}/${key}` };
  }

  async uploadDocument(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!DOC_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Unsupported document type");
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new BadRequestException("Document must be under 20MB");
    }

    const ext = file.originalname.split(".").pop() ?? "bin";
    const key = `documents/${tenantId}/${randomUUID()}.${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 3600 },
    );
    return { url };
  }

  async uploadAudio(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    if (!AUDIO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Only audio files are allowed");
    }
    if (file.size > 16 * 1024 * 1024) {
      throw new BadRequestException("Audio must be under 16MB");
    }

    const ext = file.mimetype.split("/")[1];
    const key = `audio/${tenantId}/${randomUUID()}.${ext}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read",
      }),
    );

    return { url: `${this.endpoint}/${this.bucket}/${key}` };
  }

  async deleteFile(tenantId: string, key: string): Promise<void> {
    if (!key.startsWith(`${tenantId}/`)) {
      throw new BadRequestException("Invalid file key");
    }
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
