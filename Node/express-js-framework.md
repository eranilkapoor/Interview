# Express.js Framework

Express.js is a minimal, unopinionated web framework for Node.js. It sits on top of Node's `http` module and gives you a simpler way to define routes, middleware, request parsing, responses, error handling, and API structure. Express is popular because it is small, flexible, and easy to integrate with databases, authentication libraries, validation libraries, logging tools, and custom architecture patterns.

In interviews, Express questions usually test whether you understand the request-response lifecycle, middleware order, routing, error handling, security, performance, and how Express differs from more opinionated frameworks like NestJS. A strong answer should explain that Express does not force a project structure; that freedom is useful for small services and custom architectures, but larger projects need conventions to avoid messy code.

Express is commonly used for REST APIs, backend-for-frontend services, webhook handlers, authentication services, and lightweight microservices. For production, you should discuss validation, centralized error handling, security middleware, request logging, rate limiting, graceful shutdown, and observability.

## Examples

~~~js
import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Asha' });
});

app.listen(3000, () => {
  console.log('API running on http://localhost:3000');
});
~~~

This example shows the basic Express flow: create an app, register middleware, define routes, and start listening.

~~~js
import express from 'express';

const app = express();
app.use(express.json());

const users = [];

app.post('/users', (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const user = { id: users.length + 1, name, email };
  users.push(user);

  res.status(201).json(user);
});
~~~

This demonstrates request body parsing, validation, status codes, and resource creation. In a real project, validation should usually be handled by a library such as Zod, Joi, Yup, or class-validator.

~~~js
import express from 'express';

const app = express();

app.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await findOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
~~~

This example shows the common Express pattern for async route errors: catch the error and pass it to `next(error)` so centralized error middleware can handle it.

## Common Pitfalls / Gotchas

- Registering middleware in the wrong order. Express executes middleware in the order it is added.
- Forgetting `express.json()`, causing `req.body` to be `undefined` for JSON requests.
- Handling errors inside every route instead of using centralized error middleware.
- Returning stack traces or internal error details to clients in production.
- Not validating input before using it in database queries or business logic.
- Blocking the event loop with CPU-heavy work inside route handlers.
- Assuming Express provides structure, dependency injection, validation, or security by default. Most of that must be added deliberately.
- Forgetting production security basics: CORS policy, Helmet, rate limiting, request size limits, authentication, authorization, and logging.

## Interview Questions & Answers

**Q: What is Express.js?**  
A: Express.js is a lightweight Node.js web framework used to build APIs and web applications. It simplifies routing, middleware, request parsing, responses, and error handling on top of Node's native HTTP module.

**Q: Why is Express called unopinionated?**  
A: It does not force a specific folder structure, architecture pattern, ORM, validation library, or dependency injection style. That flexibility is useful, but large teams must define their own conventions.

**Q: What is the request-response lifecycle in Express?**  
A: A request enters the Express app, passes through matching middleware in order, reaches a route handler if matched, and returns a response. If `next(error)` is called, Express skips normal middleware and runs error-handling middleware.

**Q: How do you structure a large Express project?**  
A: Common structure separates routes, controllers, services, repositories, validators, middleware, config, and error handling. Routes should be thin, controllers should handle HTTP concerns, services should contain business logic, and repositories should isolate persistence.

**Q: Express vs NestJS: when would you choose Express?**  
A: Choose Express for lightweight APIs, small services, custom architecture, quick prototypes, or teams that prefer flexibility. Choose NestJS when you want opinionated structure, TypeScript-first patterns, dependency injection, decorators, modules, and enterprise conventions.

## Related Topics

- [http.md](./http.md)
- [non-blocking.md](./non-blocking.md)
- [event-loop.md](./event-loop.md)
- [security.md](./security.md)
- [error-handlings.md](./error-handlings.md)
- [nest-js-framework.md](./nest-js-framework.md)

