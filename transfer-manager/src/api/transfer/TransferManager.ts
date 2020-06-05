import axios, { AxiosInstance, AxiosResponse } from 'axios';

import Logger from '../../utils/Logger';

import TWallet from '../../types/Wallet';
import TCheckRsp from '../../types/CheckRsp';
import TWalletsRsp from '../../types/WalletsRsp';
import TConvertRsp from '../../types/ConvertRsp';
import TConvertErr from '../../types/ConvertErr';
import TDoTransferRsp from '../../types/DoTransferRsp';
import TDoTransferErr from '../../types/DoTransferErr';

import ICurrencyConverter from '../../interfaces/CurrencyConverter';

export default class TransferManager {
  private axiosDbManager: AxiosInstance;

  private currencyConverter: ICurrencyConverter;

  private logger: Logger;

  private fee: number;

  constructor(currencyConverter: ICurrencyConverter) {
    this.fee = parseFloat(process.env.FEE);
    if (!this.fee) throw new Error('Fee have to be defined and be a number');

    this.axiosDbManager = axios.create({
      baseURL: 'http://db-manager-srv:9999/api/',
      timeout: 10000,
      responseType: 'json',
      maxRedirects: 0,
    });

    this.currencyConverter = currencyConverter;

    this.logger = new Logger('TransferManager');
  }

  private async getMasterWallet(currency: string): Promise<TWallet> {
    this.logger.debug('getMasterWallet', `Requesting for master wallet with currency ${currency}`);

    let masterWallet: AxiosResponse<TWallet>;

    try {
      masterWallet = await this.axiosDbManager.get<TWallet>(`/wallet/master?currency=${currency}`);
    } catch (error) {
      this.logger.error('getMasterWallet', error.message);
      throw error;
    }

    this.logger.debug('getMasterWallet', `Master wallet with currency ${currency} retrieved: ${masterWallet.data[0]._id}`);

    return masterWallet.data[0];
  }

