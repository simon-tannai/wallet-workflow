/* eslint-disable no-underscore-dangle */
import axios, { AxiosInstance, AxiosResponse } from 'axios';

import {
  ICheckRsp,
  IWallet,
  IFixerRsp,
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

  async doTransfer(fromWallet: IWallet, toWallet: IWallet, initialAmount: number, convertedAmount: number, fee: number) {
    let masterWallet: IWallet;
    try {
      masterWallet = await this.getMasterWallet(toWallet.currency);
    } catch (error) {
      this.logger.error('doTransfer', error.message);
      throw error;
    }

    console.log(`masterWallet: ${JSON.stringify(masterWallet, null, 2)}`);
    console.log(`fromWallet: ${JSON.stringify(fromWallet, null, 2)}`);
    console.log(`toWallet: ${JSON.stringify(toWallet, null, 2)}`);
    let updatedWallets;
    try {
      updatedWallets = await Promise.all([
        this.axiosDbManager.put('/wallet', {
          id: masterWallet._id,
          data: {
            amount: masterWallet.amount + fee,
          },
        }),
        this.axiosDbManager.put('/wallet', {
          id: fromWallet._id,
          data: {
            amount: fromWallet.amount - initialAmount,
          },
        }),
        this.axiosDbManager.put('/wallet', {
          id: toWallet._id,
          data: {
            amount: toWallet.amount + convertedAmount,
          },
        }),
      ]);
    } catch (error) {
      this.logger.error('doTransfer', error.message);
      throw error;
    }
    console.log(`updatedWallets: ${updatedWallets}`);
  }
}
