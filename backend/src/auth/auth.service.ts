import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@/prisma/prisma.service';
import { RegisterDto } from '@/auth/dto';
import { Prisma, Role } from '@generated/prisma/client';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          role: Role.USER,
        },
      });

      return this.buildTokenResponse(user.id, user.email, user.role);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Un compte avec cet email existe déjà');
      }
      throw error;
    }
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async login(user: { id: number; email: string; role: Role }) {
    return this.buildTokenResponse(user.id, user.email, user.role);
  }

  private buildTokenResponse(userId: number, email: string, role: Role) {
    const payload = { sub: userId, email, role };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}