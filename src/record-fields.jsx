import React,{useState} from 'react';
export function RecordFields({value,onChange,label}) {
  const [column,setColumn]=useState(''),[error,setError]=useState('');
  const entries=Object.entries(value??{});
  const change=(key,v)=>onChange(Object.fromEntries(entries.map(([k,old])=>[k,k===key?v:old])));
  return <fieldset><legend>{label}</legend>{entries.map(([key,v])=><div className="form-fields" key={key}>
    <label>{key} type<select value={v===null?'null':typeof v} onChange={e=>change(key,({string:'',number:0,boolean:false,null:null})[e.target.value])}>{['string','number','boolean','null'].map(t=><option key={t}>{t}</option>)}</select></label>
    {typeof v==='boolean'?<label>{key} value<select value={String(v)} onChange={e=>change(key,e.target.value==='true')}><option>true</option><option>false</option></select></label>:v!==null&&<label>{key} value<input type={typeof v==='number'?'number':'text'} step="any" maxLength={2000} value={v} onChange={e=>{if(typeof v==='number'&&(e.target.value.trim()===''||!Number.isFinite(Number(e.target.value)))){setError('Enter a finite number, or choose null for an empty value.');return}setError('');change(key,typeof v==='number'?Number(e.target.value):e.target.value)}}/></label>}
    <button type="button" className="button" onClick={()=>onChange(Object.fromEntries(entries.filter(([k])=>k!==key)))}>Remove {key}</button>
  </div>)}<div className="form-fields"><label>Column to add<input value={column} maxLength={63} onChange={e=>setColumn(e.target.value)} placeholder="document_name"/></label><button type="button" className="button" disabled={entries.length>=12} onClick={()=>{if(!/^[a-z_][a-z0-9_]{0,62}$/.test(column)||Object.hasOwn(value??{},column)){setError('Use a unique lowercase column name with letters, numbers or underscores.');return}onChange({...value,[column]:''});setColumn('');setError('')}}>Add column</button></div>{error&&<p role="alert">{error}</p>}</fieldset>;
}
