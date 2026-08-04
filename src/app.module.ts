import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import oauthConfig from './config/oauth.config';
import { DatabaseModule } from './database/database.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { ArtisansModule } from './modules/artisans/artisans.module';
import { FreelancersModule } from './modules/freelancers/freelancers.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { VerificationModule } from './modules/verification/verification.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';
import { MatchingModule } from './modules/matching/matching.module';
import { BusinessModule } from './modules/business/business.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { ContactModule } from './modules/contact/contact.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, oauthConfig],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CategoriesModule,
    ArtisansModule,
    FreelancersModule,
    PortfolioModule,
    JobsModule,
    ProposalsModule,
    ContractsModule,
    WalletModule,
    VerificationModule,
    MessagingModule,
    AdminModule,
    HealthModule,
    AiModule,
    MatchingModule,
    BusinessModule,
    ReviewsModule,
    UploadsModule,
    ContactModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
