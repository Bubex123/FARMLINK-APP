import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = { count: number; expiresAt: number };
type RequestLike = { ip?: string; path?: string; body?: { email?: unknown } };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private requests = 0;

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const path = request.path || '';
    const ip = request.ip || 'unknown';
    const now = Date.now();
    let key = `api:${ip}`;
    let limit = 120;
    let windowMs = 60_000;

    if (path.endsWith('/auth/login')) {
      const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : 'missing-email';
      key = `login:${ip}:${email}`;
      limit = 5;
      windowMs = 15 * 60_000;
    } else if (path.endsWith('/auth/register')) {
      key = `register:${ip}`;
      limit = 10;
      windowMs = 60 * 60_000;
    }

    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      bucket = { count: 0, expiresAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      const seconds = Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000));
      context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>().setHeader('Retry-After', String(seconds));
      throw new HttpException('Too many requests. Please wait and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    // Prune expired buckets periodically to keep the in-memory limiter bounded.
    if (++this.requests % 1000 === 0) {
      for (const [bucketKey, value] of this.buckets) if (value.expiresAt <= now) this.buckets.delete(bucketKey);
    }
    return true;
  }
}
