import TWallet from './Wallet';

type TCheckRsp = {
  checked: boolean;
  reason?: string;
  fromWallet?: TWallet;
  toWallet?: TWallet;
};
export default TCheckRsp;
