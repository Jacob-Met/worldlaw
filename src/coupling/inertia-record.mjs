import {CouplingError,requireThat} from './science.mjs';
export const INERTIA_RECORD_SCHEMA='worldlaw.coupled-inertia-observations/v1';
const MAX_BYTES=3*1024*1024;
function object(value,keys,name){
 requireThat(value!==null&&typeof value==='object'&&!Array.isArray(value),`${name} must be an object.`);
 requireThat([Object.prototype,null].includes(Object.getPrototypeOf(value)),`${name} must be a plain input object.`);
 const own=Reflect.ownKeys(value);
 requireThat(own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)),`${name} must contain exactly ${keys.join(', ')}.`);
 for(const key of keys)requireThat(Object.getOwnPropertyDescriptor(value,key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'),`${name}.${key} must be an input value.`);
 return value;
}
function text(value,max,name,nonempty=false){requireThat(typeof value==='string'&&value.length<=max&&(!nonempty||value.trim().length>0),`${name} must be ${nonempty?'nonempty ':''}text of at most ${max} characters.`);return value;}
function number(value,name){requireThat(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e6,`${name} must be a finite number with magnitude at most 1000000.`);return value;}
function list(value,min,max,name){
 requireThat(Array.isArray(value)&&value.length>=min&&value.length<=max,`${name} must contain ${min}–${max} entries.`);
 requireThat(Reflect.ownKeys(value).length===value.length+1,`${name} must be dense with no extra fields.`);
 for(let i=0;i<value.length;i++)requireThat(Object.hasOwn(value,i)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,String(i)),'value'),`${name} must contain input values at every index.`);
 return value;
}
function pair(value,name){list(value,2,2,name);return [number(value[0],name+'[0]'),number(value[1],name+'[1]')];}
/** Admission preserves caller declarations; it cannot authenticate source or clock calibration. */
export function readInertiaRecord(input){
 let raw=input;
 if(typeof input==='string'){
  requireThat(input.length<=MAX_BYTES&&new TextEncoder().encode(input).length<=MAX_BYTES,'Observation JSON exceeds 3 MiB.','size_limit');
  try{raw=JSON.parse(input);}catch{throw new CouplingError('Observation JSON is malformed.');}
 }
 object(raw,['schema','units','interpretation','torqueDeclaration','source','courses'],'Record');
 requireThat(raw.schema===INERTIA_RECORD_SCHEMA,'Unsupported inertia observation schema.');
 object(raw.units,['time','position','torque'],'Units');
 requireThat(raw.units.time==='s'&&raw.units.position==='rad'&&raw.units.torque==='N·m','Expected exact units s, rad and N·m.');
 requireThat(raw.interpretation==='constant-symmetric-inertia-with-diagonal-viscous-loss','Unsupported observation interpretation.');
 const torqueDeclaration=text(raw.torqueDeclaration,1000,'torqueDeclaration',true);
 object(raw.source,['label','description'],'Source');
 const source={label:text(raw.source.label,160,'source.label',true),description:text(raw.source.description,1000,'source.description')};
 list(raw.courses,1,6,'Courses');const ids=new Set();let count=0;
 // Bound aggregate work before visiting the individual observation values.
 for(const course of raw.courses){object(course,['id','rows'],'Course');list(course.rows,5,6000,'Course rows');count+=course.rows.length;requireThat(count<=6000,'At most 6000 aggregate observations are supported.','work_limit');}
 const courses=raw.courses.map((course,index)=>{
  const id=text(course.id,80,'course.id',true);requireThat(!ids.has(id),'Course IDs must be distinct.');ids.add(id);
  let previous=-Infinity;
  const rows=course.rows.map((row,i)=>{object(row,['time','position','torque'],'Observation');const time=number(row.time,`courses[${index}].rows[${i}].time`);requireThat(time>previous,'Course timestamps must strictly increase.');previous=time;return {time,position:pair(row.position,'position'),torque:pair(row.torque,'torque')};});
  return {id,rows};
 });
 return {schema:INERTIA_RECORD_SCHEMA,units:{time:'s',position:'rad',torque:'N·m'},interpretation:raw.interpretation,torqueDeclaration,source,courses};
}
