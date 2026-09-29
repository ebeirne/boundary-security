import {createServer} from 'node:http';
export const syntheticMarker='BOUNDARY_SYNTHETIC_DOCUMENT_7b19a04d';
export const fixtureTokens={alice:'synthetic-alice-token',bob:'synthetic-bob-token'};
export async function startPrivacyFixture(mode='secure'){
 const server=createServer((req,res)=>{
  const actor=Object.keys(fixtureTokens).find(id=>req.headers.authorization===`Bearer ${fixtureTokens[id]}`);
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body))};
  if(!actor)return send(401,{error:'Invalid synthetic session'});
  if(req.url==='/privacy/identity')return send(200,{id:mode==='same-identity'?'alice':actor});
  if(!['/privacy/file','/privacy/retrieval'].includes(req.url))return send(404,{});
  if(mode==='outage')return send(503,{});
  if(mode==='missing-fixture')return send(404,{});
  const file=req.url==='/privacy/file';
  if(actor==='bob' && mode==='expired-session')return send(401,{});
  if(actor==='bob' && mode==='redirect'){res.writeHead(302,{Location:'/privacy/identity'});return res.end()}
  if(actor==='bob' && mode==='unknown-body')return send(200,{message:'OK'});
  const leaks=mode==='both-leak' || mode===(file?'file-leak':'retrieval-leak');
  if(file){res.writeHead(actor==='alice'||leaks?200:403,{'Content-Type':'text/plain'});res.end(actor==='alice'||leaks?syntheticMarker:'Denied');}
  else send(200,actor==='alice'||leaks?[{content:syntheticMarker}]:[]);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})};
}
