import { Document, Mongoose } from 'mongoose';
import faker from 'faker';
import { v4 as uuid } from 'uuid';

import Wallet, { IWallet } from '../../models/Wallet';
import Db from '../../Db';
import { chooseRandom } from '../../utils/tools';
import Logger from '../../utils/Logger';

const AVAILABLE_CURRENCIES = ['USD', 'GBP', 'EUR'];

export default class WalletManager {
  private db: Db;

  private Wallet = Wallet;

  private logger: Logger;

  constructor(db: Db) {
    this.db = db;

    this.logger = new Logger('WallerManager');
  }

  async seed(nb: number): Promise<Document[]> {
    this.logger.debug('seed', `Seeding ${nb} documents`);

    const fakeWallets: IWallet[] = [];
    for (let i = 0; i < nb; i += 1) {
      fakeWallets.push({
        amount: faker.finance.amount(),
        currency: chooseRandom(AVAILABLE_CURRENCIES),
        companyId: uuid(),
      });
    }

    const masterWallets: IWallet[] = AVAILABLE_CURRENCIES.map((currency) => ({
      currency,
      companyId: process.env.MASTER_COMPANY_ID,
      isMaster: true,
    }));

    let created: Document[];
    try {
      created = await this.create(fakeWallets.concat(masterWallets));
    } catch (error) {
      this.logger.error('seed', error.message);
      throw new Error(`seed: ${error.message}`);
    }

    this.logger.info('seed', 'Seed done');

    this.db.disconnect();

    return created;
  }

  async create(wallets: IWallet[]): Promise<Document[]> {
    if (!this.db.database) await this.db.connect();

    let created: Document[];

    try {
      created = await this.Wallet.insertMany(wallets);
    } catch (error) {
      this.logger.error('create', error.message);
      throw error;
    }

    this.logger.info('create', `${created.length} wallet created`);

    return created;
  }

  async get(id: string): Promise<Document> {
    if (!this.db.database) await this.db.connect();

    let w: Document;
    try {
      w = await this.Wallet.findOne({ _id: id }).select('-__v');
    } catch (error) {
      this.logger.error('get', error.message);
      throw error;
    }

    this.logger.info('get', `Wallet ${id} retrieved`);

    return w;
  }

  async getAll(): Promise<Document[]> {
    if (!this.db.database) await this.db.connect();

    let wallets: Document[];

    try {
      wallets = await this.Wallet.find({}).select('-__v');
    } catch (error) {
      this.logger.error('getAll', error.message);
      throw error;
    }

    this.logger.info('get', `${wallets.length} wallets retrieved`);

    return wallets;
  }

  async getMaster(currency?: string): Promise<Document[]> {
    if (!this.db.database) await this.db.connect();

    const options: { isMaster: boolean, currency?: string } = {
      isMaster: true,
    };

    if (currency) {
      options.currency = currency;
    }

    let wallets: Document[];

    try {
      wallets = await this.Wallet.find(options).select('-__v');
    } catch (error) {
      this.logger.error('getMaster', error.message);
      throw error;
    }

    this.logger.info('getMaster', `${wallets.length} master wallet retrieved`);

    return wallets;
  }

  async update(id: string, wallet: IWallet): Promise<Document> {
    if (!this.db.database) await this.db.connect();

    let updated: Document;

    try {
      updated = await this.Wallet.findOneAndUpdate({ _id: id }, { $set: wallet }, { new: true });
    } catch (error) {
      this.logger.error('update', error.message);
      throw error;
    }

    this.logger.info('update', `${id} wallet updated`);

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    let deleted: { ok?: number; n?: number; deletedCount?: number; };

    try {
      deleted = await this.Wallet.deleteOne({ _id: id });
    } catch (error) {
      this.logger.error('delete', error.message);
      throw error;
    }

    if (!deleted || deleted.deletedCount !== 1) {
      this.logger.error('delete', `Cannot delete ${id} wallet`);
      return false;
    }

    return true;
  }
}
