/** Local trajectory preview shares the Studio's static-asset security boundary. */
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createProductServer} from '../server.mjs';

export function createChallengeServer() {
  const studio = createProductServer();
  return http.createServer((req,res) => {
    // The preview's only independent route is its default trajectory page.
    // Delegate headers, methods, paths and file handling to the maintained server.
    try {
      const url = new URL(req.url, 'http://localhost');
      if (decodeURIComponent(url.pathname) === '/') req.url = '/trajectory.html' + url.search;
    } catch {
      // The shared server will return the ordinary malformed-URL refusal.
    }
    studio.emit('request',req,res);
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4194);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
  const server=createChallengeServer();
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`WORLDLAW trajectory challenge: http://127.0.0.1:${port}/trajectory.html`));
}
