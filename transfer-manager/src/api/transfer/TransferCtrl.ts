import { Router, Request, Response } from 'express';
import HTTPStatusCode from 'http-status-codes';

import Logger from '../../utils/Logger';
import TransferManager from './TransferManager';

import { ICheckRsp } from '../../utils/interfaces';


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
    this.transferManager = new TransferManager();

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
    /**
     * check(from, to, amount)
     * updateAmoutWallet(from)
     * computeFee(amout, fromCurrency, toCurrency)
     * updateAmountWallet(to)
     * updateAmountWallet(master)
     * deleteWallet(tmp)
    */

    if (typeof req.body !== 'object') {
      return this.returnError('POST /tranfer', 'Body must be an object', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.from !== 'string') {
      return this.returnError('POST /tranfer', 'Body must contains "from" string field', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.to !== 'string') {
      return this.returnError('POST /tranfer', 'Body must contains "to" string field', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.amount !== 'number') {
      return this.returnError('POST /tranfer', 'Body must contains "amount" number field', HTTPStatusCode.BAD_REQUEST, res);
    }

    // ======================================================================
    // 1- CHECK IF ALL DATA ARE OK
    // ======================================================================
    let checkRsp: ICheckRsp;
    try {
      checkRsp = await this.transferManager.check(req.body.from, req.body.to, req.body.amount);
    } catch (error) {
      return this.returnError('POST /tranfer', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    if (!checkRsp.checked) {
      return this.returnError('POST /tranfer', checkRsp.reason, HTTPStatusCode.BAD_REQUEST, res);
    }

    // ======================================================================
    // 2- CONVERT CURRENCIES IF NECESSARY
    // ======================================================================
    let convertedAmount: number = req.body.amount;

    if (checkRsp.fromWallet.currency !== checkRsp.toWallet.currency) {
      try {
        convertedAmount = await this.transferManager.convert(req.body.amount, checkRsp.fromWallet.currency, checkRsp.toWallet.currency);
      } catch (error) {
        return this.returnError('POST /tranfer', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
      }
    }

    // ======================================================================
    // 3- COMPUTE FEES
    // ======================================================================
    const fee = this.transferManager.computeFee(convertedAmount);

    // ======================================================================
    // 5- UPDATE MASTER, FROM AND TO WALLETS
    // ======================================================================
    await this.transferManager.doTransfer(checkRsp.fromWallet, checkRsp.toWallet, req.body.amount, convertedAmount, fee);

    return res.send();
  }
}

const transferCtrl = new TransferCtrl();
module.exports = transferCtrl.router;
