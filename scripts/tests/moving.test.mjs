import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { movingProgress, boxState, matchingObjects, movingQr, parseMovingQr } from '../../src/features/moving/model.ts';

const db=new PGlite();
await db.exec(readFileSync(new URL('./moving-fixture.sql',import.meta.url),'utf8'));
await db.exec(readFileSync(new URL('../../supabase/migrations/20260812090000_move_objet.sql',import.meta.url),'utf8').split('-- === stockage')[0]);
await db.exec(readFileSync(new URL('../../supabase/migrations/20260913010000_moving_mode.sql',import.meta.url),'utf8'));
const owner=randomUUID(), stranger=randomUUID(), viewer=randomUUID();
await db.query('insert into auth.users values ($1),($2),($3)',[owner,stranger,viewer]);
const source=randomUUID(),dest=randomUUID(),other=randomUUID(),sourceRoom=randomUUID(),destRoom=randomUUID(),sourceShelf=randomUUID(),destShelf=randomUUID();
await db.query('insert into habitations(id,user_id,name,type) values ($1,$4,\'Old\',\'maison\'),($2,$4,\'New\',\'maison\'),($3,$5,\'Private\',\'maison\')',[source,dest,other,owner,stranger]);
await db.query('insert into pieces(id,habitation_id,name) values ($1,$3,\'Office\'),($2,$4,\'Kitchen\')',[sourceRoom,destRoom,source,dest]);
await db.query('insert into emplacements(id,piece_id,name) values ($1,$3,\'Desk\'),($2,$4,\'Drawer\')',[sourceShelf,destShelf,sourceRoom,destRoom]);
async function login(user){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');}
async function admin(){await db.exec('reset role');}
async function command(action,payload){const result=await db.query('select moving_command($1,$2::jsonb) as data',[action,JSON.stringify(payload)]);return result.rows[0].data;}
async function read(id){return (await db.query('select moving_read($1) as data',[id])).rows[0].data;}
const project=randomUUID();let first,second,obj1=randomUUID(),obj2=randomUUID();
await login(owner);
await test('create a project and idempotently create automatically numbered inventory boxes',async()=>{
 await command('create',{id:project,source_id:source,destination_id:dest,name:'Move 2026'});
 first=randomUUID();second=randomUUID();
 await command('box_create',{project_id:project,id:first,name:'Books',destination_piece_id:destRoom});
 await command('box_create',{project_id:project,id:first,name:'Books'});
 await command('box_create',{project_id:project,id:second});
 const snapshot=await read(project);assert.deepEqual(snapshot.boxes.map(b=>b.number),[1,2]);assert.match(snapshot.boxes[0].name,/#01/);
 assert.equal((await read(first)).project.id,project);
});
await test('direct table writes, strangers and readers cannot mutate; QR never grants access',async()=>{
 await assert.rejects(db.query('update moving_projects set name=\'Bypass\' where id=$1',[project]),/permission denied/);
 await login(stranger);await assert.rejects(read(first),/moving_forbidden/);
 await assert.rejects(command('box_create',{project_id:project,id:randomUUID()}),/moving_forbidden/);
 await admin();await db.query("insert into test_permissions values ($1,$3,'consultation'),($2,$3,'consultation')",[source,dest,viewer]);
 await login(viewer);assert.equal((await read(project)).editable,false);
 await assert.rejects(command('phase',{project_id:project,status:'moving'}),/moving_forbidden/);
 await login(owner);await assert.rejects(command('destination',{project_id:project,destination_id:other}),/moving_destination/);
});
await admin();await db.query("insert into objets(id,name,parent_emplacement_id) values ($1,'Headphones',$3),($2,'Keyboard',$3)",[obj1,obj2,sourceShelf]);await login(owner);
await test('packing moves the original objects atomically and preserves their previous location',async()=>{
 await command('pack',{project_id:project,box_id:first,items:[{id:obj1},{id:obj2}]});
 const snapshot=await read(project);assert.equal(snapshot.items.length,2);assert.equal(snapshot.items[0].origin_id,sourceShelf);
 assert.equal(snapshot.objects.find(o=>o.id===obj1).parent_id,snapshot.boxes[0].container_id);
 const search=(await db.query('select * from moving_search_index()')).rows;assert.equal(search.filter(e=>e.kind==='objet').length,2);assert.equal(search.find(e=>e.id===obj1).piece_name,'Move 2026');
});
await test('repacking in another box is idempotent and keeps the first origin',async()=>{
 await command('pack',{project_id:project,box_id:second,items:[{id:obj1}]});
 await command('pack',{project_id:project,box_id:second,items:[{id:obj1}]});
 const snapshot=await read(project);assert.equal(snapshot.items.length,2);assert.equal(snapshot.items.find(i=>i.object_id===obj1).box_id,second);assert.equal(snapshot.items.find(i=>i.object_id===obj1).origin_id,sourceShelf);
});
await test('stale selections roll back the entire lot, and unpacking rejects the old home',async()=>{
 await assert.rejects(command('unpack',{project_id:project,box_id:first,to_type:'emplacement',to_id:destShelf,items:[{id:obj2},{id:obj1}]}),/moving_object_changed/);
 assert.equal((await read(project)).items.find(i=>i.object_id===obj2).outcome,'packed');
 await assert.rejects(command('unpack',{project_id:project,box_id:first,to_type:'emplacement',to_id:sourceShelf,items:[{id:obj2}]}),/moving_destination/);
 await assert.rejects(command('finish',{project_id:project}),/moving_not_empty/);
});
await test('unpack and store a permanent box, then archive only empty temporary inventory',async()=>{
 await command('unpack',{project_id:project,box_id:first,to_type:'emplacement',to_id:destShelf,items:[{id:obj2}]});
 await command('store',{project_id:project,box_id:second,to_type:'emplacement',to_id:destShelf});
 let snapshot=await read(project);assert.deepEqual(movingProgress(snapshot.items),{total:2,installed:1,stored:1,packed:0,resolved:2,percent:100});
 assert.equal(boxState(snapshot.boxes[0],snapshot.items),'done');
 await command('finish',{project_id:project});snapshot=await read(project);
 assert.equal(snapshot.project.status,'completed');assert.equal(snapshot.boxes[0].container_id,null);assert.ok(snapshot.boxes[1].container_id);
 assert.equal(snapshot.items.length,2);assert.equal(snapshot.objects.length,2);
 await assert.rejects(command('phase',{project_id:project,status:'preparation'}),/moving_completed/);
});
await test('photo batches are retryable, and disposal retains its explicit outcome',async()=>{
 const p=randomUUID(),b=randomUUID(),o=randomUUID();await command('create',{id:p,source_id:source,destination_id:dest,name:'Second move'});await command('box_create',{project_id:p,id:b});
 const payload={project_id:p,box_id:b,items:[{id:o,name:'Cable',create:true}]};await command('scan',payload);await command('scan',payload);
 assert.equal((await read(p)).items.length,1);
 await command('dispose',{project_id:p,box_id:b,items:[{id:o}],outcome:'given'});
 const snapshot=await read(p);assert.equal(snapshot.items[0].outcome,'given');assert.equal(snapshot.objects.some(x=>x.id===o),false);
});
await test('QR parsing rejects URLs with data or instructions and matching never auto-selects',()=>{
 assert.equal(parseMovingQr(movingQr(first)),first);
 for(const value of ['https://evil.test/'+first,movingQr(first)+'?token=secret','ceou://moving-box/not-an-id'])assert.equal(parseMovingQr(value),null);
 assert.equal(movingProgress([]).percent,0);
 const result=matchingObjects('casque sony',[{id:'1',name:'Casque Sony WH-1000XM5'},{id:'2',name:'Table'}]);assert.equal(result.length,1);assert.equal(result[0].id,'1');
});
await test('voice-style moves update progress; returning to the old home is not an installation',async()=>{
 const p=randomUUID(),b=randomUUID(),o=randomUUID();await command('create',{id:p,source_id:source,destination_id:dest,name:'Voice move'});await command('box_create',{project_id:p,id:b});
 await command('scan',{project_id:p,box_id:b,items:[{id:o,name:'Speaker',create:true}]});
 await admin();await db.query("select move_objet($1,'emplacement',$2)",[o,sourceShelf]);await login(owner);
 assert.equal((await read(p)).items[0].outcome,'removed');
 await command('pack',{project_id:p,box_id:b,items:[{id:o}]});await admin();await db.query("select move_objet($1,'emplacement',$2)",[o,destShelf]);await login(owner);
 assert.equal((await read(p)).items[0].outcome,'installed');
});
await test('revocation on either home removes access to moving metadata and QR',async()=>{
 await admin();await db.query('delete from test_permissions where home=$1 and person=$2',[dest,viewer]);await login(viewer);
 await assert.rejects(read(project),/moving_forbidden/);assert.equal((await db.query('select * from moving_search_index()')).rows.length,0);
 await login(owner);
});
await test('a 500-object batch and three-digit box numbers retain every object',async()=>{
 const p=randomUUID(),b=randomUUID();await command('create',{id:p,source_id:source,destination_id:dest,name:'Large move'});
 await admin();await db.query('update moving_projects set next_number=100 where id=$1',[p]);await login(owner);
 await command('box_create',{project_id:p,id:b});assert.match((await read(p)).boxes[0].name,/#100$/);
 const items=Array.from({length:500},(_,i)=>({id:randomUUID(),name:'Book '+i,create:true}));await command('scan',{project_id:p,box_id:b,items});
 assert.equal((await read(p)).items.length,500);
 await command('unpack',{project_id:p,box_id:b,to_type:'emplacement',to_id:destShelf,items:items.map(({id})=>({id}))});assert.equal(movingProgress((await read(p)).items).percent,100);
});
await test('moving UI copy has French/English parity and all literal keys exist',()=>{
 const fr=JSON.parse(readFileSync(new URL('../../src/lib/i18n/locales/fr.json',import.meta.url),'utf8'));
 const en=JSON.parse(readFileSync(new URL('../../src/lib/i18n/locales/en.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(fr.moving).sort(),Object.keys(en.moving).sort());
 for(const filename of ['MovingListScreen.tsx','MovingScreen.tsx','forms.tsx','packing.tsx','PackObjectButton.tsx']){
  const source=readFileSync(new URL('../../src/features/moving/'+filename,import.meta.url),'utf8');
  for(const [,key] of source.matchAll(/['"]((?:moving|common)\.[a-zA-Z_]+)['"]/g)){
   assert.ok(key.split('.').reduce((node,part)=>node?.[part],fr),filename+': '+key);
  }
 }
});
await test('archived moves survive home deletion and active moves do not prevent account deletion',async()=>{
 const user=randomUUID(),home=randomUUID(),p=randomUUID();
 await admin();await db.query('insert into auth.users values ($1)',[user]);
 await db.query("insert into habitations(id,user_id,name,type) values ($1,$2,'Temporary','maison')",[home,user]);
 await login(user);await command('create',{id:p,source_id:home,name:'Archive'});
 await admin();await assert.rejects(db.query('delete from habitations where id=$1',[home]),/moving_active_home/);
 await login(user);await command('finish',{project_id:p});
 await admin();await db.query('delete from habitations where id=$1',[home]);
 await login(user);assert.equal((await read(p)).project.source_id,null);
 await admin();await db.query("insert into habitations(id,user_id,name,type) values ($1,$2,'Temporary','maison')",[home,user]);
 await login(user);await command('create',{id:randomUUID(),source_id:home,name:'Active'});
 await admin();await db.query('delete from auth.users where id=$1',[user]);
 assert.equal((await db.query('select * from moving_projects where user_id=$1',[user])).rows.length,0);
 await login(owner);
});
await test('moving to an already stored box resolves packing and cross-project moves roll back',async()=>{
 const p=randomUUID(),b=randomUUID(),stored=randomUUID(),o=randomUUID(),otherProject=randomUUID(),otherBox=randomUUID();
 await command('create',{id:p,source_id:source,destination_id:dest,name:'Permanent storage'});
 for(const id of [b,stored])await command('box_create',{project_id:p,id});
 await command('store',{project_id:p,box_id:stored,to_type:'emplacement',to_id:destShelf});
 await command('scan',{project_id:p,box_id:b,items:[{id:o,name:'Lamp',create:true}]});
 await command('create',{id:otherProject,source_id:source,destination_id:dest,name:'Other move'});
 await command('box_create',{project_id:otherProject,id:otherBox});
 await assert.rejects(command('pack',{project_id:otherProject,box_id:otherBox,items:[{id:o}]}),/moving_other_project/);
 const container=(await read(p)).boxes.find(x=>x.id===stored).container_id;
 await command('unpack',{project_id:p,box_id:b,to_type:'conteneur',to_id:container,items:[{id:o}]});
 assert.equal((await read(p)).items.find(x=>x.object_id===o).outcome,'installed');
});
await db.close();
