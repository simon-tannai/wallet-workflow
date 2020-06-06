import { Document } from 'mongoose';
import faker from 'faker';
import { v4 as uuid } from 'uuid';

import Wallet, { IWallet } from '../../models/Wallet';
import Db from '../../interfaces/Db';
import { chooseRandom } from '../../utils/tools';
import Logger from '../../utils/Logger';

const AVAILABLE_CURRENCIES = ['USD', 'GBP', 'EUR'];

/**
 * Wallet Manager.
 */
export default class WalletManager {
  /**
   * Db instace of wallet manager.
  */
  private db: Db;

  /**
   * Wallet model of wallet manager.
   */
  private Wallet = Wallet;

  /**
   * Logger instance of wallet manager
   */
  private logger: Logger;

  /**
   * Creates an instance of wallet manager.
   * @param {Db} db Database instance.
   */
  constructor(db: Db) {
    this.db = db;

    this.logger = new Logger('WallerManager');
  }

  /**
   * Seed databas.
   * @param {number} nb Number of data to seed.
   * @returns {Document[]} Returns list of created documents.
   */
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

  /**
   * Creates wallet.
   * @param {IWallet[]} wallets Collection of wallets.
   * @returns {Document[]} Returns created wallets.
   */
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

  /**
   * Get wallet.
   * @param {string} id ID of wallet to retrieved.
   * @returns {Document} Returns the wallet.
   */
  async get(id: string): Promise<Document> {
    if (!this.db.database) await this.db.connect();

    let wallet: Document;
    try {
      wallet = await this.Wallet.findOne({ _id: id }).select('-__v');
    } catch (error) {
      this.logger.error('get', error.message);
      throw error;
    }

    this.logger.info('get', `Wallet ${id} retrieved`);

    return wallet;
  }

  /**
   * Get all wallets.
   * @returns {Document[]} Collection of wallets.
   */
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

  /**
   * Get master wallet.
   * @param {string} [currency] Curency filter.
   * @returns {Document[]} Collection of master wallet.
   */
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

  /**
   * Update wallet.
   * @param {string} id ID of wallet to update.
   * @param {IWallet} wallet Data to update.
   * @returns {Document} Returns updated wallet.
   */
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

  /**
   * Delete wallet.
   * @param {String} id ID of the wallet to delete.
   * @returns {boolean} Returns true if deleted.
   */
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

    this.logger.info('delete', `${id} wallet deleted`);

    return true;
  }
}
