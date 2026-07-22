import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";
import { META_GRAPH_BASE } from "../meta/meta.constants";
import { MetaService } from "../meta/meta.service";
import { UploadService } from "../upload/upload.service";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "audio/ogg": "ogg",
  "audio/ogg; codecs=opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
};

// Downloads inbound WhatsApp media from Meta and re-uploads it into the
// existing DigitalOcean Spaces infrastructure (UploadService) so messages
// store a permanent URL instead of Meta's short-lived media link.
@Injectable()
export class MediaDownloadService {
  private readonly logger = new Logger(MediaDownloadService.name);

  constructor(
    private readonly metaService: MetaService,
    private readonly uploadService: UploadService,
  ) {}

  async downloadAndStore(
    tenantId: string,
    mediaId: string,
    mimeType: string,
    fileName?: string,
  ): Promise<string | null> {
    try {
      const accessToken = await this.metaService.getAccessToken(tenantId);

      const metaRes = await axios.get<{ url?: string }>(
        `${META_GRAPH_BASE}/${mediaId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      const downloadUrl = metaRes.data?.url;
      if (!downloadUrl) {
        this.logger.warn(`No download URL returned for media ${mediaId}`);
        return null;
      }

      const mediaRes = await axios.get<ArrayBuffer>(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const buffer = Buffer.from(mediaRes.data);
      const ext = EXTENSION_BY_MIME[mimeType] ?? "bin";
      const safeName = fileName ?? `whatsapp_${mediaId}_${Date.now()}.${ext}`;

      const multerFile: Express.Multer.File = {
        fieldname: "file",
        originalname: safeName,
        encoding: "7bit",
        mimetype: mimeType,
        buffer,
        size: buffer.length,
        destination: "",
        filename: safeName,
        path: "",
        stream: null as unknown as Express.Multer.File["stream"],
      };

      const { url } = await this.uploadService.uploadWhatsAppMedia(
        tenantId,
        multerFile,
      );
      return url;
    } catch (err) {
      // Never throw — media failure must not break the message save flow
      this.logger.error(
        `Media download/store failed for ${mediaId}`,
        err instanceof Error ? err.stack : err,
      );
      return null;
    }
  }
}
