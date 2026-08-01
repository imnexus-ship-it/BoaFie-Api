import { Body, Controller, Get, HttpCode, Inject, Post, Query, Res } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import appConfig from '../../config/app.config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto, LogoutDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { ExchangeDto } from './dto/exchange.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(@Body() dto: LogoutDto) {
    await this.authService.logout(dto.refresh_token);
    return { loggedOut: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.new_password);
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  loginWithGoogle(@Body() dto: GoogleAuthDto) {
    return this.authService.loginWithGoogle(dto.id_token, dto.role);
  }

  /** Kicks off the redirect flow — the frontend navigates the whole page here, it doesn't fetch() it. */
  @Public()
  @Get('yahoo')
  startYahoo(@Query('role') role: string | undefined, @Res() res: Response) {
    res.redirect(this.authService.getYahooAuthUrl(role));
  }

  @Public()
  @Get('yahoo/callback')
  async yahooCallback(
    @Query('code') code: string | undefined,
    @Query('state') role: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error || !code) {
      res.redirect(`${this.app.frontendUrl}/login?oauth_error=yahoo`);
      return;
    }
    try {
      const handoff = await this.authService.handleYahooCallback(code, role);
      res.redirect(`${this.app.frontendUrl}/auth/callback?handoff=${handoff}`);
    } catch {
      res.redirect(`${this.app.frontendUrl}/login?oauth_error=yahoo`);
    }
  }

  @Public()
  @Post('exchange')
  @HttpCode(200)
  exchange(@Body() dto: ExchangeDto) {
    return this.authService.exchangeHandoff(dto.handoff);
  }
}