  private async check(from: string, to: string, amount: number): Promise<TCheckRsp> {
    this.logger.debug('check', `Check from wallet ${from}, to wallet ${to} and amount ${amount}`);

    let fromWallet: AxiosResponse<TWallet>;
    let toWallet: AxiosResponse<TWallet>;

    try {
      [
        fromWallet,
        toWallet,
      ] = await Promise.all([
        this.axiosDbManager.get<TWallet>(`/wallet?id=${from}`),
        this.axiosDbManager.get<TWallet>(`/wallet?id=${to}`),
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

  private computeFee(amount: number): number {
    this.logger.debug('computeFee', `Computing fee of ${amount}`);

    return parseFloat((amount * (this.fee / 100)).toFixed(2));
  }

  private async cancelTransfer(amount: number, fromWallet: TWallet, tmpWallet: TWallet): Promise<void> {
    await Promise.all([
      this.deleteTmpWallet(tmpWallet._id),

      // Restore amount of From Wallet
      this.axiosDbManager.put<TWallet>('/wallet', {
        id: fromWallet._id,
        data: {
          amount: fromWallet.amount + amount,
        },
      }),
    ]);
  }

  private async prepareTransfer(fromWallet: TWallet, amount: number): Promise<TWalletsRsp> {
    this.logger.debug('prepareTransfer', `Preparing transfer from wallet ${fromWallet._id} from amount ${amount}`);

    // ======================================================================
    // 1- CREATING TMP WALLET
    // ======================================================================
    let tmpWallet: AxiosResponse<TWallet[]>;

    try {
      tmpWallet = await this.axiosDbManager.post<TWallet[]>('/wallet', [{
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
    let updatedFromWallet: AxiosResponse<TWallet>;

    this.logger.debug('prepareTransfer', `Updating from wallet ${fromWallet._id} to substract ${amount}`);

    try {
      updatedFromWallet = await this.axiosDbManager.put<TWallet>('/wallet', {
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

  private async transfer(tmpWallet: TWallet, toWallet: TWallet, initialAmount: number, convertedAmount?: number, fee?: number): Promise<TWalletsRsp> {
    if (tmpWallet.companyId !== 'tmp') {
      const err = new Error('Tmp wallet have to be owned by "tmp" company');
      this.logger.error('transfer', err.message);
      throw err;
    }

    this.logger.debug('transfer', `Transfering ${initialAmount} ${tmpWallet.currency} from temporary wallet ${tmpWallet._id} to wallet ${toWallet._id}.${convertedAmount && fee ? ` Recipient wallet will recieved ${convertedAmount} ${toWallet.currency}, ${fee} ${toWallet.currency} will be collected` : ''}`);

    const promises = [
      this.axiosDbManager.put<TWallet>('/wallet', {
        id: tmpWallet._id,
        data: {
          amount: tmpWallet.amount - initialAmount,
        },
      }),
      this.axiosDbManager.put<TWallet>('/wallet', {
        id: toWallet._id,
        data: {
          amount: toWallet.amount + (convertedAmount || initialAmount),
        },
      }),
    ];

    if (fee) {
      let masterWallet: TWallet;
      try {
        masterWallet = await this.getMasterWallet(toWallet.currency);
      } catch (error) {
        this.logger.error('transfer', error.message);
        throw error;
      }

      promises.push(this.axiosDbManager.put<TWallet>('/wallet', {
        id: masterWallet._id,
        data: {
          amount: masterWallet.amount + fee,
        },
      }));
    }

    let updatedWallets: AxiosResponse<TWallet>[];
    try {
      updatedWallets = await Promise.all(promises);
    } catch (error) {
      this.logger.error('transfer', error.message);
      throw error;
    }

    return {
      tmpWallet: updatedWallets[0].data,
      toWallet: updatedWallets[1].data,
    };
  }

  private async deleteTmpWallet(id: string): Promise<boolean> {
    let rsp: AxiosResponse<{ deleted: boolean }>;

    try {
      rsp = await this.axiosDbManager.delete(`/wallet?id=${id}`);
    } catch (error) {
      this.logger.error('deleteTmpWallet', error.message);
      throw error;
    }

    return rsp.data.deleted;
  }

  async do(fromWalletId: string, toWalletId: string, amount: number): Promise<TDoTransferRsp | TDoTransferErr> {
    let convertedAmount: number;
    let fee: number;

    // ======================================================================
    // 1- CHECK IF ALL DATA ARE OK
    // ======================================================================
    let checkRsp: TCheckRsp;

    try {
      checkRsp = await this.check(fromWalletId, toWalletId, amount);
    } catch (error) {
      return {
        message: error.message,
        code: 9,
      };
    }

    if (!checkRsp.checked) {
      return {
        message: checkRsp.reason,
        code: 1,
      };
    }

    // ======================================================================
    // 2- PREPARE TRANSFER - CREATE TMP WALLET & UPDATE FROM WALLET
    // ======================================================================
    let preparedTransfer: TWalletsRsp;

    try {
      preparedTransfer = await this.prepareTransfer(checkRsp.fromWallet, amount);
    } catch (error) {
      return {
        message: error.message,
        code: 9,
      };
    }

    // ======================================================================
    // 3- CONVERT CURRENCIES IF NECESSARY
    // ======================================================================
    if (checkRsp.fromWallet.currency !== checkRsp.toWallet.currency) {
      convertedAmount = amount;

      if (checkRsp.fromWallet.currency !== checkRsp.toWallet.currency) {
        let convertRsp: TConvertRsp | TConvertErr;

        try {
          convertRsp = await this.currencyConverter.convert(amount, checkRsp.fromWallet.currency, checkRsp.toWallet.currency);
        } catch (error) {
          this.logger.error('do', error.message);

          await this.cancelTransfer(amount, checkRsp.fromWallet, preparedTransfer.tmpWallet);

          return {
            message: error.message,
            code: 9,
          };
        }

        if (!convertRsp.success) {
          await this.cancelTransfer(amount, checkRsp.fromWallet, preparedTransfer.tmpWallet);

          return {
            message: convertRsp.message,
            code: 2,
          };
        }
      }

      // ======================================================================
      // 4- COMPUTE FEE
      // ======================================================================
      fee = this.computeFee(convertedAmount);
    }

    // ======================================================================
    // 5- UPDATE MASTER, FROM AND TO WALLETS
    // ======================================================================
    let transferRsp: TWalletsRsp;

    try {
      transferRsp = await this.transfer(preparedTransfer.tmpWallet, checkRsp.toWallet, amount, convertedAmount, fee);
    } catch (error) {
      await this.cancelTransfer(amount, checkRsp.fromWallet, preparedTransfer.tmpWallet);

      return {
        message: error.message,
        code: 9,
      };
    }

    // ======================================================================
    // 6- DELETE TMP WALLET
    // ======================================================================
    await this.deleteTmpWallet(preparedTransfer.tmpWallet._id);

    return {
      fromWallet: checkRsp.fromWallet,
      toWallet: transferRsp.toWallet,
      amount,
      convertedAmount,
      fee,
      code: 0,
      message: 'success',
    };
  }
}
