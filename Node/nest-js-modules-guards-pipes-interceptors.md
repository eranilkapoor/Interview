# NestJS Modules, Guards, Pipes, and Interceptors

NestJS has a clear request lifecycle. A request enters middleware, then guards decide whether it can proceed, interceptors can wrap execution, pipes transform or validate input, the controller handler runs, and exception filters handle errors. Understanding this lifecycle is a common senior NestJS interview topic.

Modules organize the application. Guards protect routes. Pipes validate and transform data. Interceptors handle cross-cutting behavior like logging, response mapping, timing, caching, or wrapping responses. Exception filters centralize error formatting.

These concepts help make NestJS applications maintainable at scale because authorization, validation, logging, and error handling do not need to be repeated in every controller.

## Examples

~~~ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    return request.user?.role === 'admin';
  }
}
~~~

This guard decides whether the request is allowed to continue. Guards are commonly used for authentication and authorization.

~~~ts
import { PipeTransform, BadRequestException } from '@nestjs/common';

export class ParsePositiveIntPipe implements PipeTransform {
  transform(value: string) {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException('Value must be a positive integer');
    }

    return parsed;
  }
}
~~~

This custom pipe validates and transforms a route parameter before it reaches the controller method.

~~~ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const request = context.switchToHttp().getRequest();
        console.log(`${request.method} ${request.url} ${Date.now() - startedAt}ms`);
      }),
    );
  }
}
~~~

This interceptor wraps route execution and logs request duration after the handler completes.

~~~ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      path: request.url,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
~~~

This exception filter creates a consistent HTTP error response.

## Common Pitfalls / Gotchas

- Using middleware for authorization when guards are the Nest-native fit.
- Putting validation logic inside controllers instead of DTOs and pipes.
- Using interceptors for business logic instead of cross-cutting concerns.
- Forgetting that guards run before pipes.
- Not understanding provider scope: singleton by default, request-scoped only when necessary.
- Overusing request-scoped providers, which can hurt performance.
- Creating circular dependencies between modules and services.
- Not writing unit tests for guards, pipes, and services separately.

## Interview Questions & Answers

**Q: What is the NestJS request lifecycle?**  
A: A request typically flows through middleware, guards, interceptors, pipes, controller handler, then interceptors again for response mapping, with exception filters handling thrown errors.

**Q: Guard vs middleware in NestJS?**  
A: Middleware runs earlier and is useful for low-level request processing. Guards are designed for authorization decisions and have access to route metadata through the execution context.

**Q: Pipe vs interceptor?**  
A: Pipes validate and transform input before it reaches the route handler. Interceptors wrap handler execution and can transform responses, log timings, implement caching, or add cross-cutting behavior.

**Q: What is an exception filter?**  
A: A class that catches exceptions and formats the response. It centralizes error response structure and can be applied globally, per controller, or per route.

**Q: How do you implement role-based authorization in NestJS?**  
A: Store role metadata with a custom decorator, read it in a guard using `Reflector`, inspect the authenticated user on the request, and allow or deny access based on required roles.

**Q: How do you validate request bodies in NestJS?**  
A: Define DTO classes with validation decorators, enable `ValidationPipe` globally, and use options like `whitelist`, `forbidNonWhitelisted`, and `transform` where appropriate.

## Related Topics

- [nest-js-framework.md](./nest-js-framework.md)
- [security.md](./security.md)
- [error-handlings.md](./error-handlings.md)
- [unit-tests.md](./unit-tests.md)
- [express-routing-middleware-error-handling.md](./express-routing-middleware-error-handling.md)

