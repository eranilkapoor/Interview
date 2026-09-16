# Express Routing, Middleware, and Error Handling

Routing, middleware, and error handling are the heart of Express. Middleware functions receive `req`, `res`, and `next`; they can modify the request, end the response, or pass control to the next middleware. Route handlers are middleware attached to specific HTTP methods and paths.

Middleware order matters. Authentication must run before protected route handlers. JSON parsing must run before routes that read `req.body`. Error middleware must be registered after normal routes. This order-based pipeline is simple but can cause subtle bugs when routes grow.

Error handling is especially important in interviews because it reveals whether you understand production API behavior. Good Express services return consistent errors, hide internal details, log enough context, handle async failures, and avoid crashing the process for normal request-level errors.

## Examples

~~~js
import express from 'express';

const app = express();

function requestLogger(req, res, next) {
  console.log(`${req.method} ${req.url}`);
  next();
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  req.user = { id: 'u1', role: 'admin' };
  next();
}

app.use(requestLogger);
app.get('/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});
~~~

This example shows global middleware (`requestLogger`) and route-specific middleware (`requireAuth`).

~~~js
import { Router } from 'express';

const router = Router();

router.get('/', listProducts);
router.post('/', createProduct);
router.get('/:id', getProductById);
router.patch('/:id', updateProduct);
router.delete('/:id', deleteProduct);

export default router;
~~~

This shows a clean router file. In large projects, routers should delegate to controllers instead of containing all business logic inline.

~~~js
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

app.get('/products/:id', async (req, res, next) => {
  try {
    const product = await productService.findById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
  });
});
~~~

This demonstrates custom application errors and centralized error responses.

## Common Pitfalls / Gotchas

- Calling `next()` after sending a response, which can trigger "headers already sent" bugs.
- Forgetting to return after `res.status(...).json(...)` inside conditional branches.
- Placing error middleware before routes, so it never catches route errors.
- Not wrapping async handlers or not using an async-error helper.
- Mixing business logic, database access, and HTTP response formatting in route files.
- Applying authentication middleware globally when some routes should be public.
- Not limiting request body size, which can expose APIs to memory abuse.

## Interview Questions & Answers

**Q: What is middleware in Express?**  
A: Middleware is a function that runs during the request-response cycle. It can inspect or modify `req` and `res`, end the response, or call `next()` to continue.

**Q: Why does middleware order matter?**  
A: Express runs middleware in registration order. If body parsing, authentication, CORS, or error middleware are registered in the wrong place, routes may receive missing data, skip security checks, or fail to handle errors.

**Q: How do you handle async errors in Express?**  
A: Use `try/catch` inside async handlers and call `next(error)`, or use a wrapper function/helper that catches rejected promises and forwards them to error middleware.

**Q: What is error-handling middleware?**  
A: Middleware with four parameters: `(err, req, res, next)`. Express calls it when `next(error)` is used or a synchronous route throws.

**Q: How do you design consistent API error responses?**  
A: Define a common error shape with fields like `message`, `code`, `details`, and `requestId`; map known errors to correct HTTP status codes; log internal details server-side; and avoid leaking stack traces to clients.

## Related Topics

- [express-js-framework.md](./express-js-framework.md)
- [error-handlings.md](./error-handlings.md)
- [http.md](./http.md)
- [security.md](./security.md)
- [unit-tests.md](./unit-tests.md)

