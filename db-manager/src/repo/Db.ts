import Mongoose from 'mongoose';

import Logger from '../utils/Logger';
import Wallet from '../models/Wallet';

// @ts-ignore
Mongoose.Promise = Promise;

export default class Db {
  public database: Mongoose.Connection;

  private logger: Logger;

  public Wallet = Wallet;

  constructor() {
    this.logger = new Logger('Db');
  }

  async connect(): Promise<void> {
    if (this.database) {
      return;
    }

    await Mongoose.connect(process.env.MONGODB_URI, {
      autoReconnect: true,
      reconnectTries: 1000000,
      reconnectInterval: 3000,
    });

    this.database = Mongoose.connection;

    this.database.on('connected', () => {
      this.logger.info('connect', 'Connection Established');
    });

    this.database.on('reconnected', () => {
      this.logger.info('connect', 'Connection Reestablished');
    });

    this.database.on('disconnected', () => {
      this.logger.info('connect', 'Connection Disconnected');
    });

    this.database.on('close', () => {
      this.logger.info('connect', 'Connection Closed');
    });

    this.database.on('error', (error) => {
      this.logger.error('connect', `ERROR: ${error}`);
    });
  }

  disconnect() {
    return this.database.close();
  }
}
