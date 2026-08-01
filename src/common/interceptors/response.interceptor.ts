import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Paginated<T> {
  items: T[];
  meta: { page: number; limit: number; total: number };
}

function isPaginated(value: unknown): value is Paginated<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    Array.isArray((value as Paginated<unknown>).items) &&
    typeof (value as Paginated<unknown>).meta === 'object'
  );
}

/**
 * Wraps every controller return value in the envelope boafie-web's
 * lib/api/client.ts already expects: { success: true, data, meta? }.
 * A handler returns { items, meta } to populate `meta` (paginated list
 * endpoints); anything else becomes `data` as-is.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (isPaginated(value)) {
          return { success: true, data: value.items, meta: value.meta };
        }
        return { success: true, data: value ?? null };
      }),
    );
  }
}
