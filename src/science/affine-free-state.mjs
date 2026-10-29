// Research only: affine constant force with zero restoring coefficient.
export function freeAffineState({damping:d,force:F,initialRate:v0,time:t}){
 if(![d,F,v0,t].every(Number.isFinite)||d<0||t<0||t>1000||d*t>700)throw Error('Bounded free affine declarations required');
 const h=d*t;let p1,p2;
 if(h<.125){p1=1;p2=.5;let a=1,b=.5;for(let n=1;n<=30;n++){a*=-h/(n+1);b*=-h/(n+2);p1+=a;p2+=b;}}
 else{const z=Math.expm1(-h);p1=-z/h;p2=(h+z)/(h*h);}
 const positionDelta=v0*t*p1+F*t*t*p2,rate=v0*Math.exp(-h)+F*t*p1;
 if(!Number.isFinite(positionDelta)||!Number.isFinite(rate))throw Error('Nonfinite free affine response');
 return{positionDelta,rate};
}
