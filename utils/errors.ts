// utils/errors.ts

/**
 * Base class for custom application errors.
 */
export class AppError extends Error {
  public readonly context?: any;

  constructor(message: string, context?: any) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a pipeline agent fails.
 */
export class PipelineError extends AppError {
  public readonly agent: string;

  constructor(message: string, agent: string, context?: any) {
    super(`[${agent}] ${message}`, context);
    this.agent = agent;
  }
}

/**
 * Error thrown when an API call fails.
 */
export class ApiError extends AppError {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number, context?: any) {
    super(message, context);
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when the AI service (Gemini) fails.
 */
export class AIError extends AppError {
  constructor(message: string, context?: any) {
    super(message, context);
  }
}
