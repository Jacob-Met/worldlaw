import {validateCalibrationReportGroup} from './calibration-report.mjs';

// This adapter authors the maintained source declaration, never a verdict.
export function calibrationChallengeAssociations(groups,rowSources,selections,declaration){
 if(!Array.isArray(groups)||!groups.length||groups.length>128||!Array.isArray(rowSources)||!rowSources.length||rowSources.length>128||!Array.isArray(selections)||selections.length!==rowSources.length)throw Error('Retain every original challenge row and a bounded complete group declaration.');
 if(declaration?.residualBounds!==true||typeof declaration.basis!=='string'||!declaration.basis.trim()||declaration.basis.length>1000)throw Error('Declare the source association and separately sourced residual challenge bounds.');
 const ids=new Map();for(const g of groups){if(!g||typeof g.id!=='string'||ids.has(g.id))throw Error('Original group identities must be distinct.');if(g.referenceReport)validateCalibrationReportGroup(g);ids.set(g.id,g);}
 const seen=new Set();return rowSources.map((r,i)=>{const s=selections[i],key=JSON.stringify([r.eventIndex,r.rowIndex]);if(!Number.isInteger(r.eventIndex)||!Number.isInteger(r.rowIndex)||seen.has(key)||!s||s.eventIndex!==r.eventIndex||s.rowIndex!==r.rowIndex)throw Error('Selections must retain every original challenge row in its original order.');seen.add(key);
 const g=s.groupId===null?null:ids.get(s.groupId);if(s.groupId!==null&&(!g||!g.referenceReport))throw Error('Choose a retained original report or explicit independent challenge error.');
 return{eventIndex:r.eventIndex,rowIndex:r.rowIndex,groupId:g?.id??null,basis:declaration.basis.trim(),...(g?{sameAffineCorrection:true}:{sameAdditiveOffset:true})};});
}
