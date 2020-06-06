import { Router, Request, Response } from 'express';
import HTTPStatusCode from 'http-status-codes';
import { Document } from 'mongoose';

import Logger from '../../utils/Logger';
import MongoDb from '../../repo/MongoDb';
import WalletManager from './WalletManager';

/**
 * Wallet controller, aims to manage HTTP requests of /wallet API.
 */
class WalletCtrl {
  /**
   * Router instance of wallet controller.
   */
  public router: Router;

  /**
   * Logger instance of wallet controller.
   */
  private logger: Logger;

  /**
   * WalletManager instance of wallet ctrl
   */
  private walletManager: WalletManager;

  constructor() {
    this.router = Router();
    this.logger = new Logger('WalletCtrl');

    this.walletManager = new WalletManager(new MongoDb());

    this.router.post('/', this.createWallet.bind(this));
    this.router.get('/', this.getWallet.bind(this));
    this.router.get('/all', this.getAllWallet.bind(this));
    this.router.get('/master', this.getMasterWallet.bind(this));
    this.router.put('/', this.updateWallet.bind(this));
    this.router.delete('/', this.deleteWallet.bind(this));
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

  /**
   * Create wallet.
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async createWallet(req: Request, res: Response): Promise<Response> {
    if (!Array.isArray(req.body)) {
      return this.returnError('POST /wallet', 'Body must be an array of wallet', HTTPStatusCode.BAD_REQUEST, res);
    }

    let result: Document[];
    try {
      result = await this.walletManager.create(req.body);
    } catch (error) {
      return this.returnError('POST /wallet', error.message, HTTPStatusCode.BAD_REQUEST, res);
    }

    if (!result) {
      const err = new Error('Cannot create wallets');
      this.logger.info('POST /wallet', err.message);
      return this.returnError('POST /wallet', err.message, HTTPStatusCode.BAD_REQUEST, res);
    }

    this.logger.info('POST /wallet', `${result.length} wallet created`);

    return res.json(result);
  }

  /**
   * Get wallet.
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async getWallet(req: Request, res: Response): Promise<Response> {
    const {
      id,
    } = req.query;

    if (!id) {
      return this.returnError('GET /wallet', 'id parameter must be defined', HTTPStatusCode.BAD_REQUEST, res);
    }

    let result: Document;
    try {
      result = await this.walletManager.get(id as string);
    } catch (error) {
      return this.returnError('GET /wallet', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    if (!result) {
      const err = new Error(`Wallet ${id} does not exists`);
      this.logger.info('GET /wallet', err.message);
      return this.returnError('POST /wallet', err.message, HTTPStatusCode.BAD_REQUEST, res);
    }

    this.logger.info('GET /wallet', `Wallet ${result._id} retrieved`);

    return res.json(result);
  }

  /**
   * Get all wallet.
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async getAllWallet(req: Request, res: Response): Promise<Response> {
    let result: Document[];

    try {
      result = await this.walletManager.getAll();
    } catch (error) {
      return this.returnError('GET /wallet/all', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    this.logger.info('GET /wallet/all', `${result.length} wallets retrieved`);

    return res.json(result);
  }

  /**
   * Get all wallet.
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async getMasterWallet(req: Request, res: Response): Promise<Response> {
    const {
      currency,
    } = req.query;

    if (!['USD', 'EUR', 'GBP'].includes(currency as string)) {
      return this.returnError('GET /wallet/master', 'currency parameter must be USD, EUR or GBP', HTTPStatusCode.BAD_REQUEST, res);
    }

    let result: Document[];

    try {
      result = await this.walletManager.getMaster(typeof currency === 'string' ? currency : null);
    } catch (error) {
      return this.returnError('GET /wallet/master', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    this.logger.info('GET /wallet/master', `${result.length} wallets retrieved`);

    return res.json(result);
  }

  /**
   * Update a wallet.
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async updateWallet(req: Request, res: Response): Promise<Response> {
    if (typeof req.body !== 'object') {
      return this.returnError('PUT /wallet', 'Body must be an object, contains "id" and "data" fields', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.id !== 'string') {
      return this.returnError('PUT /wallet', 'Body must contains "id" string field', HTTPStatusCode.BAD_REQUEST, res);
    }
    if (typeof req.body.data !== 'object') {
      return this.returnError('PUT /wallet', 'Body must contains "data" object field', HTTPStatusCode.BAD_REQUEST, res);
    }

    let result: Document;

    try {
      result = await this.walletManager.update(req.body.id, req.body.data);
    } catch (error) {
      return this.returnError('PUT /wallet', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    if (!result) {
      const err = new Error('Cannot update wallet');
      this.logger.info('PUT /wallet', err.message);
      return this.returnError('PUT /wallet', err.message, HTTPStatusCode.BAD_REQUEST, res);
    }

    this.logger.info('PUT /wallet', `Wallet ${result._id} udpated`);

    return res.json(result);
  }

  /**
   * Deletes wallet
   * @param {Request} req Express request.
   * @param {Response} res Express response.
   * @returns {Response} Returns Express response.
   */
  async deleteWallet(req: Request, res: Response): Promise<Response> {
    const {
      id,
    } = req.query;

    if (!id) {
      return this.returnError('DELETE /wallet', 'Id parameter is requiered', HTTPStatusCode.BAD_REQUEST, res);
    }

    let deleted: boolean;
    try {
      deleted = await this.walletManager.delete(id as string);
    } catch (error) {
      return this.returnError('DELETE /wallet', error.message, HTTPStatusCode.INTERNAL_SERVER_ERROR, res);
    }

    this.logger.info('DELETE /wallet', `Wallet ${id} deleted`);

    return res.json({ deleted });
  }
}

const walletCtrl = new WalletCtrl();
module.exports = walletCtrl.router;
