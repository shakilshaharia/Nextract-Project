// Bounded TCP reachability checks only, against the user's authorized VPS.
import net from 'node:net';
const host = '82.29.198.146';
await Promise.all([22,3001,4000,3306,33060,6379,46379,8443].map(port => new Promise(resolve => {
  const socket = net.createConnection({host,port});
  let done = false;
  const finish = reachable => { if(done)return;done=true;socket.destroy();console.log(JSON.stringify({host,port,reachable}));resolve(); };
  socket.setTimeout(3000);
  socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));
})));
