# NestJS Framework

NestJS is a progressive Node.js framework for building scalable server-side applications. It is TypeScript-first and heavily inspired by Angular's architecture: modules, controllers, providers, dependency injection, decorators, guards, pipes, interceptors, and exception filters.

NestJS can run on Express by default or Fastify as an alternative HTTP adapter. This means NestJS is not a replacement for Node; it is a framework on top of Node that gives teams a structured application architecture. It is often preferred for enterprise APIs, microservices, GraphQL services, event-driven services, and projects where consistency and testability matter.

In interviews, NestJS questions usually test dependency injection, modules, providers, decorators, request lifecycle, validation pipes, guards, interceptors, exception filters, and how NestJS compares with Express. A strong answer should emphasize structure, testability, TypeScript, and clear separation of concerns.

## Examples

~~~ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('users')
export class UsersController {
  @Get(':id')
  findOne(@Param('id') id: string) {
    return { id, name: 'Asha' };
  }
}
~~~

This example shows a basic NestJS controller. Decorators map classes and methods to HTTP routes.

~~~ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  private readonly users = [{ id: '1', name: 'Asha' }];

  findById(id: string) {
    return this.users.find((user) => user.id === id);
  }
}
~~~

This service is a provider. Nest can inject it into controllers or other services using dependency injection.

~~~ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
~~~

This module groups related controllers and providers. Modules are the main way Nest organizes application features.

~~~ts
import { Body, Controller, Post } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';

class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;
}

@Controller('users')
export class UsersController {
  @Post()
  create(@Body() dto: CreateUserDto) {
    return { id: '1', ...dto };
  }
}
~~~

With Nest's global `ValidationPipe`, DTO classes can validate request bodies using decorators from `class-validator`.

## Common Pitfalls / Gotchas

- Treating NestJS like plain Express and putting all logic in controllers.
- Forgetting to register providers in the correct module.
- Creating circular module dependencies instead of redesigning boundaries or using `forwardRef` only when truly needed.
- Not enabling global validation, transformation, and whitelisting for DTOs.
- Confusing guards, pipes, interceptors, and filters; each has a different lifecycle role.
- Overusing decorators without understanding the underlying dependency injection and request lifecycle.
- Making modules too large instead of organizing around business capabilities.

## Interview Questions & Answers

**Q: What is NestJS?**  
A: NestJS is a TypeScript-first Node.js framework for building scalable backend applications. It provides an opinionated architecture with modules, controllers, providers, dependency injection, decorators, guards, pipes, interceptors, and filters.

**Q: How is NestJS different from Express?**  
A: Express is minimal and unopinionated. NestJS is opinionated and provides structure, dependency injection, decorators, modules, validation patterns, testing patterns, and support for multiple transports. Nest often uses Express underneath by default.

**Q: What is a module in NestJS?**  
A: A module groups related controllers, providers, and imports/exports. It defines a boundary for a feature or infrastructure concern.

**Q: What is a provider?**  
A: A provider is a class or value managed by Nest's dependency injection container. Services, repositories, factories, and clients are commonly providers.

**Q: Why is dependency injection useful in NestJS?**  
A: It decouples classes from concrete dependencies, improves testability, supports swapping implementations, and helps manage application-wide object creation consistently.

## Related Topics

- [express-js-framework.md](./express-js-framework.md)
- [http.md](./http.md)
- [unit-tests.md](./unit-tests.md)
- [security.md](./security.md)
- [typescript-with-javascript-interop.md](../TypeScript/typescript-with-javascript-interop.md)

