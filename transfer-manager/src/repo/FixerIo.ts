import axios, { AxiosInstance, AxiosResponse } from 'axios';

import Logger from '../utils/Logger';

import ICurrencyConverter from '../interfaces/CurrencyConverter';

import TConvertRsp from '../types/ConvertRsp';
import TConvertErr from '../types/ConvertErr';
import TCurrency from '../types/Currency';

type TFixerRsp = {
  success: boolean;
  timestamp: number;
  base: string;
  historical: string;
  date: string;
  rates: { [x: string]: number; }
  error?: {
    code: number;
    type: string;
  };
};

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

export default class FixerIo implements ICurrencyConverter {
  private axiosFixerIo: AxiosInstance;

  private logger: Logger;

  constructor() {
    this.axiosFixerIo = axios.create({
      baseURL: 'http://data.fixer.io/api/',
      timeout: 10000,
      responseType: 'json',
      maxRedirects: 0,
    });

    this.logger = new Logger('FixerIo');
  }

  async convert(amount: number, fromCurrency: TCurrency, toCurrency: TCurrency): Promise<TConvertRsp | TConvertErr> {
    if (amount <= 0) {
      return {
        success: false,
        message: 'amount parameter have to be higher than 0',
      };
    }

    let fixerRsp: AxiosResponse<TFixerRsp>;
    const url = `/latest?access_key=${process.env.FIXER_KEY}&base=${fromCurrency}&symbols=${toCurrency}`;

    this.logger.debug('convert', `Requesting ${url} ...`);

    try {
      fixerRsp = await this.axiosFixerIo.get(url);
    } catch (error) {
      this.logger.error('convert', error.message);
      throw error;
    }

    if (!fixerRsp.data.success) {
      const err = new Error(`${fixerRsp.data.error.type} - ${FIXER_ERR[fixerRsp.data.error.code]}`);

      this.logger.error('convert', err.message);

      return {
        success: false,
        message: err.message,
      };
    }

    const ratio = 1 / fixerRsp.data.rates[toCurrency];
    const converted = amount * ratio;

    this.logger.info('convert', `Convertion for ${amount} ${fromCurrency} to ${toCurrency} is ${ratio} and give ${converted} ${toCurrency}`);

    return {
      success: true,
      base: fromCurrency,
      target: toCurrency,
      ratio,
      amount,
      converted,
    };
  }
}
