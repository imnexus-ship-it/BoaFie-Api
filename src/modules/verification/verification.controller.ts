import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { VerificationService } from './verification.service';
import {
  SubmitIdDto,
  SubmitSelfieDto,
  SubmitLocationDto,
  SubmitTradeCertDto,
  SendPhoneOtpDto,
  ConfirmPhoneOtpDto,
} from './dto/verification.dto';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('status')
  getStatus(@CurrentUser() user: RequestUser) {
    return this.verificationService.getStatus(user.id);
  }

  @Post('phone/send')
  async sendPhoneOtp(@Body() dto: SendPhoneOtpDto) {
    await this.verificationService.sendPhoneOtp(dto.phone);
    return { sent: true };
  }

  @Post('phone/confirm')
  confirmPhoneOtp(@CurrentUser() user: RequestUser, @Body() dto: ConfirmPhoneOtpDto) {
    return this.verificationService.confirmPhoneOtp(user.id, dto.phone, dto.code);
  }

  @Post('id')
  submitId(@CurrentUser() user: RequestUser, @Body() dto: SubmitIdDto) {
    return this.verificationService.submitId(user.id, dto);
  }

  @Post('selfie')
  submitSelfie(@CurrentUser() user: RequestUser, @Body() dto: SubmitSelfieDto) {
    return this.verificationService.submitSelfie(user.id, dto.selfie_url);
  }

  @Post('location')
  submitLocation(@CurrentUser() user: RequestUser, @Body() dto: SubmitLocationDto) {
    return this.verificationService.submitLocation(user.id, dto);
  }

  @Post('trade-cert')
  submitTradeCert(@CurrentUser() user: RequestUser, @Body() dto: SubmitTradeCertDto) {
    return this.verificationService.submitTradeCert(user.id, dto.trade_cert_url);
  }
}
