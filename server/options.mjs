// Strict parsing prevents mistyped automation from silently assessing the wrong input.
export function parseOptions(args,spec){
 const values={};
 for(let i=0;i<args.length;i++){
  const key=args[i];
  if(!Object.hasOwn(spec,key))throw Error(`Unknown option: ${key}`);
  if(Object.hasOwn(values,key))throw Error(`Duplicate option: ${key}`);
  if(spec[key]==='flag'){values[key]=true;continue;}
  const value=args[++i];
  if(!value||value.startsWith('--'))throw Error(`Missing value for ${key}`);
  values[key]=value;
 }
 return values;
}
