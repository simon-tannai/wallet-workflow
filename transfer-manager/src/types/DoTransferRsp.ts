import TWallet from './Wallet';

type TDoTransferRsp = {
  fromWallet: TWallet,
  toWallet: TWallet,
  amount: number,
  convertedAmount: number,
  fee: number,
  code: number,
  message: string,
};

export default TDoTransferRsp;
