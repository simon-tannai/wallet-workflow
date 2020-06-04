import request from 'supertest';
import server from '../index';

describe('Basic tests', () => {
  it('GET /', async () => {
    const result = await request(server.app).get('/');
    expect(result.text).toEqual(JSON.stringify({ message: 'May the force be with you' }));
    expect(result.status).toEqual(200);
  });

  it('GET /api', async () => {
    const result = await request(server.app).get('/api');
    expect(result.text).toEqual(JSON.stringify({ message: 'This is the root of the API' }));
    expect(result.status).toEqual(200);
  });

  it('GET /api/test', async () => {
    const result = await request(server.app).get('/api/test');
    expect(result.text).toEqual('This is a test');
    expect(result.status).toEqual(200);
  });
});
