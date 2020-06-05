type TConvertRsp = {
  success: boolean;
  base: string;
  target: string;
  ratio: number;
  amount: number;
  converted: number;
  message?: string;
};
export default TConvertRsp;
