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
    let masterWallet: AxiosResponse<IWallet>;

    try {
      masterWallet = await this.axiosDbManager.get<IWallet>(`/wallet/master?currency=${currency}`);
    } catch (error) {
      this.logger.error('getMasterWallet', error.message);
      throw error;
    }

    return masterWallet.data[0];
  }

  async check(from: string, to: string, amount: number): Promise<ICheckRsp> {
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

    const ratio = 1 / fixerRsp.data.rates[toCurrency];
    const converted = amount * ratio;

    this.logger.debug('convert', `Convertion for ${amount} ${fromCurrency} to ${toCurrency} is ${ratio} and give ${converted} ${toCurrency}`);

    return converted;
  }

  computeFee(amount: number): number {
    return parseFloat((amount * (this.fee / 100)).toFixed(2));
  }

  async prepareTransfer(fromWallet: IWallet, amount: number): Promise<IPrepareRsp> {
    // createTmpAccount
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

    // Update from account
    let updatedFromWallet: AxiosResponse<IWallet>;

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
      masterWallet: updatedWallets[2] ? updatedWallets[2].data : null,
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
