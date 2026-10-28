import test from 'node:test';
import assert from 'node:assert/strict';
const ids=new Map();
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.events={};this.attrs={};this.textContent='';}
 set id(v){ids.set(v,this);}get value(){return this._value??this.children.find(n=>n.tag==='option')?.value??'';}set value(v){this._value=v;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;this._value=undefined;}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
}
globalThis.document={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
const {createTimeSupportPanel}=await import('../src/trajectory/time-support-panel.mjs');
const walk=(n,tag)=>[...(n.tag===tag?[n]:[]),...n.children.flatMap(c=>walk(c,tag))];
const fire=(id,event='click')=>ids.get(id).events[event]();
test('actual handlers show every original interval and exact raw endpoint identity',()=>{
 ids.clear();const panel=createTimeSupportPanel(new Node('main'));
 const source=Array.from({length:1000},(_,i)=>({time:1e12+i*.125,observed:i%2?1:-1,predicted:.125}));
 const before=JSON.stringify(source);panel.render(source);fire('inspect-time-support');
 assert.match(ids.get('time-support-status').textContent,/999\/999 original/);assert.equal(ids.get('time-support-segment').children.length,999);
 ids.get('time-support-segment').value='998';fire('time-support-segment','change');
 const ledger=walk(ids.get('time-support-ledger'),'tr');
 assert.deepEqual(ledger[1].children.map(n=>n.textContent),['Earlier','998',String(source[998].time),'-1','0.125','-1.125']);
 assert.equal(ledger[2].children[1].textContent,'999');assert.equal(JSON.stringify(source),before);
 const plot=ids.get('time-support-plot');assert.equal(walk(plot,'path').length,1);assert.equal(walk(plot,'circle').length,2);
 panel.render(null);assert.equal(ids.get('residual-time-support').hidden,true);assert.equal(walk(plot,'svg').length,0);assert.equal(ids.get('time-support-segment').children.length,0);
});
test('changed source requires explicit fresh comparison and malformed source refuses',()=>{
 ids.clear();const panel=createTimeSupportPanel(new Node('main'));panel.render(Array.from({length:4},(_,i)=>({time:i,observed:0,predicted:0})));fire('inspect-time-support');
 panel.render(Array.from({length:4},(_,i)=>({time:i,observed:1,predicted:0})));assert.equal(walk(ids.get('time-support-plot'),'svg').length,0);fire('inspect-time-support');assert.equal(walk(ids.get('time-support-plot'),'svg').length,1);
 panel.render(Array.from({length:4},()=>({time:0,observed:0,predicted:0})));fire('inspect-time-support');assert.match(ids.get('time-support-status').textContent,/strictly increase/);assert.equal(walk(ids.get('time-support-ledger'),'tr').length,0);
});
