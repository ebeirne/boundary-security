// Weighted connected growth over the actual pigment. Every pixel has an earlier
// adjacent parent; no disconnected object timers or rectangular reveal regions.
export function connectedOrder(rgba,width,height,light=false,left=.2,right=.86){
 const count=width*height,dist=new Float32Array(count);dist.fill(Infinity);
 const parent=new Int32Array(count);parent.fill(-1);
 const heap=[],cost=new Float32Array(count),settled=new Uint8Array(count),order=new Uint32Array(count);
 const push=(id,d)=>{let i=heap.length;heap.push([id,d]);while(i){const p=(i-1)>>1;if(heap[p][1]<=d)break;heap[i]=heap[p];i=p;}heap[i]=[id,d];};
 const pop=()=>{const root=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1][1]<heap[j][1])j++;if(heap[j][1]>=last[1])break;heap[i]=heap[j];i=j;}heap[i]=last;}return root;};
 for(let i=0;i<count;i++){const q=i*4,l=(rgba[q]*.2126+rgba[q+1]*.7152+rgba[q+2]*.0722)/255,pigment=light?1-l:l;cost[i]=1+400*Math.pow(1-pigment,8);const x=i%width;if(x<width*left||x>=width*right){dist[i]=0;push(i,0);}}
 let n=0;while(heap.length){const [id,d]=pop();if(settled[id])continue;settled[id]=1;order[n++]=id;const x=id%width,y=(id/width)|0;for(const next of [x? id-1:-1,x<width-1?id+1:-1,y?id-width:-1,y<height-1?id+width:-1]){if(next<0||settled[next])continue;const nd=d+(cost[id]+cost[next])*.5;if(nd<dist[next]){dist[next]=nd;parent[next]=id;push(next,nd);}}}
 return {order,parent,arrival:dist};
}

