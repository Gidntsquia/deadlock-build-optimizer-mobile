export function publicPath(path?:string):string {
  if(!path) return '';
  if(path.includes('://') || path.startsWith('data:')) return path;
  const base=import.meta.env.BASE_URL;
  const prefix=base.endsWith('/')?base:`${base}/`;
  while(path.startsWith('/')) path=path.slice(1);
  return prefix+path;
}
