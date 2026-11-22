using AcousticAnalogies, LinearAlgebra
const AA=AcousticAnalogies
f=10.0 .^ collect(3.1:0.1:4.1)
x=log10.(f); z=x .- sum(x)/length(x)
Q(v)=v .- sum(v)/length(v) .- z*(sum(z.*v)/sum(z.*z))
for tip in (AA.FlatTip(0.), AA.RoundedTip(0.)), angle in (5.,10.,20.)
 a=deg2rad(angle);u=[5.4,31.,50.8];ls=[]
 for v in u
  m=v/343.;mm=AA.tip_vortex_max_mach_number(tip,m,a);um=mm*343.
  b=[AA.TIP(fi,.067,m,.8m,um,mm,.710,pi/2,pi/3,a,tip) for fi in f]
  push!(ls,b)
 end
 g=[7sin(i*1.4)-0.3i^2 for i in eachindex(f)]
 observed=[b.+g for b in ls]
 residual=Q(observed[end]).-Q(observed[1])
 @assert maximum(abs.(Q(g)))>1 && maximum(abs.(residual))<1e-10
 @assert maximum(abs.(Q(observed[end]).-Q(ls[end]).-Q(g)))<1e-10
 println("Q_GAIN_RETAINED ",typeof(tip)," ",angle," ",maximum(abs.(Q(g)))," ",maximum(abs.(residual)))
 d=ls[end].-ls[1];measured_slope=sum(z.*d)/sum(z.*z);expected=61*log10(u[end]/u[1])
 println("NATIVE_INVARIANT ",typeof(tip)," ",angle," ",measured_slope," ",expected," ",maximum(abs.(Q(ls[end]).-Q(ls[1]))))
 @assert abs(measured_slope-expected)<1e-10 && maximum(abs.(Q(ls[end]).-Q(ls[1])))<1e-10
end
