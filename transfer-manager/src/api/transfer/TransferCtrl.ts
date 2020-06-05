import { Router, Request, Response } from 'express';
import HTTPStatusCode from 'http-status-codes';

import Logger from '../../utils/Logger';
import TransferManager from './TransferManager';

import FixerIo from '../../repo/FixerIo';

import TDoTransferRsp from '../../types/DoTransferRsp';
import TDoTransferErr from '../../types/DoTransferErr';


/**
 * Transfer controller, aims to manage HTTP requests of /transfer API.
 */
class TransferCtrl {
  /**
   * Router instance of transfer controller.
   */
  public router: Router;

  /**
   * Logger instance of transfer controller.
   */
  private logger: Logger;

  private transferManager: TransferManager;

  constructor() {
    this.router = Router();
    this.logger = new Logger('TransferCtrl');
    this.transferManager = new TransferManager(new FixerIo());

    this.router.post('/', this.do.bind(this));
  }

  /**
   * Returns error.
   * @param {string} endpoint Endpoint came from.
   * @param {string} errorMessage Error message.
   * @param {number} code HTTP status code.
   * @param {Response} res Express response.
   * @returns {Response} Express response.
   */
  private returnError(endpoint: string, errorMessage: string, code: number, res: Response): Response {
    this.logger.error(endpoint, errorMessage);

    return res.status(code).json({
      message: errorMessage,
    });
  }

  async do(req: Request, res: Response): Promise<Response> {
    if (typeof req.body !== 'object') {
      return this.returnError('POST /transfer', 'Body must be an object', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.from !== 'string') {
      return this.returnError('POST /transfer', 'Body must contains "from" string field', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.to !== 'string') {
      return this.returnError('POST /transfer', 'Body must contains "to" string field', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.amount !== 'number') {
      return this.returnError('POST /transfer', 'Body must contains "amount" number field', HTTPStatusCode.BAD_REQUEST, res);
    }

    let transferResponse: TDoTransferRsp | TDoTransferErr;

    try {
      transferResponse = await this.transferManager.do(req.body.from, req.body.to, req.body.amount);
    } catch (error) {
      return this.returnError('POST /transfer', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    if (transferResponse.code !== 0) {
      if (transferResponse.code === 9) {
        return this.returnError('POST /transfer', transferResponse.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
      }

      return this.returnError('POST /transfer', transferResponse.message, HTTPStatusCode.BAD_REQUEST, res);
    }

    return res.json(transferResponse);
  }
}

const transferCtrl = new TransferCtrl();
module.exports = transferCtrl.router;
