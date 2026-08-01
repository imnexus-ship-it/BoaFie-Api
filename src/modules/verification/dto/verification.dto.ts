import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, MinLength } from 'class-validator';

export class SubmitIdDto {
  @IsString()
  id_type: string;

  @IsString()
  id_number: string;

  @IsString()
  id_front_url: string;

  @IsOptional()
  @IsString()
  id_back_url?: string;
}

export class SubmitSelfieDto {
  @IsString()
  selfie_url: string;
}

export class SubmitLocationDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  location_text?: string;
}

export class SubmitTradeCertDto {
  @IsString()
  trade_cert_url: string;
}

export class SendPhoneOtpDto {
  @IsString()
  phone: string;
}

export class ConfirmPhoneOtpDto {
  @IsString()
  phone: string;

  @IsString()
  @MinLength(4)
  code: string;
}

export class RejectVerificationDto {
  @IsString()
  reason: string;
}
