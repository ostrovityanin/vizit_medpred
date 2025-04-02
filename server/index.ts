import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Произошла внутренняя ошибка сервера";

    res.status(status).json({ message });
    throw err;
  });

  // Эндпоинт для проверки здоровья сервера (health check)
  app.get('/health', (req: Request, res: Response) => {
    const startTime = Date.now();
    const status = {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB',
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
      },
      responseTime: Date.now() - startTime + 'ms'
    };
    res.json(status);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  const startTime = Date.now();
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    keepAliveTimeout: 65000
  }, () => {
    log(`Server started on port ${port} at ${new Date().toISOString()}`);
  });

  // Мониторинг состояния сервера
  setInterval(() => {
    const uptime = (Date.now() - startTime) / 1000;
    const memoryUsage = process.memoryUsage();
    log(`Server Status:
      Uptime: ${uptime}s
      Memory: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB
      Active: ${server.listening ? 'Yes' : 'No'}`, 
    'monitor');
    
    if (!server.listening) {
      log('WARNING: Server not listening! Attempting restart...', 'error');
      server.listen(port, "0.0.0.0");
    }
  }, 30000);

  // Расширенное логирование ошибок
  process.on('uncaughtException', (error) => {
    log(`CRITICAL ERROR - uncaughtException:
      Message: ${error.message}
      Stack: ${error.stack}
      Time: ${new Date().toISOString()}`, 
    'error');
  });

  process.on('unhandledRejection', (error: any) => {
    log(`CRITICAL ERROR - unhandledRejection:
      Message: ${error?.message || error}
      Stack: ${error?.stack || 'No stack trace'}
      Time: ${new Date().toISOString()}`, 
    'error');
  });

  // Мониторинг системных событий
  process.on('SIGTERM', () => {
    log('Received SIGTERM signal', 'system');
    server.close();
  });

  process.on('SIGINT', () => {
    log('Received SIGINT signal', 'system');
    server.close();
  });

  // Graceful shutdown
  const shutdown = () => {
    server.close(() => {
      log('Server shutting down gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
