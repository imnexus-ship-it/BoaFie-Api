import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UploadsService {
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const cloudName = config.get<string>('app.cloudinaryCloudName');
    const apiKey = config.get<string>('app.cloudinaryApiKey');
    const apiSecret = config.get<string>('app.cloudinaryApiSecret');
    this.configured = !!(cloudName && apiKey && apiSecret);
    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    }
  }

  async uploadImage(file: Express.Multer.File | undefined): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('No file provided');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File is too large — max 5MB');
    }
    if (!this.configured) {
      throw new ServiceUnavailableException('File uploads are not configured on this server yet');
    }

    const url = await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'boafie', resource_type: 'image' },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve(result.secure_url);
        },
      );
      Readable.from(file.buffer).pipe(uploadStream);
    });

    return { url };
  }
}
