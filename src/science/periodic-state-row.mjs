// A simulated periodic state supplies both measured-coordinate rings. Never fill
// missing neighbors on externally supplied sparse training observations.
export function periodicStateRow(state,j,spacing,command) {
  const n=state.length;
  return {field:state[j],left:state[(j+n-1)%n],right:state[(j+1)%n],
    left2:state[(j+n-2)%n],right2:state[(j+2)%n],spacing,command};
}
