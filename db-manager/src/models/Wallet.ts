import { Schema, model, Document } from 'mongoose';

const WalletSchema = new Schema({
  amount: {
    type: Number,
    required: true,
    default: 0,
  },
  currency: {
    type: String,
    enum: ['USD', 'EUR', 'GBP'],
    required: true,
  },
  companyId: {
    type: String,
    required: true,
  },
  isMaster: {
    type: Boolean,
    required: true,
    default: false,
  },
});

export interface IWallet {
  amount?: number;
  currency: string;
  companyId: string;
  isMaster?: boolean;
}

export interface IWalletDb extends Document {
  amount: number;
  currency: string;
  companyId: string;
  isMaster: boolean;
}

export default model('Wallet', WalletSchema);
