"""Source equations of impedance_tube_CstL1 and coeffs_lowpass_Gamma in reflection coordinates."""
import numpy as np
def channels(f,g,u,l,extra=0,conjugate=False):
    c=343.;lv=4e-8;fs=44100.
    L1=g["L1"][0];L2=g["L2"][l-1];Lh=.010 # literal comparison-script override
    R=g["R"][0];Rh=u*.0005
    f1=c/(4*(L1+L2));f2=5*f1
    def prop(radius,length):
        if length==0:return np.ones_like(f,dtype=complex)
        def gamma(freq):
            s=2j*np.pi*freq
            return s/c+1.044/radius*np.sqrt(2*lv/c)*np.sqrt(s)+1.08*lv/radius**2
        F1=abs(np.exp(-gamma(f1)*length))**2
        F2=abs(np.exp(-gamma(f2)*length))**2
        c1=np.cos(2*np.pi*f1/fs);c2=np.cos(2*np.pi*f2/fs)
        A=F1*c1-F2*c2;D=F1-F2;v=A-np.sqrt(A*A-D*D)
        a=v/D;b=np.sqrt(2*F1*F2*(c1-c2)*v)/D
        return b*np.exp(-2j*np.pi*f*length/c)/(1-a*np.exp(-2j*np.pi*f/fs))
    up=(prop(R,L1)*prop(R,extra))**2;down=-prop(R,L2)**2;h=prop(Rh,Lh)
    yc=(Rh/R)**2*(1-h*h)/(1+h*h);yo=(Rh/R)**2*(1+h*h)/(1-h*h)
    def addshunt(ref,y):return (2*ref-y*(1+ref))/(2+y*(1+ref))
    direct=up*addshunt(down,yo)
    if conjugate:up,direct,yc,yo=[v.conj() for v in (up,direct,yc,yo)]
    def relative(z):return up*addshunt(z/up,yo-yc)
    return direct,relative
