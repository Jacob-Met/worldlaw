/** Local file decoding. A requested seek time is never silently called a decoded frame timestamp. */
const MAX_VIDEO_BYTES=256*1024*1024;
const abortError=()=>new DOMException('Video operation cancelled.','AbortError');
function checkAbort(signal) {if(signal?.aborted)throw abortError();}
function eventOnce(video,event,{signal,timeout=15000}={}) {
  return new Promise((resolve,reject)=>{
    let timer;
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,success);video.removeEventListener('error',failure);signal?.removeEventListener('abort',abort);};
    const success=()=>{cleanup();resolve();};
    const failure=()=>{cleanup();reject(new Error('This video could not be decoded. Try a supported WebM or MP4 file.'));};
    const abort=()=>{cleanup();reject(abortError());};
    video.addEventListener(event,success,{once:true});video.addEventListener('error',failure,{once:true});signal?.addEventListener('abort',abort,{once:true});
    timer=setTimeout(()=>{cleanup();reject(new Error(`Video ${event} timed out. The notebook is unchanged.`));},timeout);
    if(signal?.aborted)abort();
  });
}

export async function loadVideo(file,{signal}={}) {
  checkAbort(signal);
  if(!file || typeof file.arrayBuffer!=='function' || !Number.isFinite(file.size) || file.size<=0 || file.size>MAX_VIDEO_BYTES)
    throw new Error('Choose a nonempty local video no larger than 256 MiB.');
  if(!globalThis.crypto?.subtle)throw new Error('This browser cannot hash the source video. Open Motion Lab on its local server.');
  const bytes=await file.arrayBuffer();checkAbort(signal);
  const digest=await crypto.subtle.digest('SHA-256',bytes);checkAbort(signal);
  const sha256=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  const video=document.createElement('video');video.preload='auto';video.muted=true;video.playsInline=true;
  // Kept in the rendering tree so paused seeked frames can produce compositor timestamps.
  video.style.cssText='position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  video.setAttribute('aria-hidden','true');video.tabIndex=-1;
  const url=URL.createObjectURL(file);let disposed=false,busy=false,activeCancel=null;
  const dispose=()=>{if(disposed)return;disposed=true;activeCancel?.();video.pause();video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);};
  try {
    const ready=eventOnce(video,'loadeddata',{signal});document.body.append(video);video.src=url;video.load();await ready;
    checkAbort(signal);
    if(!Number.isFinite(video.duration)||video.duration<=0||video.duration>86400)throw new Error('The video needs a finite duration of at most 24 hours.');
    if(!video.videoWidth||!video.videoHeight||video.videoWidth*video.videoHeight>40_000_000)throw new Error('Unsupported video frame dimensions.');
    const scale=Math.min(1,960/video.videoWidth,720/video.videoHeight);
    const width=Math.max(2,Math.round(video.videoWidth*scale)),height=Math.max(2,Math.round(video.videoHeight*scale));
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw new Error('This browser cannot read decoded video pixels.');
    const source={kind:'local-video',label:String(file.name||'Local video').slice(0,500),sha256,width,height,duration:video.duration,
      nativeWidth:video.videoWidth,nativeHeight:video.videoHeight,bytes:file.size,mime:String(file.type||''),
      metadata:{decoder:'HTMLVideoElement',coordinateSpace:'decoded image pixels after uniform size reduction',
        frameTimestamp:'per-sample decoded media time when available; nominal seek fallback explicitly labeled',
        mediaRetained:'local file only; notebook contains source digest and measurements'}};
    async function frameAt(seconds,{signal:frameSignal}={}) {
      checkAbort(frameSignal);checkAbort(signal);
      if(disposed)throw new Error('This video source has been released.');
      if(busy)throw new Error('A video frame is already being decoded. Wait for it or cancel before seeking again.');
      if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<0||seconds>source.duration)throw new Error('Seek time must lie within the selected video.');
      busy=true;
      let callbackId=null,timer=null,finished=false,metadata=null,capturedPixels=null,seeked=false;
      const requestedTime=Math.min(seconds,Math.max(0,source.duration-1e-6));
      try {
        const captured=await new Promise((resolve,reject)=>{
          const readPixels=()=>{context.drawImage(video,0,0,width,height);return context.getImageData(0,0,width,height);};
          const samePixels=(a,b)=>a.data.length===b.data.length && a.data.every((value,i)=>value===b.data[i]);
          const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',onSeek);video.removeEventListener('error',onError);frameSignal?.removeEventListener('abort',onAbort);signal?.removeEventListener('abort',onAbort);if(callbackId!==null)video.cancelVideoFrameCallback?.(callbackId);activeCancel=null;};
          const finish=(error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve({metadata,pixels:capturedPixels});};
          const onAbort=()=>finish(abortError());
          const onError=()=>finish(new Error('The requested frame could not be decoded.'));
          const armFrame=()=>{
            callbackId=video.requestVideoFrameCallback((_,m)=>{
              callbackId=null;if(finished)return;
              try {
                // The browser may report the sought frame before it dispatches
                // seeked. Keep the raster captured in this callback paired with
                // its own timestamp instead of redrawing later under that stamp.
                capturedPixels=readPixels();metadata=m;
                if(seeked)finish();
              } catch(error) {finish(error);}
            });
          };
          const onSeek=()=>{
            seeked=true;
            if(metadata) {
              try {
                if(samePixels(capturedPixels,readPixels()))finish();
                else {
                  // A previously queued callback described a different raster.
                  // Seek completion cannot authenticate its old frame timestamp.
                  metadata=null;capturedPixels=null;
                  if(callbackId===null)armFrame();
                }
              } catch(error) {finish(error);}
            } else if(!video.requestVideoFrameCallback)finish();
          };
          activeCancel=onAbort;
          video.addEventListener('seeked',onSeek);video.addEventListener('error',onError);frameSignal?.addEventListener('abort',onAbort,{once:true});signal?.addEventListener('abort',onAbort,{once:true});
          if(video.requestVideoFrameCallback)armFrame();
          // A browser can omit callbacks for paused/same-frame seeks. Preserve the
          // nominal fallback explicitly; downstream acceleration then refuses it.
          timer=setTimeout(()=>{if(seeked&&video.readyState>=2)finish();else finish(new Error('Video frame seeking timed out.'));},1800);
          video.currentTime=requestedTime;
          if(frameSignal?.aborted||signal?.aborted)onAbort();
        });
        checkAbort(frameSignal);checkAbort(signal);
        if(disposed)throw abortError();
        const stamp=captured.metadata;
        if(!captured.pixels)context.drawImage(video,0,0,width,height);
        const pixels=captured.pixels??context.getImageData(0,0,width,height);
        const exact=stamp && Number.isFinite(stamp.mediaTime);
        return {width,height,data:pixels.data,time:exact?stamp.mediaTime:video.currentTime,requestedTime,
          timeBasis:exact?'decoded-media-time':'requested-seek-time',
          ...(exact?{presentedFrames:stamp.presentedFrames}:{}),
          timingNote:exact?'Decoded presentation timestamp reported by the browser.':'Nominal seek time; decoded frame timestamp unavailable. Do not infer precise acceleration from this clock.'};
      } finally {busy=false;}
    }
    return {source,width,height,duration:source.duration,frameAt,dispose};
  } catch(error) {dispose();throw error;}
}
