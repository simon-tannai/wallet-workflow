export interface IWallet {
  _id: string;
  amount: number;
  currency: string;
  companyId: string;
  isMaster: boolean;
}

export interface ICheckRsp {
  checked: boolean;
  reason?: string;
  fromWallet?: IWallet;
  toWallet?: IWallet;
}

export interface IPrepareRsp {
  updatedFromWallet: IWallet;
  tmpWallet: IWallet;
}

interface IFixerRatesRsp {
  [x: string]: number
}

interface IFixerErr {
  code: number;
  type: string;
}

export interface IFixerRsp {
  success: boolean;
  timestamp: number;
  base: string;
  historical: string;
  date: string;
  rates: IFixerRatesRsp;
  error?: IFixerErr;
}

export interface IDoTransferRsp {
  tmpWallet: IWallet;
  toWallet: IWallet;
}
