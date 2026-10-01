import {connectedOrder} from './connected-growth.mjs';
self.onmessage=({data})=>{const {pixels,width,height,light,left,right}=data;const {order}=connectedOrder(pixels,width,height,light,left,right);self.postMessage({order},[order.buffer]);};
