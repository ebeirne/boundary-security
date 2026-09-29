import React,{useState} from 'react';
export function WorkspaceBackup({request}){
 const [busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null),[error,setError]=useState('');
 const save=async()=>{setBusy(true);setError('');setReceipt(null);try{setReceipt(await request('/api/backup'));}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="workspace-backup"><h2>Keep a recovery copy.</h2><p>Save all projects and assessment history before changing or upgrading your workspace. Copy the saved file to a separate safe location for protection against disk loss.</p><button className="button" onClick={save} disabled={busy}>{busy?'Verifying backup…':'Save workspace backup'}</button>{error&&<p role="alert">{error}</p>}{receipt&&<div role="status"><p>Backup saved and verified · {receipt.projects} projects · {receipt.runs} assessments.</p><label>Saved file<input aria-label="Backup file" readOnly value={receipt.file}/></label><p>Contains plaintext inputs. Keep it private. Restore into a new directory using the recovery guide.</p></div>}</section>;
}
