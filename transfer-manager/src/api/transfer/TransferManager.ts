/* eslint-disable no-underscore-dangle */
import axios, { AxiosInstance, AxiosResponse } from 'axios';

import {
  ICheckRsp,
  IPrepareRsp,
  IWallet,
  IFixerRsp,
  IDoTransferRsp,
} from '../../utils/interfaces';

import Logger from '../../utils/Logger';

const FIXER_ERR = {
  404: 'The requested resource does not exist.',
  101: 'No API Key was specified or an invalid API Key was specified.',
  103: 'The requested API endpoint does not exist.',
  104: 'The maximum allowed API amount of monthly API requests has been reached.',
  105: 'The current subscription plan does not support this API endpoint.',
  106: 'The current request did not return any results.',
  102: 'The account this API request is coming from is inactive.',
  201: 'An invalid base currency has been entered.',
  202: 'One or more invalid symbols have been specified.',
  301: 'No date has been specified.',
  302: 'An invalid date has been specified.',
  403: 'No or an invalid amount has been specified.',
  501: 'No or an invalid timeframe has been specified.',
  502: 'No or an invalid "start_date" has been specified.',
  503: 'No or an invalid "end_date" has been specified.',
  504: 'An invalid timeframe has been specified.',
  505: 'The specified timeframe is too long, exceeding 365 days.',
};

export default class TransferManager {
  private axiosDbManager: AxiosInstance;

  private axiosFixerIo: AxiosInstance;

  private logger: Logger;

  private fee: number;

  constructor() {
    this.fee = parseFloat(process.env.FEE);
    if (!this.fee) throw new Error('Fee have to be defined and be a number');

    this.axiosDbManager = axios.create({
      baseURL: 'http://db-manager-srv:9999/api/',
      timeout: 10000,
      responseType: 'json',
      maxRedirects: 0,
    });

    this.axiosFixerIo = axios.create({
      baseURL: 'http://data.fixer.io/api/',
      timeout: 10000,
      responseType: 'json',
      maxRedirects: 0,
    });

    this.logger = new Logger('TransferManager');
  }

  private async getMasterWallet(currency: string): Promise<IWallet> {
    this.logger.debug('getMasterWallet', `Requesting for master wallet with currency ${currency}`);

    let masterWallet: AxiosResponse<IWallet>;

    try {
      masterWallet = await this.axiosDbManager.get<IWallet>(`/wallet/master?currency=${currency}`);
    } catch (error) {
      this.logger.error('getMasterWallet', error.message);
      throw error;
    }

    this.logger.debug('getMasterWallet', `Master wallet with currency ${currency} retrieved: ${masterWallet.data[0]._id}`);

    return masterWallet.data[0];
  }

  async check(from: string, to: string, amount: number): Promise<ICheckRsp> {
    this.logger.debug('check', `Check from wallet ${from}, to wallet ${to} and amount ${amount}`);

    let fromWallet: AxiosResponse<IWallet>;
    let toWallet: AxiosResponse<IWallet>;

    try {
      [
        fromWallet,
        toWallet,
      ] = await Promise.all([
        this.axiosDbManager.get<IWallet>(`/wallet?id=${from}`),
        this.axiosDbManager.get<IWallet>(`/wallet?id=${to}`),
      ]);
    } catch (error) {
      this.logger.error('check', error.message);

      return {
        checked: false,
        reason: `Waller "${from}" or wallet "${to}" does not exists`,
      };
    }

    if (!fromWallet.data) {
      return {
        checked: false,
        reason: `Wallet ${fromWallet} does not exists`,
      };
    }

    if (!toWallet.data) {
      return {
        checked: false,
        reason: `Wallet ${toWallet} does not exists`,
      };
    }

    if (fromWallet.data.amount < amount) {
      return {
        checked: false,
        reason: `Insufisant found on the wallet "${from}"`,
      };
    }

    return {
      checked: true,
      fromWallet: fromWallet.data,
      toWallet: toWallet.data,
    };
  }

