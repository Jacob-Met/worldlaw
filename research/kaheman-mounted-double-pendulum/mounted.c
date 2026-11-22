#include <math.h>
#include <stddef.h>

static void rhs(const double *p, const double *c, int mode, const double x[4], double d[4]) {
    const double m=p[0],n=p[1],a=p[2],b=p[3],l=p[4],g=p[9];
    const double A=p[5]+m*a*a+n*l*l, B=p[6]+n*b*b, C=n*l*b;
    const double delta=x[0]-x[1], u=x[2], v=x[3], w=v-u;
    const double cross=C*cos(delta), s=sin(delta), det=A*B-cross*cross;
    double t1=c[0]*u,t2=c[1]*w;
    if(mode==2){t1+=c[2]*u*fabs(u);t2+=c[3]*w*fabs(w);}
    if(mode==3){const double scale=6.2831853071795864769/40.;
        t1+=c[2]*tanh(u/scale);t2+=c[3]*tanh(w/scale);}
    const double f=g*(m*a+n*l)*sin(x[0])-C*s*v*v-t1+t2;
    const double z=g*n*b*sin(x[1])+C*s*u*u-t2;
    d[0]=u;d[1]=v;d[2]=(B*f-cross*z)/det;d[3]=(A*z-cross*f)/det;
}

void forward(const double *p,const double *c,int mode,int block,int halves,
             size_t rows,const double *time,const double *observed,double *out){
    for(size_t i=0;i<rows;i++){
        double *y=out+4*i;
        if(i==0||(block>0&&i%(size_t)block==0)){
            for(int j=0;j<4;j++)y[j]=observed[4*i+j];
            continue;
        }
        for(int j=0;j<4;j++)y[j]=out[4*(i-1)+j];
        const double h=(time[i]-time[i-1])/halves;
        for(int part=0;part<halves;part++){
            double k1[4],k2[4],k3[4],k4[4],s[4];
            rhs(p,c,mode,y,k1);
            for(int j=0;j<4;j++)s[j]=y[j]+h*k1[j]/2;
            rhs(p,c,mode,s,k2);
            for(int j=0;j<4;j++)s[j]=y[j]+h*k2[j]/2;
            rhs(p,c,mode,s,k3);
            for(int j=0;j<4;j++)s[j]=y[j]+h*k3[j];
            rhs(p,c,mode,s,k4);
            for(int j=0;j<4;j++)y[j]+=h*(k1[j]+2*k2[j]+2*k3[j]+k4[j])/6;
        }
    }
}

void derivative(const double *p,const double *c,int mode,const double *x,double *d){
    rhs(p,c,mode,x,d);
}
