import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import fs from 'fs';

import { capitalizeFirstLetter } from '../utils/tools';

import Logger from '../utils/Logger';
import ErrorHandler from '../utils/ErrorHandler';
import Db from './MongoDb';
import WalletManager from '../api/wallet/WalletManager';

config({
  path: `${__dirname}/../env/${process.env.NODE_ENV}.env`,
  encoding: 'utf8',
  debug: true,
});

/**
 * Server
 */
export default class Server {
  /**
   * Application instance of server
   */
  public app: Application;

  /**
   * Port of server
   */
  private port: Number;

  /**
   * Logger instance of server
   */
  private logger: Logger;

  /**
   * Wallet manager instance of server
   */
  private walletManager: WalletManager;

  constructor() {
    if (!process.env.PORT) {
      throw new Error('Port have to be defined into environment file');
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI have to be defined into environment file');
    }

    this.app = express();
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());

    this.port = parseInt(process.env.PORT, 10);

    this.logger = new Logger('server');
    this.walletManager = new WalletManager(new Db());
  }

  /**
   * Loads routes from API.
   */
  private loadRoutes(): void {
    let dirs: string[];

    // Read content of API directory
    try {
      dirs = fs.readdirSync(`${__dirname}/../api`);
    } catch (error) {
      this.logger.error('loadRoutes', error.message);
    }

    dirs.map((dir: string): string => {
      const path = `${__dirname}/../api/${dir}/${capitalizeFirstLetter(dir)}Ctrl.js`;

      if (!fs.existsSync(path)) throw new Error(`Controller ${path} does not exists !`);

      // eslint-disable-next-line
      this.app.use(`/api/${dir}`, require(path));

      this.logger.info('loadRoutes', `${dir} loaded`);

      return dir;
    });

    const errorHandler = new ErrorHandler();

    this.app.get('/api', (_: express.Request, res: express.Response) => res.status(200).json({ message: 'This is the root of the API' }));
    this.app.get('/', (_: express.Request, res: express.Response) => res.status(200).send({ message: 'May the force be with you' }));

    // Error middleware
    this.app.use(errorHandler.handleError);

    // Page not found middleware
    this.app.use((_: express.Request, res: express.Response) => res.status(404).json({ message: 'This page does not exists' }));

    this.logger.info('loadRoutes', 'Middlewares loaded');
  }

  /**
   * Runs server.
   */
  async run(): Promise<void> {
    this.loadRoutes();

    // =============================================================
    // SEED DB IF NECESSARY
    // =============================================================
    if (process.env.NODE_ENV !== 'production') {
      try {
        const wallets = await this.walletManager.getMaster();

        this.logger.debug('run', `${wallets.length} master wallet retrieved`);

        if (!wallets || wallets.length === 0) {
          await this.walletManager.seed(parseInt(process.env.NB_SEED, 10) || 10);
        }
      } catch (error) {
        this.logger.error('run', error.message);
        throw error;
      }
    }
    // =============================================================

    if (process.env.NODE_ENV !== 'test') {
      this.app.listen(this.port, (): void => {
        this.logger.info('run', `Server is running on port ${this.port}`);
      });
    }
  }
}
