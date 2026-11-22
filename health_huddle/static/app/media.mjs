// Recordings stay on this browser. No paid transcription service is configured.
const DB_NAME = 'health-huddle-media-v2';
let dbPromise;
function database() {
  return dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('audio');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(new Error('This browser cannot save audio. You can still save a text note.')); };
  });
}
export async function saveAudio(blob) {
  if (!blob || blob.size > 6 * 1024 * 1024) throw new Error('Use an audio recording smaller than 6 MB.');
  const db = await database(), id = crypto.randomUUID();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').put(blob, id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error('Audio could not be saved. Please keep a text transcript instead.'));
  });
  return id;
}
export async function loadAudio(id) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const req = db.transaction('audio').objectStore('audio').get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = reject;
  });
}
export async function clearAudio() {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('audio', 'readwrite');
    tx.objectStore('audio').clear();tx.oncomplete = resolve;tx.onerror = reject;
  });
}
export const speechSupported = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
export async function startVoice({onStatus, onTranscript, onReady, transcribe}) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording is unavailable in this browser. Attach a recording or use a text note.');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch { throw new Error('Microphone permission was not granted. Allow it in your browser, or add a text note.'); }
  const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type => MediaRecorder.isTypeSupported(type));
  let recorder;
  try { recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined); }
  catch { stream.getTracks().forEach(t=>t.stop());throw new Error('This browser could not start recording. Try attaching audio instead.'); }
  let recognition, timer, stopped=false, aborted=false, transcript='';
  const chunks=[];
  const stop = (discard=false) => {
    // Closing a note must discard pending recorder/recognition callbacks even
    // when Stop was already pressed and the final audio event is still queued.
    if(discard)aborted=true;
    if(stopped)return;stopped=true;clearTimeout(timer);
    try { recognition?.stop(); } catch { /* Recognition may have ended itself. */ }
    try { if(recorder.state !== 'inactive') recorder.stop(); }
    finally { stream.getTracks().forEach(t=>t.stop()); }
  };
  recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  recorder.onerror = () => { if(aborted)return;onStatus('Recording stopped unexpectedly. Check playback before saving.');stop(); };
  recorder.onstop = () => {
    if(aborted)return;
    const blob = new Blob(chunks,{type:recorder.mimeType || mimeType || 'audio/webm'});
    if(!blob.size){onStatus('No audio was captured. Please try again or type a note.');onReady(null);return;}
    onReady(blob);onStatus('Recording ready. Listen, review the transcript, then save your note.');
  };
  try { recorder.start(); }
  catch { stream.getTracks().forEach(t=>t.stop());throw new Error('This browser could not start recording. Try attaching audio instead.'); }
  if(transcribe && speechSupported()) {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Speech();recognition.lang='en-GB';recognition.continuous=true;recognition.interimResults=true;
    recognition.onresult = e => {
      if(aborted)return;
      let final='',interim='';
      for(let i=0;i<e.results.length;i++) {
        if(e.results[i].isFinal)final += e.results[i][0].transcript+' ';
        else interim += e.results[i][0].transcript;
      }
      transcript=final.trim();onTranscript((transcript+' '+interim).trim());
    };
    recognition.onerror = e => { if(!aborted&&!stopped)onStatus('Audio is still recording. Automatic text is unavailable ('+e.error+'); you can type a transcript.'); };
    try { recognition.start(); } catch { onStatus('Audio is recording. Automatic text could not start; type a transcript afterwards.'); }
  }
  timer = setTimeout(()=>stop(),90000);
  onStatus('Recording… up to 90 seconds. Press Stop when finished.');
  return {stop, cancel:()=>stop(true)};
}
