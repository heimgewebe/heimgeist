import express, { Request, Response, Router, NextFunction, RequestHandler } from 'express';
import { Heimgeist, createHeimgeist } from '../core';
import { AnalysisRequest, ExplainRequest, ChronikEvent, EventType } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create the Heimgeist API router
 */
export function createApiRouter(heimgeist?: Heimgeist): Router {
  const router = Router();
  const instance = heimgeist || createHeimgeist();

  // Middleware to parse JSON
  router.use(express.json());

  /**
   * POST /heimgeist/analyse
   * Run an analysis based on the provided request
   */
  const analyseHandler: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const request: AnalysisRequest = {
        target: req.body.target,
        scope: req.body.scope,
        depth: req.body.depth || 'quick',
        focus: req.body.focus,
      };

      const result = await instance.analyse(request);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
  router.post('/analyse', analyseHandler);

  // Alias for British spelling
  router.post('/analyze', analyseHandler);

  /**
   * GET /heimgeist/status
   * Get current Heimgeist status
   */
  const statusHandler: RequestHandler = (_req: Request, res: Response): void => {
    const status = instance.getStatus();
    res.json(status);
  };
  router.get('/status', statusHandler);

  /**
   * POST /heimgeist/explain
   * Get explanation for an insight, action, or event
   */
  const explainHandler: RequestHandler = (req: Request, res: Response): void => {
    const request: ExplainRequest = {
      insightId: req.body.insightId,
      actionId: req.body.actionId,
      eventId: req.body.eventId,
    };

    const explanation = instance.explain(request);

    if (explanation) {
      res.json(explanation);
    } else {
      res.status(404).json({
        error: 'Not found',
        message: 'Could not find the requested insight, action, or event',
      });
    }
  };
  router.post('/explain', explainHandler);

  /**
   * GET /heimgeist/risk
   * Get current risk assessment
   */
  const riskHandler: RequestHandler = (_req: Request, res: Response): void => {
    const assessment = instance.getRiskAssessment();
    res.json(assessment);
  };
  router.get('/risk', riskHandler);

  /**
   * GET /heimgeist/insights
   * Get all current insights
   */
  const insightsHandler: RequestHandler = (_req: Request, res: Response): void => {
    const insights = instance.getInsights();
    res.json({ insights, count: insights.length });
  };
  router.get('/insights', insightsHandler);

  /**
   * GET /heimgeist/actions
   * Get all planned actions
   */
  const actionsHandler: RequestHandler = (_req: Request, res: Response): void => {
    const actions = instance.getPlannedActions();
    res.json({ actions, count: actions.length });
  };
  router.get('/actions', actionsHandler);

  /**
   * POST /heimgeist/actions/:id/approve
   * Approve a pending action
   */
  const approveHandler: RequestHandler = (req: Request, res: Response): void => {
    const success = instance.approveAction(req.params.id);
    if (success) {
      res.json({ success: true, message: 'Action approved' });
    } else {
      res.status(404).json({
        error: 'Not found or not pending',
        message: 'Could not approve the action',
      });
    }
  };
  router.post('/actions/:id/approve', approveHandler);

  /**
   * POST /heimgeist/actions/:id/reject
   * Reject a pending action
   */
  const rejectHandler: RequestHandler = (req: Request, res: Response): void => {
    const success = instance.rejectAction(req.params.id);
    if (success) {
      res.json({ success: true, message: 'Action rejected' });
    } else {
      res.status(404).json({
        error: 'Not found or not pending',
        message: 'Could not reject the action',
      });
    }
  };
  router.post('/actions/:id/reject', rejectHandler);

  /**
   * POST /heimgeist/events
   * Submit an event for processing
   */
  const eventsHandler: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({
          error: 'Invalid request',
          message: 'Request body must be a valid JSON object',
        });
        return;
      }

      const event: ChronikEvent = {
        id: req.body.id || uuidv4(),
        type: req.body.type || EventType.Custom,
        timestamp: req.body.timestamp ? new Date(req.body.timestamp) : new Date(),
        source: req.body.source || 'api',
        payload: req.body.payload || {},
        metadata: req.body.metadata,
      };

      const insights = await instance.processEvent(event);
      res.json({
        eventId: event.id,
        insights,
        insightsCount: insights.length,
      });
    } catch (error) {
      next(error);
    }
  };
  router.post('/events', eventsHandler);

  /**
   * GET /heimgeist/config
   * Get current configuration
   */
  const configHandler: RequestHandler = (_req: Request, res: Response): void => {
    const config = instance.getConfig();
    res.json(config);
  };
  router.get('/config', configHandler);

  /**
   * PATCH /heimgeist/config/autonomy
   * Update autonomy level
   */
  const autonomyHandler: RequestHandler = (req: Request, res: Response): void => {
    const level = parseInt(req.body.level, 10);
    if (isNaN(level) || level < 0 || level > 3) {
      res.status(400).json({
        error: 'Invalid level',
        message: 'Autonomy level must be between 0 and 3',
      });
      return;
    }

    instance.setAutonomyLevel(level);
    res.json({
      success: true,
      autonomyLevel: level,
      message: `Autonomy level set to ${level}`,
    });
  };
  router.patch('/config/autonomy', autonomyHandler);

  return router;
}

/**
 * Create a full Express application with the Heimgeist API
 */
export function createApp(heimgeist?: Heimgeist): express.Application {
  const app = express();
  const instance = heimgeist || createHeimgeist();

  // Mount the API router
  app.use('/heimgeist', createApiRouter(instance));

  // Health check endpoint
  const healthHandler: RequestHandler = (_req: Request, res: Response): void => {
    res.json({ status: 'ok', service: 'heimgeist' });
  };
  app.get('/health', healthHandler);

  // Root endpoint with info
  const rootHandler: RequestHandler = (_req: Request, res: Response): void => {
    res.json({
      name: 'Heimgeist',
      version: '1.0.0',
      description: 'System Self-Reflection Engine',
      endpoints: {
        status: 'GET /heimgeist/status',
        analyse: 'POST /heimgeist/analyse',
        explain: 'POST /heimgeist/explain',
        risk: 'GET /heimgeist/risk',
        insights: 'GET /heimgeist/insights',
        actions: 'GET /heimgeist/actions',
        events: 'POST /heimgeist/events',
        config: 'GET /heimgeist/config',
      },
    });
  };
  app.get('/', rootHandler);

  // Error handling middleware
  const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    console.error('[Heimgeist] Error:', err.message);
    // In production, don't expose internal error details
    const isDevelopment = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: 'Internal server error',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
    });
  };
  app.use(errorHandler);

  return app;
}

/**
 * Start the Heimgeist server
 */
export function startServer(
  port: number = 3000,
  heimgeist?: Heimgeist
): Promise<ReturnType<express.Application['listen']>> {
  return new Promise((resolve) => {
    const app = createApp(heimgeist);
    const server = app.listen(port, () => {
      console.log(`[Heimgeist] Server running at http://localhost:${port}`);
      console.log(`[Heimgeist] API available at http://localhost:${port}/heimgeist`);
      resolve(server);
    });
  });
}
