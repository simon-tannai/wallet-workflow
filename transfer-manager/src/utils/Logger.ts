import * as winston from 'winston';
import 'winston-daily-rotate-file';

/**
 * Logger.
 */
export default class Logger {
  /**
   * Winston Logger instance.
   */
  private logger: winston.Logger;

  constructor(public loggerName: string) {
    if (!this.loggerName) throw new Error('loggerName parameter must be defined');

    this.initLogger();
  }

  /**
   * Inits logger.
   */
  private initLogger(): void {
    this.logger = winston.createLogger({
      level: 'debug',
      format: winston.format.json(),
      transports: [
        new winston.transports.DailyRotateFile({
          datePattern: 'DD-MM-YYYY',
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.DailyRotateFile({
          datePattern: 'DD-MM-YYYY',
          filename: 'logs/all.log',
          level: 'debug',
        }),
      ],
    });

    // If we're not in production then log to the `console`
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
      }));
    }
  }

  /**
   * Debugs logger.
   * @param from Method name where message comes from.
   * @param msg Log message.
   */
  public debug(from: string, msg: string): void {
    this.logger.debug(`[${this.loggerName}] {${from}}: ${msg}`);
  }

  /**
   * Infos logger.
   * @param from Method name where message comes from.
   * @param msg Log message.
   */
  public info(from: string, msg: string): void {
    this.logger.info(`[${this.loggerName}] {${from}}: ${msg}`);
  }

  /**
   * Warns logger
   * @param from Method name where message comes from.
   * @param msg Log message.
   */
  public warn(from: string, msg: string): void {
    this.logger.warn(`[${this.loggerName}] {${from}}: ${msg}`);
  }

  /**
   * Errors logger
   * @param from Method name where message comes from.
   * @param msg Log message.
   */
  public error(from: string, msg: string): void {
    this.logger.error(`[${this.loggerName}] {${from}}: ${msg}`);
  }
}
