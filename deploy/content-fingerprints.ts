// Read-only comparison of published website data. Never emits private settings.
import {createHash} from 'node:crypto';
import {db} from '../artifacts/cms-api/src/db.ts';
import {getSiteBootstrap} from '../artifacts/cms-api/src/lib/content.ts';
function normalize(value:unknown):unknown {
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['id','createdAt','updatedAt','publishedAt','authorId','updatedById'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,normalize(v)]));
  return value;
}
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
try{
  const pages=await db.page.findMany({select:{slug:true,status:true}});
  const pageHashes:Record<string,unknown>={};
  for(const page of pages){
    const bootstrap=await getSiteBootstrap(page.slug==='home'?'/':'/'+page.slug);
    pageHashes[page.slug]={status:page.status,publicPageHash:digest(bootstrap.page),fields:bootstrap.page?Object.fromEntries(Object.entries(bootstrap.page).filter(([key])=>!['id','updatedAt','publishedAt'].includes(key)).map(([key,value])=>[key,digest(value)])):null,sections:bootstrap.page?.sections.map((section,index)=>({index,fields:Object.fromEntries(Object.entries(section).map(([key,value])=>[key,digest(value)]))}))};
  }
  const root=await getSiteBootstrap('/');
  const groups=Object.fromEntries(Object.entries(root).filter(([key])=>!['page','generatedAt'].includes(key)).map(([key,value])=>[key,digest(value)]));
  const settingFields=Object.fromEntries(Object.entries(root.settings).map(([key,value])=>[key,digest(value)]));
  const posts=await db.post.findMany({where:{status:'PUBLISHED'},select:{slug:true,type:true,title:true,excerpt:true,contentHtml:true,publishedSnapshot:true,featuredImage:true,seo:true}});
  console.log(JSON.stringify({pages:pageHashes,publicGroups:groups,settingFields,posts:Object.fromEntries(posts.map(post=>[`${post.type}:${post.slug}`,digest(post)])),menuCounts:Object.fromEntries(Object.entries(root.menus).map(([key,menu])=>[key,menu.items.length]))}));
}finally{await db.$disconnect();}
