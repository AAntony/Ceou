import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { randomUUID, generateKeyPairSync, sign } from 'node:crypto';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyAdmobQuery } from '../../supabase/functions/_shared/admob-signature.mjs';
import { resetDate } from '../../src/features/billing/format.ts';

const db=new PGlite();
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
await db.exec(read('./moving-fixture.sql'));
await db.exec('create role service_role;create table profiles(id uuid primary key);');
await db.exec(read('../../supabase/migrations/20260914120000_voice_live.sql'));
await db.exec(read('../../supabase/migrations/20260917120000_billing.sql'));
const owner=randomUUID(),friend=randomUUID();
await db.query('insert into auth.users values ($1),($2)',[owner,friend]);
const scalar=async(sql,args=[])=>(await db.query(sql,args)).rows[0]?.value;
const snapshot=()=>scalar('select billing_snapshot() value');
async function login(id) {await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
async function admin() {await db.exec('reset role');}
const home=randomUUID(),room=randomUUID(),shelf=randomUUID(),box=randomUUID();
await db.query("insert into habitations(id,user_id,name,type) values ($1,$2,'House','maison')",[home,owner]);
await db.query("insert into pieces(id,habitation_id,name) values ($1,$2,'Room')",[room,home]);
await db.query("insert into emplacements(id,piece_id,name) values ($1,$2,'Shelf')",[shelf,room]);
await db.query("insert into conteneurs(id,parent_emplacement_id,name) values ($1,$2,'Box')",[box,shelf]);

await test('snapshot only exposes caller; quotas cannot be edited or rewards minted by clients',async()=>{
  await login(owner);const data=await snapshot();assert.equal(data.plan,'free');assert.equal(data.enforced,false);assert.equal(data.plans.plus.objects,3000);
  await assert.rejects(db.exec('select * from billing_entitlements'),/permission denied/);
  await assert.rejects(db.exec('update billing_settings set enforce=true'),/permission denied/);
  await assert.rejects(db.query('select billing_ad_grant($1,$2,$3,false)',[randomUUID(),owner,'forged-transaction']),/permission denied/);
  await login(friend);assert.equal((await snapshot()).inventory.homes,0);await admin();
});
await test('observation never blocks; enforcing inventory counts nested objects for the home owner',async()=>{
  await db.exec("update billing_plans set objects=2,homes=1 where id='free'");
  for(let i=0;i<3;i++) await db.query("insert into objets(name,parent_conteneur_id) values ('Thing',$1)",[box]);
  await login(owner);assert.equal((await snapshot()).inventory.objects,3);await admin();
  await db.exec('update billing_settings set enforce=true');
  await assert.rejects(db.query("insert into objets(name,parent_conteneur_id) values ('Extra',$1)",[box]),/billing_object_limit/);
  await assert.rejects(db.query("insert into habitations(user_id,name,type) values ($1,'Extra','maison')",[owner]),/billing_home_limit/);
  await db.query('update objets set parent_conteneur_id=null,parent_emplacement_id=$1 where parent_conteneur_id=$2',[shelf,box]);
  assert.equal(await scalar('select count(*)::int value from objets'),3);
});
await test('moving a whole container, spot, room or home cannot bypass the receiving owner quota',async()=>{
  const dest=randomUUID(),destRoom=randomUUID(),destShelf=randomUUID();
  await db.query("insert into habitations(id,user_id,name,type) values($1,$2,'Destination','maison')",[dest,friend]);
  await db.query("insert into pieces(id,habitation_id,name) values($1,$2,'Room')",[destRoom,dest]);
  await db.query("insert into emplacements(id,piece_id,name) values($1,$2,'Shelf')",[destShelf,destRoom]);
  await db.query('update objets set parent_emplacement_id=null,parent_conteneur_id=$1 where parent_emplacement_id=$2',[box,shelf]);
  await assert.rejects(db.query('update conteneurs set parent_emplacement_id=$1 where id=$2',[destShelf,box]),/billing_object_limit/);
  await assert.rejects(db.query('update emplacements set piece_id=$1 where id=$2',[destRoom,shelf]),/billing_object_limit/);
  await assert.rejects(db.query('update pieces set habitation_id=$1 where id=$2',[dest,room]),/billing_object_limit/);
  await db.exec("update billing_plans set homes=2 where id='free'");
  await assert.rejects(db.query('update habitations set user_id=$1 where id=$2',[friend,home]),/billing_object_limit/);
  await login(friend);assert.equal((await snapshot()).inventory.objects,0);await admin();
});
await test('sandbox Plus is confined to allowlisted testers, stale syncs cannot overwrite current expiry',async()=>{
  const now=new Date(), future=new Date(now.getTime()+86400000).toISOString();
  await db.query('select billing_entitlement_sync($1,true,$2,$3)',[owner,future,now.toISOString()]);
  assert.equal(await scalar('select billing_plan($1) value',[owner]),'free');
  await db.query('insert into billing_testers values($1)',[owner]);
  assert.equal(await scalar('select billing_plan($1) value',[owner]),'plus');
  await db.query('select billing_entitlement_sync($1,false,$2,$2)',[owner,'1970-01-01']);
  assert.equal(await scalar('select billing_plan($1) value',[owner]),'plus');
  await db.query("update billing_entitlements set expires_at=now()-interval '1 second' where user_id=$1",[owner]);
  assert.equal(await scalar('select billing_plan($1) value',[owner]),'free');
});
const reserve=()=>scalar('select billing_photo_reserve($1) value',[owner]);
await test('photo credits reserve atomically; failures refund once and zero results still cost one successful analysis',async()=>{
  await db.exec("update billing_plans set photos=1 where id='free'");
  const first=await reserve();await assert.rejects(reserve(),/billing_photo_limit/);
  await db.query('select billing_photo_settle($1,false)',[first]);
  await db.query('select billing_photo_settle($1,true)',[first]);
  const next=await reserve();await db.query('select billing_photo_settle($1,true,120,30,$2)',[next,'test-model']);
  await assert.rejects(reserve(),/billing_photo_limit/);
  await login(owner);assert.equal((await snapshot()).photos_used,1);await admin();
});
let rewarded;
await test('ads are opt-in, capped including pending ads, and each reward is granted once',async()=>{
  await assert.rejects(db.query('select billing_ad_prepare($1,false)',[owner]),/billing_ads_disabled/);
  await assert.rejects(db.query('select billing_ad_prepare($1,true)',[friend]),/billing_test_disabled/);
  const challenges=[];
  for(let i=0;i<5;i++) challenges.push(await scalar('select billing_ad_prepare($1,true) value',[owner]));
  await assert.rejects(db.query('select billing_ad_prepare($1,true)',[owner]),/billing_ad_limit/);
  rewarded=challenges[0];
  const grant=(user=owner,test=true)=>scalar('select billing_ad_grant($1,$2,$3,$4) value',[rewarded,user,'transaction-1',test]);
  assert.equal(await grant(friend),false);assert.equal(await grant(owner,false),false);assert.equal(await grant(),true);assert.equal(await grant(),true);
  assert.equal(await scalar('select billing_ad_grant($1,$2,$3,true) value',[challenges[1],owner,'transaction-1']),false);
  await login(owner);assert.equal((await snapshot()).bonus_remaining,2);await admin();
  await reserve();const refunded=await reserve();await assert.rejects(reserve(),/billing_photo_limit/);
  await db.query('select billing_photo_settle($1,false)',[refunded]);
  await login(owner);assert.equal((await snapshot()).bonus_remaining,1);await admin();
});
await test('monthly reset leaves previous usage behind and expires old bonus credits',async()=>{
  await db.query("update billing_photo_usage set period=date_trunc('month',now())::date-1 where user_id=$1",[owner]);
  await db.query("update billing_ad_rewards set granted_at=date_trunc('month',now())-interval '1 day' where id=$1",[rewarded]);
  await login(owner);const data=await snapshot();assert.equal(data.photos_used,0);assert.equal(data.bonus_remaining,0);await admin();await reserve();
});
await test('monthly voice allowance retains the daily cap and settlement ownership',async()=>{
  const first=(await db.query('select * from voice_live_reserve($1,600,600,30)',[owner])).rows[0];assert.equal(first.granted_seconds,300);
  assert.equal((await db.query('select * from voice_live_reserve($1,600,600,30)',[owner])).rows.length,0);
  await db.query('select voice_live_settle($1,$2,10)',[friend,first.session_id]);
  assert.equal((await db.query('select * from voice_live_reserve($1,600,600,30)',[owner])).rows.length,0);
  await db.query('select voice_live_settle($1,$2,100)',[owner,first.session_id]);
  assert.equal((await db.query('select * from voice_live_reserve($1,600,600,30)',[owner])).rows[0].granted_seconds,200);
});
await test('AdMob ECDSA validates original encoded bytes and rejects tampering, duplicates and extra parameters',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const pem=publicKey.export({type:'spki',format:'pem'});
  const signed=query=>`${query}&signature=${sign('sha256',Buffer.from(query),privateKey).toString('base64url')}&key_id=123`;
  const url=signed('custom_data=a%2Bb&reward_amount=1&user_id=test');
  assert.equal(verifyAdmobQuery(url,pem).get('custom_data'),'a+b');
  assert.throws(()=>verifyAdmobQuery(url.replace('reward_amount=1','reward_amount=9'),pem));
  assert.throws(()=>verifyAdmobQuery(url+'&user_id=evil',pem));
  assert.throws(()=>verifyAdmobQuery(signed('user_id=a&user_id=b'),pem));
});
await test('billing translations have matching keys',()=>{
  assert.deepEqual(Object.keys(JSON.parse(read('../../src/features/billing/fr.json'))).sort(),Object.keys(JSON.parse(read('../../src/features/billing/en.json'))).sort());
});
await test('reset dates stay on the first of the month regardless of a timezone-less SQL timestamp',()=>{
  assert.equal(resetDate('2026-10-01T00:00:00','fr'),'1 octobre');
  assert.equal(resetDate('2026-10-01','en'),'October 1');
});
await db.close();
