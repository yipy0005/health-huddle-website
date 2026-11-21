import { PEOPLE, GROUPS } from './seed-data.mjs';
export const STORAGE_KEY = 'health-huddle-prototype-v2';
export const DEMO_DATE = '2026-10-11';
export const AREAS = ['Faringdon', 'Southmoor', 'Stanford in the Vale', 'Shrivenham', 'Watchfield', 'Uffington', 'Longcot', 'Great Coxwell'];
export const CATEGORIES = ['Movement', 'Digital skills', 'Creative', 'Social', 'Support', 'Food'];
export const identifier = () => globalThis.crypto?.randomUUID?.() || 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
const clone = value => JSON.parse(JSON.stringify(value));
export function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value; }
export function addDays(value, days) { const d = new Date(value + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
export function fmtDate(value, options = {}) { return new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', timeZone:'UTC', ...options }).format(new Date(value + 'T12:00:00Z')); }
export function monthLabel(value) { return fmtDate(value + '-01', {month:'long', year:'numeric', day:undefined}); }
function validMonth(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') && Number(value.slice(0,4)) >= 2020 && Number(value.slice(0,4)) <= 2100; }
function nextMonth(value, offset=1) { const d=new Date(value+'-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth()+offset); return d.toISOString().slice(0,7); }
function whole(value, label, max=10000) { if(value==='' || value===null || value===undefined || !Number.isInteger(Number(value)) || Number(value)<0 || Number(value)>max) throw new Error(label+' must be a whole number between 0 and '+max+'.'); return Number(value); }
const clean = (value, limit=400) => String(value || '').trim().slice(0,limit);
const person = (state,id) => state.people.find(p=>p.id===id);
const elevated = (state,id) => ['professional','admin'].includes(person(state,id)?.role);
function requireProfessional(state,id) { if(!elevated(state,id)) throw new Error('A Professional or Admin must make this change.'); }
export function canManage(state,group,actorId) { if(typeof group==='string') group=state.groups.find(g=>g.id===group); return !!group && (elevated(state,actorId) || (person(state,actorId)?.role==='champion' && group.championIds.includes(actorId))); }
function requireManage(state,group,actorId) { if(!canManage(state,group,actorId)) throw new Error('You can only manage groups to which you are assigned as a Champion.'); }
function getGroup(state,id) { const group=state.groups.find(g=>g.id===id); if(!group) throw new Error('Group not found.'); return group; }
function getSession(state,id,actorId) { const session=state.sessions.find(s=>s.id===id); if(!session) throw new Error('Session not found.'); requireManage(state,getGroup(state,session.groupId),actorId); return session; }
export function logEvent(state,message,actorId='') { state.events.unshift({id:identifier(),message:clean(message,400),actorId,at:new Date().toISOString()}); state.events=state.events.slice(0,100); }

export function normalizeRecurrence(input) {
  const r={...input};
  if(!validDate(r.startDate) || Number(r.startDate.slice(0,4))<2020 || Number(r.startDate.slice(0,4))>2100) throw new Error('Choose a valid first date between 2020 and 2100.');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) throw new Error('Choose a valid session time.');
  r.duration=whole(r.duration,'Duration',480); if(r.duration<15) throw new Error('Sessions must last at least 15 minutes.');
  if(!['once','weekly','fortnightly','monthly'].includes(r.frequency)) throw new Error('Choose a repeat pattern.');
  r.endMode=r.frequency==='once'?'count':(r.endMode || 'count');
  if(!['count','date','ongoing'].includes(r.endMode)) throw new Error('Choose when the schedule ends.');
  r.count=r.frequency==='once'?1:(r.endMode==='count'?whole(r.count,'Number of sessions',520):null);
  if(r.endMode==='count' && r.count<1) throw new Error('Create at least one session.');
  r.endDate=r.endMode==='date'?r.endDate:'';
  if(r.endMode==='date' && (!validDate(r.endDate) || r.endDate<r.startDate || Number(r.endDate.slice(0,4))>2100)) throw new Error('The end date must be on or after the first date, no later than 2100.');
  r.weekday=r.frequency==='monthly'?whole(r.weekday,'Day of week',6):new Date(r.startDate+'T12:00:00Z').getUTCDay();
  r.monthlyWeeks=r.frequency==='monthly'?[...new Set((Array.isArray(r.monthlyWeeks)?r.monthlyWeeks:[]).map(Number))].sort((a,b)=>a-b):[];
  if(r.frequency==='monthly' && (!r.monthlyWeeks.length || r.monthlyWeeks.some(n=>![-1,1,2,3,4,5].includes(n)))) throw new Error('Choose the first, second, third, fourth, fifth or last week of the month.');
  return {frequency:r.frequency,startDate:r.startDate,time:r.time,duration:r.duration,endMode:r.endMode,count:r.count,endDate:r.endDate,monthlyWeeks:r.monthlyWeeks,weekday:r.weekday};
}
function matchesMonthly(date,r) { const d=new Date(date+'T12:00:00Z'); return d.getUTCDay()===r.weekday && (r.monthlyWeeks.includes(Math.floor((d.getUTCDate()-1)/7)+1) || (r.monthlyWeeks.includes(-1) && addDays(date,7).slice(0,7)!==date.slice(0,7))); }
export function recurrenceDates(recurrence,month) {
  if(!validMonth(month)) throw new Error('Choose a valid month between 2020 and 2100.');
  const r=normalizeRecurrence(recurrence), result=[]; if(month<r.startDate.slice(0,7)) return result;
  const last=addDays(nextMonth(month)+'-01',-1);
  if(r.frequency==='once') return r.startDate.startsWith(month)?[r.startDate]:[];
  if(r.frequency==='weekly' || r.frequency==='fortnightly') {
    const interval=r.frequency==='weekly'?7:14;
    const startInMonth=Math.max(0,Math.ceil((Date.parse(month+'-01T12:00:00Z')-Date.parse(r.startDate+'T12:00:00Z'))/(86400000*interval)));
    for(let index=startInMonth;index<5300;index++) { const date=addDays(r.startDate,index*interval); if(date>last || (r.endMode==='count' && index>=r.count) || (r.endMode==='date' && date>r.endDate)) break; result.push(date); }
    return result;
  }
  let ordinal=0;
  for(let scanMonth=r.startDate.slice(0,7);scanMonth<=month;scanMonth=nextMonth(scanMonth)) {
    for(let date=scanMonth+'-01';date.startsWith(scanMonth);date=addDays(date,1)) {
      if(date<r.startDate || !matchesMonthly(date,r)) continue; ordinal++;
      if((r.endMode==='count' && ordinal>r.count) || (r.endMode==='date' && date>r.endDate)) return result;
      if(scanMonth===month) result.push(date);
    }
  }
  return result;
}
export function firstOccurrenceDate(groupOrRecurrence) {
  const r=normalizeRecurrence(groupOrRecurrence?.recurrence || groupOrRecurrence);
  if(r.frequency!=='monthly') return r.startDate;
  // A monthly "not before" date need not itself be a session. Twelve months
  // bounds the search and covers every supported nth/last weekday pattern.
  for(let offset=0;offset<12;offset++) {
    const month=nextMonth(r.startDate.slice(0,7),offset);
    if(!validMonth(month) || (r.endMode==='date' && month>r.endDate.slice(0,7))) break;
    const first=recurrenceDates(r,month)[0];
    if(first) return first;
  }
  return null;
}
export function ensureMonth(state,month) {
  if(!validMonth(month)) throw new Error('Choose a valid month between 2020 and 2100.');
  const keys=new Set(state.sessions.map(s=>s.groupId+'|'+s.date)); let added=0;
  for(const group of state.groups) for(const date of recurrenceDates(group.recurrence,month)) {
    const key=group.id+'|'+date; if(keys.has(key)) continue;
    state.sessions.push({id:group.id+'--'+date,groupId:group.id,date,time:group.recurrence.time,duration:group.recurrence.duration,status:'scheduled',attendees:null,champions:null,notes:[],signups:[],reason:'',updatedBy:'',updatedAt:''}); keys.add(key); added++;
  }
  return added;
}
function initialWindow(state,group) {
  const r=group.recurrence;
  // Keep generation bounded; later months are materialised only when viewed/exported.
  const months=r.endMode==='ongoing'?12:(r.endMode==='date'?Math.min(12,(Number(r.endDate.slice(0,4))-Number(r.startDate.slice(0,4)))*12+Number(r.endDate.slice(5,7))-Number(r.startDate.slice(5,7))+1):Math.min(12,r.frequency==='monthly'?r.count+1:r.frequency==='fortnightly'?Math.ceil(r.count/2)+1:Math.ceil(r.count/4)+1));
  const startMonth=r.endMode==='ongoing' && r.startDate.slice(0,7)<DEMO_DATE.slice(0,7)?DEMO_DATE.slice(0,7):r.startDate.slice(0,7);
  ensureMonth(state,r.startDate.slice(0,7));
  for(let i=0;i<months;i++) { const month=nextMonth(startMonth,i); if(validMonth(month)) ensureMonth(state,month); }
}
function details(state,input) {
  const name=clean(input.name,91),venue=clean(input.venue,161);
  if(!name || name.length>90) throw new Error('Give the group a name of up to 90 characters.');
  if(!venue || venue.length>160) throw new Error('Add a venue or meeting point of up to 160 characters.');
  if(!AREAS.includes(input.area) || !CATEGORIES.includes(input.category)) throw new Error('Choose an area and category.');
  const championIds=[...new Set(input.championIds || [])];
  if(championIds.some(id=>person(state,id)?.role!=='champion')) throw new Error('Choose Champions from the people list.');
  const coordinate=v=>Number.isFinite(Number(v)) && v!=='' && v!==null && v!==undefined?Number(v):null;
  const result={name,category:input.category,area:input.area,venue,postcode:clean(input.postcode,12),lat:coordinate(input.lat),lng:coordinate(input.lng),locationAccuracy:clean(input.locationAccuracy || 'Venue search'),description:clean(input.description,1000),championIds,posterData:clean(input.posterData,2000000),sourceNote:clean(input.sourceNote,1000),verificationNeeded:!!input.verificationNeeded,cost:clean(input.cost,100),contactName:clean(input.contactName,90),contactPhone:clean(input.contactPhone,40),contactEmail:clean(input.contactEmail,150),joinInfo:clean(input.joinInfo,300)};
  if((result.lat===null)!==(result.lng===null) || (result.lat!==null && (Math.abs(result.lat)>90 || Math.abs(result.lng)>180))) throw new Error('The map coordinates are invalid.'); return result;
}
export function createGroup(state,input,actorId) {
  requireProfessional(state,actorId);
  const group={id:identifier(),...details(state,input),status:'draft',recurrence:normalizeRecurrence(input.recurrence || input),createdAt:new Date().toISOString()};
  state.groups.push(group); initialWindow(state,group); logEvent(state,group.name+' created as a draft.',actorId); return group;
}
export function editGroup(state,id,input,actorId) {
  const group=getGroup(state,id); requireManage(state,group,actorId);
  if(!elevated(state,actorId) && input.championIds && JSON.stringify([...input.championIds].sort())!==JSON.stringify([...group.championIds].sort())) throw new Error('Only a Professional or Admin can assign Champions.');
  const merged={...group,...input};
  if((input.venue && input.venue!==group.venue) || (input.area && input.area!==group.area)) { if(input.lat===undefined) merged.lat=null; if(input.lng===undefined) merged.lng=null; merged.locationAccuracy='Venue search; location changed'; }
  Object.assign(group,details(state,merged),{status:'draft'});
  state.sessions.filter(s=>s.groupId===id && s.status==='scheduled').forEach(s=>{s.signups=s.signups.filter(personId=>group.championIds.includes(personId));});
  logEvent(state,group.name+' edited and returned to draft for approval.',actorId);return group;
}
export function changeGroupStatus(state,groupId,status,actorId) {
  requireProfessional(state,actorId); const group=getGroup(state,groupId);
  if(!['draft','published','paused'].includes(status)) throw new Error('Choose a valid group status.');
  group.status=status; logEvent(state,group.name+(status==='published'?' approved and published.':status==='paused'?' paused.':' returned to draft.'),actorId); return group;
}
export function extendGroup(state,groupId,input,actorId) {
  const group=getGroup(state,groupId),old=group.recurrence; requireManage(state,group,actorId);
  if(old.frequency==='once') throw new Error('A one-off event cannot be extended. Create a new group with a repeat pattern.');
  const updated=normalizeRecurrence({...old,endMode:input.endMode,count:input.count,endDate:input.endDate});
  if(updated.endMode==='count' && (old.endMode==='ongoing' || (old.endMode==='count' && updated.count<old.count))) throw new Error('An extension cannot shorten the existing schedule.');
  if(updated.endMode==='date' && (old.endMode==='ongoing' || (old.endMode==='date' && updated.endDate<old.endDate))) throw new Error('An extension cannot shorten the existing schedule.');
  const existing=state.sessions.filter(s=>s.groupId===group.id);
  if(updated.endMode!=='ongoing' && existing.some(s=>!recurrenceDates(updated,s.date.slice(0,7)).includes(s.date))) throw new Error('An extension must retain all existing session dates.');
  group.recurrence=updated;
  if(!elevated(state,actorId)) group.status='draft';
  initialWindow(state,group);logEvent(state,group.name+(updated.endMode==='ongoing'?' is now ongoing.':' schedule extended.')+(!elevated(state,actorId)?' Awaiting professional approval.':''),actorId);return group;
}
export function assignChampions(state,groupId,ids,actorId) {
  requireProfessional(state,actorId); const group=getGroup(state,groupId),unique=[...new Set(ids)];
  if(unique.some(id=>person(state,id)?.role!=='champion')) throw new Error('Choose Champions from the people list.');
  group.championIds=unique;state.sessions.filter(s=>s.groupId===groupId && s.status==='scheduled').forEach(s=>{s.signups=s.signups.filter(id=>unique.includes(id));});
  logEvent(state,'Champion assignments updated for '+group.name+'.',actorId);return group;
}
export function recordSession(state,id,input,actorId) {
  const s=getSession(state,id,actorId),group=getGroup(state,s.groupId);
  if(s.status==='cancelled') throw new Error('Restore this cancelled session before recording attendance.');
  if(group.status==='draft') throw new Error('Approve the group before recording its sessions.');
  if(s.date>DEMO_DATE) throw new Error('Attendance can be recorded after the session date. The test date is 11 October 2026.');
  const attendees=whole(input.attendees,'Attendance'),champions=whole(input.champions,'Champion involvement',500),editing=s.status==='completed';
  Object.assign(s,{attendees,champions,status:'completed',updatedBy:actorId,updatedAt:new Date().toISOString()});
  logEvent(state,(editing?'Session record updated':'Session recorded')+': '+group.name+', '+fmtDate(s.date)+'.',actorId);return s;
}
export function addSessionNote(state,id,input,actorId) {
  const s=getSession(state,id,actorId);
  if(s.status==='cancelled') throw new Error('Restore this session before adding a delivery note.');
  if(s.date>DEMO_DATE) throw new Error('Delivery notes can be added after the session date. The test date is 11 October 2026.');
  const text=clean(input.text,2000),transcript=clean(input.transcript,4000),audioId=clean(input.audioId,100);
  if(!text && !transcript && !audioId) throw new Error('Add a written note, transcript or recording first.');
  const note={id:identifier(),authorId:actorId,text,transcript,audioId,at:new Date().toISOString()};s.notes.push(note);logEvent(state,'A note was added for '+getGroup(state,s.groupId).name+'.',actorId);return note;
}
export function cancelSession(state,id,reason,actorId) {
  const s=getSession(state,id,actorId);
  if(s.status==='completed') throw new Error('This session is already recorded as delivered. Clear its attendance before cancelling it.');
  if(!clean(reason)) throw new Error('Add a short cancellation reason.');
  Object.assign(s,{status:'cancelled',reason:clean(reason,300),attendees:null,champions:null,updatedBy:actorId,updatedAt:new Date().toISOString()});logEvent(state,getGroup(state,s.groupId).name+': '+fmtDate(s.date)+' cancelled.',actorId);return s;
}
export function restoreSession(state,id,actorId) {
  const s=getSession(state,id,actorId);Object.assign(s,{status:'scheduled',reason:'',attendees:null,champions:null,updatedBy:actorId,updatedAt:new Date().toISOString()});logEvent(state,getGroup(state,s.groupId).name+': '+fmtDate(s.date)+' reset to scheduled; notes retained.',actorId);return s;
}
export function setSignup(state,id,actorId,willing) {
  const s=state.sessions.find(x=>x.id===id);if(!s) throw new Error('Session not found.');const group=getGroup(state,s.groupId);
  if(person(state,actorId)?.role!=='champion' || !group.championIds.includes(actorId)) throw new Error('Only an assigned Champion can confirm their own attendance.');
  if(s.status!=='scheduled' || group.status!=='published' || s.date<DEMO_DATE) throw new Error('Confirm Champion attendance for an upcoming, published session.');
  s.signups=s.signups.filter(id=>id!==actorId);if(willing) s.signups.push(actorId);logEvent(state,person(state,actorId).name+(willing?' plans to attend ':' withdrew from ')+group.name+', '+fmtDate(s.date)+'.',actorId);return s;
}
export function report(state,month,groupId='all') {
  ensureMonth(state,month);const sessions=state.sessions.filter(s=>s.date.startsWith(month) && (groupId==='all'||s.groupId===groupId)),completed=sessions.filter(s=>s.status==='completed');
  return {sessions:[...sessions].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)),delivered:completed.length,cancelled:sessions.filter(s=>s.status==='cancelled').length,planned:sessions.filter(s=>s.status==='scheduled').length,attendances:completed.reduce((n,s)=>n+s.attendees,0),champions:completed.reduce((n,s)=>n+s.champions,0),confirmedChampions:sessions.filter(s=>s.status==='scheduled').reduce((n,s)=>n+s.signups.length,0)};
}
export function csvCell(value) { let s=String(value??'');if(/^\s*[=+@-]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"'; }
const csv = rows => '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
export function exportCsv(state,month,groupId='all') {
  const r=report(state,month,groupId),rows=[['Health Huddle - TEST DATA, not verified current listings'],['Month',month],['Scope',groupId==='all'?'All groups':getGroup(state,groupId).name],['Sessions delivered',r.delivered],['Cancellations',r.cancelled],['Total attendances',r.attendances],['Champion involvements',r.champions],['Scheduled awaiting a record',r.planned],[],['Group','Area','Date','Time (Europe/London)','Session status','Attendances','Champion involvements','Champions confirmed in advance','Recorded by','Cancellation reason','Notes']];
  r.sessions.forEach(s=>{const g=getGroup(state,s.groupId);rows.push([g.name,g.area,s.date,s.time,s.status==='completed'?'Delivered':s.status,s.status==='completed'?s.attendees:'',s.status==='completed'?s.champions:'',s.signups.map(id=>person(state,id)?.name || 'Former Champion').join('; '),person(state,s.updatedBy)?.name || '',s.reason,s.notes.map(n=>(person(state,n.authorId)?.name || 'Former member')+': '+[n.text,n.transcript].filter(Boolean).join(' / ')+(n.audioId?' [voice recording saved on this device]':'')).join(' | ')]);});return csv(rows);
}
export function exportListingsCsv(state,month,groupId='all') {
  ensureMonth(state,month);const rows=[['Health Huddle - DRAFT MAGAZINE LISTINGS - TEST DATA'],['Month',monthLabel(month)],['Scope',groupId==='all'?'All groups':getGroup(state,groupId).name],['Check all dates, venues, contacts and permissions before publication.'],[],['Activity','New / ongoing','Area','Venue','Postcode','Dates','Start time','End time','Description','Cost','Contact','Phone','Email','Joining information','Verification note']];
  for(const g of state.groups.filter(g=>g.status==='published' && (groupId==='all'||g.id===groupId)).sort((a,b)=>a.name.localeCompare(b.name))) {
    const sessions=state.sessions.filter(s=>s.groupId===g.id && s.date.startsWith(month) && s.status!=='cancelled').sort((a,b)=>a.date.localeCompare(b.date));if(!sessions.length) continue;
    const endMinutes=Number(g.recurrence.time.slice(0,2))*60+Number(g.recurrence.time.slice(3))+g.recurrence.duration,endTime=String(Math.floor(endMinutes/60)%24).padStart(2,'0')+':'+String(endMinutes%60).padStart(2,'0')+(endMinutes>=1440?' (next day)':'');
    rows.push([g.name,firstOccurrenceDate(g)?.slice(0,7)===month?'New':'Ongoing',g.area,g.venue,g.postcode,sessions.map(s=>fmtDate(s.date,{weekday:'short'})).join('; '),g.recurrence.time,endTime,g.description,g.cost,g.contactName,g.contactPhone,g.contactEmail,g.joinInfo,g.sourceNote || 'Test entry: confirm details before publication.']);
  }return csv(rows);
}

function emailValue(value) { const email=clean(value,180).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');return email; }
export function submitRequest(state,input) {
  if(!['champion','professional','feedback','idea'].includes(input.type)) throw new Error('Choose a request type.');
  const name=clean(input.name,90),email=emailValue(input.email),message=clean(input.message,2000);if(!name || !message) throw new Error('Add your name and a short message.');
  if(input.type==='professional' && !/@(?:[a-z0-9-]+\.)*nhs\.(?:net|uk)$/i.test(email)) throw new Error('Use an NHS work email for a Professional request. Admin review is still required.');
  const request={id:identifier(),type:input.type,name,email,message,status:'pending',route:input.type==='professional'?'admin':'professional',createdAt:new Date().toISOString(),reviewedBy:'',reviewedAt:'',invitationCode:'',invitationUsed:false};state.requests.unshift(request);logEvent(state,'New '+input.type+' request awaiting '+(request.route==='admin'?'Admin':'Professional')+' review.');return request;
}
function requestReviewer(state,request,actorId) { requireProfessional(state,actorId);if(request.type==='professional' && person(state,actorId)?.role!=='admin') throw new Error('Only an Admin can review Professional access.'); }
export function approveRequest(state,id,actorId,reviewNote='') {
  const request=state.requests.find(r=>r.id===id);if(!request) throw new Error('Request not found.');requestReviewer(state,request,actorId);
  if(!['champion','professional'].includes(request.type)) throw new Error('Mark feedback or ideas as resolved after reviewing them.');if(request.status!=='pending') throw new Error('This request has already been reviewed.');
  Object.assign(request,{status:'approved',reviewedBy:actorId,reviewedAt:new Date().toISOString(),reviewNote:clean(reviewNote,1000),invitationCode:identifier().replaceAll('-','').slice(0,12).toUpperCase()});logEvent(state,request.name+' approved for a test '+request.type+' invitation.',actorId);return request;
}
export function inviteChampion(state,input,actorId) {
  requireProfessional(state,actorId);const email=emailValue(input.email),name=clean(input.name,90);if(!name) throw new Error('Add the person\'s name.');
  if(state.people.some(p=>p.email.toLowerCase()===email)) throw new Error('This email already has a test account.');if(state.requests.some(r=>r.email===email && ['pending','approved'].includes(r.status))) throw new Error('This email already has an open request or invitation.');
  const request=submitRequest(state,{type:'champion',name,email,message:'Professional confirmed an in-person conversation. Local test invitation only.'});return approveRequest(state,request.id,actorId);
}
export function updateRequest(state,id,status,actorId) {
  const request=state.requests.find(r=>r.id===id);if(!request) throw new Error('Request not found.');requestReviewer(state,request,actorId);if(!['rejected','resolved'].includes(status)) throw new Error('Choose reject or resolved.');if(request.status!=='pending') throw new Error('This request has already been reviewed.');if(status==='resolved' && ['champion','professional'].includes(request.type)) throw new Error('Approve or reject access requests.');
  Object.assign(request,{status,reviewedBy:actorId,reviewedAt:new Date().toISOString()});logEvent(state,request.type+' request '+status+'.',actorId);return request;
}
export function redeemInvitation(state,input) {
  const email=emailValue(input.email),code=clean(input.code,30).toUpperCase(),request=state.requests.find(r=>r.email===email && r.invitationCode===code && r.status==='approved' && !r.invitationUsed);
  if(!request) throw new Error('The invitation email and code do not match an unused approved invitation on this browser.');if(state.people.some(p=>p.email.toLowerCase()===email)) throw new Error('This email already has a test account.');
  const p={id:identifier(),name:clean(input.name || request.name,90),email,role:request.type,testAccount:true};state.people.push(p);request.invitationUsed=true;request.status='joined';logEvent(state,p.name+' joined as a test '+p.role+'.',p.id);return p;
}
export function seedState() {
  const state={schema:2,people:clone(PEOPLE),groups:clone(GROUPS),sessions:[],requests:[],events:[],likes:{}};
  ensureMonth(state,'2026-09');
  for(let i=0;i<12;i++) ensureMonth(state,nextMonth('2026-10',i));
  [['walk-faringdon','2026-10-05',12,2],['digital-cafe','2026-10-01',10,2],['cancer-beyond','2026-10-08',8,1],['art-drop-in','2026-10-07',14,2]].forEach(([groupId,date,attendees,champions])=>{const s=state.sessions.find(s=>s.groupId===groupId && s.date===date);if(s) Object.assign(s,{status:'completed',attendees,champions,updatedBy:'prof-sarah',updatedAt:date+'T16:00:00Z'});});
  const cancelled=state.sessions.find(s=>s.groupId==='walk-faringdon' && s.date==='2026-10-19');if(cancelled) Object.assign(cancelled,{status:'cancelled',reason:'Test cancellation: example venue issue.'});
  state.events=[{id:'seed-event',message:'Leaflet activities loaded for testing. Dates, roles and map locations need verification before real use.',actorId:'',at:'2026-10-11T09:00:00Z'}];return state;
}
export function validateState(s) {
  try {
    if(!s || s.schema!==2 || !['people','groups','sessions','requests','events'].every(k=>Array.isArray(s[k])) || !s.likes || typeof s.likes!=='object') return false;
    const people=new Set(s.people.map(p=>p.id)),groups=new Set(s.groups.map(g=>g.id)),sessions=new Set(s.sessions.map(x=>x.id)),keys=new Set(s.sessions.map(x=>x.groupId+'|'+x.date));
    if(people.size!==s.people.length || groups.size!==s.groups.length || sessions.size!==s.sessions.length || keys.size!==s.sessions.length) return false;
    if(!s.people.every(p=>typeof p.id==='string' && typeof p.name==='string' && typeof p.email==='string' && ['professional','champion','admin'].includes(p.role) && p.testAccount===true)) return false;
    if(!s.groups.every(g=>typeof g.id==='string' && typeof g.name==='string' && ['draft','published','paused'].includes(g.status) && AREAS.includes(g.area) && CATEGORIES.includes(g.category) && Array.isArray(g.championIds) && g.championIds.every(id=>person(s,id)?.role==='champion') && normalizeRecurrence(g.recurrence))) return false;
    if(!s.requests.every(r=>typeof r.id==='string' && ['champion','professional','feedback','idea'].includes(r.type) && ['pending','approved','rejected','resolved','joined'].includes(r.status) && typeof r.name==='string' && typeof r.email==='string' && typeof r.message==='string' && typeof r.invitationCode==='string' && typeof r.invitationUsed==='boolean')) return false;
    return s.sessions.every(x=>groups.has(x.groupId) && validDate(x.date) && /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time) && ['scheduled','completed','cancelled'].includes(x.status) && Array.isArray(x.signups) && new Set(x.signups).size===x.signups.length && x.signups.every(id=>person(s,id)?.role==='champion') && Array.isArray(x.notes) && x.notes.every(n=>typeof n.id==='string' && people.has(n.authorId) && typeof n.text==='string' && typeof n.transcript==='string' && typeof n.audioId==='string') && (x.status==='completed' ? (Number.isInteger(x.attendees) && x.attendees>=0 && x.attendees<=10000 && Number.isInteger(x.champions) && x.champions>=0 && x.champions<=500) : (x.attendees===null && x.champions===null)));
  }catch { return false; }
}
