import TConvertRsp from '../types/ConvertRsp';
import TConvertErr from '../types/ConvertErr';

export default interface ICurrencyConverter {
  convert(amount: number, fromCurrency: string, toCurrency: string): Promise<TConvertRsp | TConvertErr>;
}
