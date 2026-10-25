import test from 'node:test';
import assert from 'node:assert/strict';
const ids=new Map();
class Node{
  constructor(tag){this.tag=tag;this.children=[];this.events={};this.textContent='';this._value=undefined;}
  set id(value){ids.set(value,this);}
  get value(){return this._value??this.children.find(n=>n.tag==='option')?.value??'';}
  set value(value){this._value=value;}
  append(...nodes){this.children.push(...nodes);}
  after(node){this.afterNode=node;}
  replaceChildren(...nodes){this.children=nodes;this._value=undefined;}
  setAttribute(){}
  addEventListener(event,callback){this.events[event]=callback;}
}
globalThis.document={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
const {createResidualStructurePanel}=await import('../src/trajectory/residual-structure-panel.mjs');
const walk=(node,tag)=>[...(node.tag===tag?[node]:[]),...node.children.flatMap(n=>walk(n,tag))];
const fire=(id,event='click')=>ids.get(id).events[event]();
function setup(){
  ids.clear();const anchor=new Node('anchor'),panel=createResidualStructurePanel(anchor);
  panel.render(Array.from({length:13},(_,i)=>({time:i,observed:i%2?i*.1:-i*.1,predicted:0})));
  ids.get('residual-pair-mode').value='seconds';fire('residual-pair-mode','change');
  ids.get('residual-delay-bands').value='2:2';fire('inspect-residual-structure');
  ids.get('residual-epoch-boundaries').value='0,4,8,12';fire('inspect-residual-epochs');
  return {anchor,panel};
}
test('actual composed handlers expose original epoch rows and retained crossing pairs',()=>{
  setup();assert.match(ids.get('residual-epoch-status').textContent,/12\/12 original/);
  let rows=walk(ids.get('residual-epoch-ledger'),'tr');assert.equal(rows.length,5);assert.equal(rows[1].children[0].textContent,'1');assert.equal(rows.at(-1).children[0].textContent,'4');
  ids.get('residual-epoch-scope').value='cross';fire('residual-epoch-scope','change');
  rows=walk(ids.get('residual-epoch-ledger'),'tr');assert.equal(rows.length,5);
  assert.match(ids.get('residual-epoch-page-note').textContent,/10\/10 original band pairs/);
  assert.deepEqual(rows.slice(1).map(r=>r.children.slice(1,3).map(c=>c.textContent)),[['3','5'],['4','6'],['7','9'],['8','10']]);
});
test('boundary edits and parent-source/mode changes retire every epoch result',()=>{
  const {panel}=setup();fire('residual-epoch-boundaries','input');assert.equal(walk(ids.get('residual-epoch-ledger'),'tr').length,0);
  ids.get('residual-epoch-boundaries').value='0,4,8,11';fire('inspect-residual-epochs');assert.match(ids.get('residual-epoch-status').textContent,/exactly cover/);
  ids.get('residual-epoch-boundaries').value='0,4,8,12';fire('inspect-residual-epochs');
  fire('residual-delay-bands','input');assert.equal(ids.get('residual-epochs').hidden,true);assert.equal(walk(ids.get('residual-epoch-ledger'),'tr').length,0);
  fire('inspect-residual-structure');fire('inspect-residual-epochs');panel.render(null);assert.equal(ids.get('residual-epochs').hidden,true);assert.equal(walk(ids.get('residual-epoch-ledger'),'tr').length,0);
});
