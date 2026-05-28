import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@generated/prisma/client';
import { AuthService } from '@/auth/auth.service';
import { RegisterDto, LoginDto } from '@/auth/dto';
import { LocalAuthGuard, JwtAuthGuard, RolesGuard } from '@/auth/guards';
import { CurrentUser, Roles } from '@/auth/decorators';
import { AuthenticatedUser } from '@/auth/strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer un nouveau compte (ADMIN uniquement)' })
  @ApiResponse({ status: 201, description: 'Compte créé, retourne un accessToken' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  @ApiResponse({ status: 403, description: 'Accès réservé aux administrateurs' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, retourne un accessToken' })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  login(@Request() req, @Body() _dto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil connecté' })
  @ApiResponse({ status: 200, description: 'Profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.id);
  }
}
