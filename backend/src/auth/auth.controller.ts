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
import { AuthService } from '@/auth/auth.service';
import { RegisterDto, LoginDto } from '@/auth/dto';
import { LocalAuthGuard, JwtAuthGuard } from '@/auth/guards';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Créer un nouveau compte' })
  @ApiResponse({ status: 201, description: 'Compte créé, retourne un accessToken' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Se connecter' })
  @ApiResponse({ status: 200, description: 'Connexion réussie, retourne un accessToken' })
  @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
  login(@Request() req, @Body() _dto: LoginDto) {
    // _dto n'est pas utilisé directement : Passport extrait les credentials
    // via LocalAuthGuard et les injecte dans req.user
    return this.authService.login(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Récupérer le profil connecté' })
  @ApiResponse({ status: 200, description: 'Profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 401, description: 'Token manquant ou invalide' })
  getProfile(@Request() req) {
    return req.user;
  }
}