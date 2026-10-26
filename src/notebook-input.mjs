import {MAX_TEXT_LENGTH} from './data.mjs';
import {restoreSession} from './session.mjs';

// Recovery scans at most 6,000,000 UTF-16 code units. The core parser still
// receives at most MAX_TEXT_LENGTH; notebook files also have a byte preflight.
export const MAX_LEGACY_NOTEBOOK_TEXT_LENGTH=3*MAX_TEXT_LENGTH;
const whitespace=code=>code===32||code===9||code===10||code===13;
const structural=code=>code===123||code===125||code===91||code===93||code===44||code===58;
const contentLimit=()=>{throw new Error('Notebook content exceeds the supported text size after removing formatting.');};

export function compactLegacyNotebookText(text) {
  if(typeof text!=='string')throw new Error('Notebook must be JSON text.');
  if(text.length<=MAX_TEXT_LENGTH)return text;
  if(text.length>MAX_LEGACY_NOTEBOOK_TEXT_LENGTH)throw new Error('Notebook text exceeds the legacy recovery size limit.');
  const parts=[];
  let length=0,start=0,inString=false,escaped=false;
  const span=(from,to)=>{
    const count=to-from;
    if(!count)return;
    if(length+count>MAX_TEXT_LENGTH)contentLimit();
    length+=count;
    parts.push(text.slice(from,to));
  };
  for(let i=0;i<text.length;i++){
    const code=text.charCodeAt(i);
    if(inString){
      if(escaped)escaped=false;
      else if(code===92)escaped=true;
      else if(code===34)inString=false;
      continue;
    }
    if(code===34){inString=true;continue;}
    if(!whitespace(code))continue;
    span(start,i);
    let end=i+1;
    while(end<text.length&&whitespace(text.charCodeAt(end)))end++;
    // Punctuation already separates tokens. Else retain a boundary so invalid
    // primitives such as "1 2", "- 1", or "tru e" cannot become valid JSON.
    if(i>0&&end<text.length&&!structural(text.charCodeAt(i-1))&&!structural(text.charCodeAt(end))){
      if(length+1>MAX_TEXT_LENGTH)contentLimit();
      length++;
      parts.push(' ');
    }
    start=end;
    i=end-1;
  }
  span(start,text.length);
  return parts.join('');
}

export function restoreNotebook(text) {
  return restoreSession(compactLegacyNotebookText(text));
}
