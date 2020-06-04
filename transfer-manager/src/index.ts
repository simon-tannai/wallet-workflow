import Server from './Server';

const server = new Server();

try {
  server.run();
} catch (error) {
  console.error(error.message);
}

export default server;
