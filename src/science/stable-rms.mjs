/** Root-mean-square accumulation without overflowing finite squares.
 * Preserve ordinary arithmetic until a square/sum overflows or underflows.
 * Weights count repeated values; nonfinite inputs cannot become valid metrics.
 */
export function createRmsAccumulator(){
  const minimumNormal=2**-1022;
  let sum=0,count=0,scale=0,scaledSum=0,scaled=false,valid=true;
  return {
    add(value,weight=1){
      if(!Number.isFinite(value)||!Number.isFinite(weight)||weight<=0){valid=false;return;}
      count+=weight;if(!Number.isFinite(count)){valid=false;return;}
      const square=value*value,term=square*weight,next=sum+term;
      if(!scaled&&Number.isFinite(term)&&Number.isFinite(next)&&(value===0||(square>=minimumNormal&&term>=minimumNormal))){sum=next;return;}
      if(!scaled){scaled=true;if(sum>0){scale=Math.sqrt(sum);scaledSum=1;}}
      const a=Math.abs(value);
      if(a>scale){scaledSum=scaledSum*(scale/a)**2+weight;scale=a;}
      else if(a>0)scaledSum+=weight*(a/scale)**2;
    },
    value(){
      if(!valid||!(count>0))return NaN;
      const mean=sum/count;
      const value=scaled?scale*(Math.sqrt(scaledSum)/Math.sqrt(count)):
        mean>=minimumNormal?Math.sqrt(mean):Math.sqrt(sum)/Math.sqrt(count);
      // A nonzero RMS below the representable range is not an exact zero.
      return value===0&&(scaled?scale>0&&scaledSum>0:sum>0)?NaN:value;
    },
    get count(){return count;},
    get ordinarySum(){return valid&&!scaled?sum:null;}
  };
}
