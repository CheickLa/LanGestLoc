import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { LocalStrategy, JwtStrategy } from '@/auth/strategies';
import { IdentityThrottlerGuard } from '@/auth/guards/identity-throttler.guard';

const SESSION_DURATION = '45d';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is not defined');
        }
        return {
          secret,
          signOptions: { expiresIn: SESSION_DURATION },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    // Garde globale : déclarée ici car elle a besoin du JwtService de ce module
    { provide: APP_GUARD, useClass: IdentityThrottlerGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
