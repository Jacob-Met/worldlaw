/* Reciprocal plane-parallel absorption with the deposited binned HG phase law.
 * Read input rows wavelength[um], scattering[1/um], g, absorption[1/um].
 * Output row, depth_index, photons absorbed (or reaching black bottom).
 * Angles are measured from the inward normal at the upper surface. */
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define PI 3.14159265358979323846
static uint64_t state;
static double uniform(void){
    state ^= state >> 12; state ^= state << 25; state ^= state >> 27;
    return ((double)((state*UINT64_C(2685821657736338717)) >> 11)+0.5)/9007199254740992.;
}
int main(int argc,char **argv){
    if(argc!=7)return 2;
    int nlayer=atoi(argv[1]),nphot=atoi(argv[3]);double dz=strtod(argv[2],0);
    double cone=strtod(argv[5],0);state=strtoull(argv[6],0,10);
    if(nlayer<1||nlayer>4096||nphot<1||dz<=0||cone<0||cone>90||state==0)return 2;
    int hemi=strcmp(argv[4],"hemisphere")==0;
    if(!hemi&&strcmp(argv[4],"cone")!=0)return 2;
    double cmax=cos(cone*PI/180.),lambda,s,g,a;
    int row=0;
    while(scanf("%lf%lf%lf%lf",&lambda,&s,&g,&a)==4){
        if(!(lambda>0&&a>0&&s>=0&&fabs(g)<1))return 3;
        long long counts[4098]={0};
        double phase[180],total=0;
        for(int j=0;j<180;j++){double t=(j+0.5)*PI/180.;
            total+=(1-g*g)*sin(t)/pow(1+g*g-2*g*cos(t),1.5);phase[j]=total;}
        for(int j=0;j<180;j++)phase[j]/=total;
        for(int p=0;p<nphot;p++){
            double u=uniform(),mu=hemi?sqrt(u):sqrt(1-(1-cmax*cmax)*u),z=0;
            for(;;){
                z+=mu*(-log(uniform())/(s+a));
                if(z<0){counts[nlayer+1]++;break;}
                if(z>=nlayer*dz){counts[nlayer]++;break;}
                if(uniform()>s/(s+a)){counts[(int)(z/dz)]++;break;}
                double q=uniform();int lo=0,hi=179;
                while(lo<hi){int mid=(lo+hi)/2;if(q<phase[mid])hi=mid;else lo=mid+1;}
                double below=lo?phase[lo-1]:0;
                double theta=(lo+(q-below)/(phase[lo]-below))*PI/180.;
                double phi=2*PI*uniform();
                mu=cos(theta)*mu+sin(theta)*sqrt(fmax(0.,1-mu*mu))*cos(phi);
                mu=fmax(-1.,fmin(1.,mu));
            }
        }
        for(int j=0;j<nlayer+2;j++)printf("%d %d %lld\n",row,j,counts[j]);
        row++;
    }
    return row?0:4;
}