  async convert(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    let fixerRsp: AxiosResponse<IFixerRsp>;

    const url = `/latest?access_key=${process.env.FIXER_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;

    this.logger.debug('convert', `Requesting ${url} ...`);

    try {
      fixerRsp = await this.axiosFixerIo.get<IFixerRsp>(url);
    } catch (error) {
      this.logger.error('convert', error.message);
      throw error;
    }

    if (!fixerRsp.data.success) {
      const err = new Error(`${fixerRsp.data.error.type} - ${FIXER_ERR[fixerRsp.data.error.code]}`);
      this.logger.error('convert', err.message);
      throw err;
    }

    const ratio = 1 / fixerRsp.data.rates[toCurrency];
    const converted = amount * ratio;

    this.logger.debug('convert', `Convertion for ${amount} ${fromCurrency} to ${toCurrency} is ${ratio} and give ${converted} ${toCurrency}`);

    return converted;
  }

  computeFee(amount: number): number {
    this.logger.debug('computeFee', `Computing fee of ${amount}`);

    return parseFloat((amount * (this.fee / 100)).toFixed(2));
  }

  async cancelTransfer(amount: number, fromWallet: IWallet, tmpWallet: IWallet): Promise<void> {
    await Promise.all([
      this.deleteTmpWallet(tmpWallet._id),

      // Restore amount of From Wallet
      this.axiosDbManager.put<IWallet>('/wallet', {
        id: fromWallet._id,
        data: {
          amount: fromWallet.amount + amount,
        },
      }),
    ]);
  }

  async prepareTransfer(fromWallet: IWallet, amount: number): Promise<IPrepareRsp> {
    this.logger.debug('prepareTransfer', `Preparing transfer from wallet ${fromWallet._id} from amount ${amount}`);

    // ======================================================================
    // 1- CREATING TMP WALLET
    // ======================================================================
    let tmpWallet: AxiosResponse<IWallet[]>;

    try {
      tmpWallet = await this.axiosDbManager.post<IWallet[]>('/wallet', [{
        amount,
        currency: fromWallet.currency,
        companyId: 'tmp',
      }]);
    } catch (error) {
      this.logger.error('prepareTransfer', error.message);
      throw error;
    }

    if (!tmpWallet || tmpWallet.data.length === 0) {
      const err = new Error('Cannot create tmp wallet');
      this.logger.error('prepareTransfer', err.message);
      throw err;
    }

    this.logger.info('prepareTransfer', `Temporary wallet created: ${tmpWallet.data[0]._id}`);

    // ======================================================================
    // 2- UPDATING FROM WALLET
    // ======================================================================
    let updatedFromWallet: AxiosResponse<IWallet>;

    this.logger.debug('prepareTransfer', `Updating from wallet ${fromWallet._id} to substract ${amount}`);

    try {
      updatedFromWallet = await this.axiosDbManager.put<IWallet>('/wallet', {
        id: fromWallet._id,
        data: {
          amount: fromWallet.amount - amount,
        },
      });
    } catch (error) {
      this.logger.error('prepareTransfer', error.message);
      throw error;
    }

    if (!updatedFromWallet || Object.keys(updatedFromWallet.data).length === 0) {
      const err = new Error('Cannot update from wallet');
      this.logger.error('prepareTransfer', err.message);
      throw err;
    }

    this.logger.info('prepareTransfer', `From wallet updated with new amount: ${updatedFromWallet.data.amount}`);

    return {
      updatedFromWallet: updatedFromWallet.data,
      tmpWallet: tmpWallet.data[0],
    };
  }

  async doTransfer(tmpWallet: IWallet, toWallet: IWallet, initialAmount: number, convertedAmount?: number, fee?: number): Promise<IDoTransferRsp> {
    if (tmpWallet.companyId !== 'tmp') {
      const err = new Error('Tmp wallet have to be owned by "tmp" company');
      this.logger.error('doTransfer', err.message);
      throw err;
    }

    this.logger.debug('doTransfer', `Transfering ${initialAmount} ${tmpWallet.currency} from temporary wallet ${tmpWallet._id} to wallet ${toWallet._id}.${convertedAmount && fee ? ` Recipient wallet will recieved ${convertedAmount} ${toWallet.currency}, ${fee} ${toWallet.currency} will be collected` : ''}`);

    const promises = [
      this.axiosDbManager.put<IWallet>('/wallet', {
        id: tmpWallet._id,
        data: {
          amount: tmpWallet.amount - initialAmount,
        },
      }),
      this.axiosDbManager.put<IWallet>('/wallet', {
        id: toWallet._id,
        data: {
          amount: toWallet.amount + (convertedAmount || initialAmount),
        },
      }),
    ];

    if (fee) {
      let masterWallet: IWallet;
      try {
        masterWallet = await this.getMasterWallet(toWallet.currency);
      } catch (error) {
        this.logger.error('doTransfer', error.message);
        throw error;
      }

      promises.push(this.axiosDbManager.put<IWallet>('/wallet', {
        id: masterWallet._id,
        data: {
          amount: masterWallet.amount + fee,
        },
      }));
    }

    let updatedWallets: AxiosResponse<IWallet>[];
    try {
      updatedWallets = await Promise.all(promises);
    } catch (error) {
      this.logger.error('doTransfer', error.message);
      throw error;
    }

    return {
      tmpWallet: updatedWallets[0].data,
      toWallet: updatedWallets[1].data,
    };
  }

  async deleteTmpWallet(id: string): Promise<boolean> {
    let rsp: AxiosResponse<{ deleted: boolean }>;

    try {
      rsp = await this.axiosDbManager.delete(`/wallet?id=${id}`);
    } catch (error) {
      this.logger.error('deleteTmpWallet', error.message);
      throw error;
    }

    return rsp.data.deleted;
  }
}
