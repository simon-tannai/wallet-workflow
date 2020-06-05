import TCurrency from './Currency';

type TWallet = {
  _id: string;
  amount: number;
  currency: TCurrency;
  companyId: string;
  isMaster: boolean;
};
export default TWallet;
