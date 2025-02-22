import Server from './repo/Server';

const server = new Server();

(async () => {
  try {
    await server.run();
  } catch (error) {
    console.error(error.message);
  }
})();

export default server;
