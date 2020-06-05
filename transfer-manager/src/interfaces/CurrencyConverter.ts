import TConvertRsp from '../types/ConvertRsp';
import TConvertErr from '../types/ConvertErr';
import TCurrency from '../types/Currency';

export default interface ICurrencyConverter {
  convert(amount: number, fromCurrency: TCurrency, toCurrency: TCurrency): Promise<TConvertRsp | TConvertErr>;
}
