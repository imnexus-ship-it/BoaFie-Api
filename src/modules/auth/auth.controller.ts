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

  /**
   * Kicks off the redirect flow. Web navigates the whole page here directly;
   * the mobile app opens it inside an in-app browser session
   * (expo-web-browser's openAuthSessionAsync) and passes `platform=app` so
   * the callback below knows to hand back to the app instead of the website.
   */
  @Public()
  @Get('yahoo')
  startYahoo(
    @Query('role') role: string | undefined,
    @Query('platform') platform: string | undefined,
    @Res() res: Response,
  ) {
    res.redirect(this.authService.getYahooAuthUrl(role, platform));
  }

  @Public()
  @Get('yahoo/callback')
  async yahooCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const { role, platform } = this.authService.parseYahooState(state);
    const successBase = platform === 'app' ? this.app.mobileAuthCallbackUrl : `${this.app.frontendUrl}/auth/callback`;
    const errorBase = platform === 'app' ? this.app.mobileAuthCallbackUrl : `${this.app.frontendUrl}/login`;

    if (error || !code) {
      res.redirect(`${errorBase}?oauth_error=yahoo`);
      return;
    }
    try {
      const handoff = await this.authService.handleYahooCallback(code, role);
      res.redirect(`${successBase}?handoff=${handoff}`);
    } catch {
      res.redirect(`${errorBase}?oauth_error=yahoo`);
    }
  }

  @Public()
  @Post('exchange')
  @HttpCode(200)
  exchange(@Body() dto: ExchangeDto) {
    return this.authService.exchangeHandoff(dto.handoff);
  }
}
