// Browser-only guidance for the existing Genius Vault web scanner.
// No frame processing, paid calls, camera permission, or auto-capture.
export function reticleDimensions(viewWidth,booklet=false) {
 if(!Number.isFinite(viewWidth)||viewWidth<=0)throw new TypeError('invalid width');
 const width=Math.min(viewWidth*.88,booklet?540:320);
 const height=width*(booklet?3.5/5:3.5/2.5);
 return {width:Math.round(width),height:Math.round(height),mode:booklet?'open_booklet':'standard'};
}
export function photoGuidance({side='front',booklet=false}={}) {
 if(!['front','back'].includes(side))throw new TypeError('invalid side');
 return {
  title:booklet?'Fit the entire open booklet inside the guide':'Fit all four card corners inside the guide',
  instructions:side==='back'?'Keep the printed card number sharp and readable.':'Avoid reflections on the player name, logo, and foil.',
  flash:'Use even ambient light. Avoid direct flash on reflective cards.',
  qualityVerified:false,
  autoCaptureEnabled:false
 };
}
