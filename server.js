import http from 'node:http';
import handler from './dist/server/entry.mjs';

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});