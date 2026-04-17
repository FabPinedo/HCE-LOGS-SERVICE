import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Protege los endpoints HTTP de auditoría con una API key interna.
 * Configurar AUDIT_API_KEY en .env del logger.
 * Si la variable está vacía, el guard es permisivo (modo desarrollo).
 *
 * Uso desde otros microservicios:
 *   headers: { 'x-api-key': process.env.AUDIT_API_KEY }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey: string;

  constructor(cfg: ConfigService) {
    this.apiKey = cfg.get<string>('AUDIT_API_KEY', '');
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.apiKey) return true; // modo desarrollo: sin clave configurada
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-api-key'] as string | undefined;
    if (key !== this.apiKey) throw new UnauthorizedException('API key de auditoría inválida');
    return true;
  }
}
