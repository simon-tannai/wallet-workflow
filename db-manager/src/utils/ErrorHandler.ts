import * as HTTPStatus from 'http-status-codes';
import { Request, Response } from 'express';

import Logger from './Logger';

/**
 * Error handler.
 */
export default class ErrorHandler {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ErrorHandler');
  }

  /**
   * Handles error.
   * @param {Error} err Error handled.
   * @param {Request} _ Express request.
   * @param {Response} res Express response.
   * @param {Function} next Next callback.
   * @returns {Response} Express response.
   */
  handleError(err: Error, _: Request, res: Response, next: Function): Response {
    if (!err) {
      return next();
    }

    this.logger.error('handleError', err.message);

    return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal error',
    });
  }
}
