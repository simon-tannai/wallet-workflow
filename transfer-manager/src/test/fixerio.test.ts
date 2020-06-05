import { config } from 'dotenv';

import FixerIo from '../repo/FixerIo';

config({
  path: `${__dirname}/../env/${process.env.NODE_ENV}.env`,
  encoding: 'utf8',
  debug: true,
});

describe('FixerIo tests', () => {
  const fixerIo = new FixerIo();

  it('should returns ConvertRsp', async () => {
    const convertRsp = await fixerIo.convert(100, 'EUR', 'USD');

    expect(typeof convertRsp).toBe('object');
    expect(convertRsp).toHaveProperty('success');
    expect(convertRsp).toHaveProperty('base');
    expect(convertRsp).toHaveProperty('target');
    expect(convertRsp).toHaveProperty('ratio');
    expect(convertRsp).toHaveProperty('amount');
    expect(convertRsp).toHaveProperty('converted');
  });

  it('should returns ConvertErr', async () => {
    const convertRsp = await fixerIo.convert(0, 'EUR', 'USD');

    expect(typeof convertRsp).toBe('object');
    expect(convertRsp).toHaveProperty('success', false);
    expect(convertRsp).toHaveProperty('message');
  });
});
