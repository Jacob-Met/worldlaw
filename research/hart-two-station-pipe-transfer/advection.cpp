// Positive physical-time transport of a prescribed concentration boundary.
// Signed advection uses the recorded velocity; the diffusion coefficient is positive.
#include <algorithm>
#include <cmath>
#include <vector>
extern "C" int propagate(int n,const double* t,const double* u,const double* re,
                         const double* inlet,int m,const double* pos,double s,
                         double mult,double dx,double margin,double* out) {
  const int pad=40;
  int nodes=(int)std::ceil((*std::max_element(pos,pos+m)+margin)/dx)+1;
  std::vector<double> av(nodes+2*pad,0.),bv(av.size(),0.);
  double *a=av.data()+pad,*b=bv.data()+pad;
  int first=n,last=-1;
  double mx=0.;
  for(int j=0;j<n;j++){if(inlet[j]!=0.){first=std::min(first,j);last=j;}mx=std::max(mx,std::abs(inlet[j]));}
  if(last<0)return 0;
  for(int j=std::max(1,first);j<n;j++){
    double dt=t[j]-t[j-1],speed=.5*(u[j]+u[j-1]),rn=std::max(3000.,.5*(std::abs(re[j])+std::abs(re[j-1])));
    if(!(dt>0 && dt<=.25))return 1;
    double diff=4.e-10+mult*.024*std::abs(speed)*(.41+1.17e9*std::pow(rn,-2.5));
    double drift=-speed*dt/(s*dx),spread=std::sqrt(6*diff*dt)/dx;
    int shift[3];double w0[3],w1[3];
    for(int l=0;l<3;l++){
      double d=drift+(l-1)*spread;
      shift[l]=(int)std::floor(d);
      double f=d-shift[l],w=(l==1)?2./3.:1./6.;
      if(std::abs(shift[l])+2>=pad)return 2;
      w0[l]=(1.-f)*w;w1[l]=f*w;
    }
    std::fill(a-pad,a+1,inlet[j-1]);
    int l=shift[0],c=shift[1],r=shift[2];
    for(int i=1;i<nodes;i++)
      b[i]=w0[0]*a[i+l]+w1[0]*a[i+l+1]+w0[1]*a[i+c]+w1[1]*a[i+c+1]+w0[2]*a[i+r]+w1[2]*a[i+r+1];
    b[0]=inlet[j];
    for(int h=0;h<m;h++){
      double x=pos[h]/dx;int i=(int)std::floor(x);
      out[j*m+h]=b[i]+(b[i+1]-b[i])*(x-i);
    }
    std::swap(a,b);
    if(j>last && j%32==0){
      double remain=0.; for(int i=0;i<nodes;i++)remain=std::max(remain,std::abs(a[i]));
      if(remain<1.e-10*mx)break;
    }
  }
  return 0;
}
