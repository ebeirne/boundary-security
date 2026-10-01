import React,{useState} from 'react';
import setupPrompt from '../public/add-boundary-prompt.txt?raw';
export function SetupPrompt(){
 const [status,setStatus]=useState('');
 return <section className="boundary-prompt" aria-label="Add Boundary with your coding assistant">
 <p><strong>Free & open source.</strong> No account. No card.</p>
 <button className="button primary" onClick={async()=>{try{await navigator.clipboard.writeText(setupPrompt);setStatus('Copied. Paste into your coding assistant with your project open.')}catch{setStatus('Clipboard unavailable. Download the prompt or copy it below.')}}}>Copy setup prompt</button>
 <p>Paste into your coding assistant with your project open. It checks compatibility and prepares a local staging check.</p>
 <p role="status">{status}</p>
 <div className="heading-actions"><a href={`${import.meta.env.BASE_URL}add-boundary-prompt.txt`} download>Download prompt</a><a href="https://github.com/ebeirne/boundary-security">View source on GitHub ↗</a></div>
 <details><summary>Read the prompt</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'24rem',overflow:'auto',fontSize:'.85rem'}}>{setupPrompt}</pre></details>
 <small>Supported Supabase apps · Separate staging and test accounts required · Your hosting costs remain yours.</small>
 </section>;
}
