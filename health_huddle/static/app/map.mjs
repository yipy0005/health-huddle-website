// Discovery uses approximate settlement centres until venues are verified.
// Geolocation remains in memory; it is never embedded in outbound map URLs.
export const MAP_PLACES = Object.freeze([
  {label:'Faringdon',lat:51.658,lng:-1.585},
  {label:'Stanford in the Vale',lat:51.638,lng:-1.507},
  {label:'Shrivenham',lat:51.599,lng:-1.654},
  {label:'Watchfield',lat:51.615,lng:-1.652},
  {label:'Uffington',lat:51.603,lng:-1.566},
  {label:'Longcot',lat:51.617,lng:-1.604},
  {label:'Great Coxwell',lat:51.638,lng:-1.608},
  {label:'Southmoor',lat:51.683,lng:-1.429},
  {label:'Kingston Bagpuize',lat:51.682,lng:-1.410}
]);

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const normalized = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ');
const pointIsValid = point => Boolean(point && typeof point.lat === 'number' && typeof point.lng === 'number' && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180);

export function resolveLocation(query) {
  const clean = normalized(query);
  if (!clean) return null;
  const place = MAP_PLACES.find(place => normalized(place.label) === clean || `${normalized(place.label)}, oxfordshire` === clean);
  if (place) return {...place,approximate:true,source:'settlement'};
  // SN7 covers several villages: this fallback is deliberately district-level.
  if (/^sn7(?:\s*\d[a-z]{2})?$/.test(clean)) return {...MAP_PLACES[0],label:'SN7 area, using Faringdon centre',approximate:true,source:'postcode-district'};
  return null;
}

export function groupLocation(group) {
  if (pointIsValid(group?.location)) return {...group.location,approximate:group.location.approximate !== false,label:group.location.label || group.venue || group.area};
  return resolveLocation(group?.area);
}

export function distanceMiles(from,to) {
  if (!pointIsValid(from) || !pointIsValid(to)) return null;
  const radians = degrees => degrees * Math.PI / 180;
  const latDistance = radians(to.lat-from.lat),lngDistance = radians(to.lng-from.lng);
  const a = Math.sin(latDistance/2)**2 + Math.cos(radians(from.lat))*Math.cos(radians(to.lat))*Math.sin(lngDistance/2)**2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a)));
}

function venueQuery(group) {
  const venue = String(group?.venue || '').replace(/\bWHMP\b/gi,'White Horse Medical Practice');
  return [venue,group?.area,'United Kingdom'].filter(Boolean).join(', ').slice(0,350);
}

export function googleMapUrl(groupOrQuery) {
  const query = typeof groupOrQuery === 'string' ? groupOrQuery.slice(0,350) : venueQuery(groupOrQuery);
  return 'https://www.google.com/maps/search/?' + new URLSearchParams({api:'1',query});
}

export function directionsUrl(group) {
  // Omit origin: Google can ask the visitor where they want to start.
  return 'https://www.google.com/maps/dir/?' + new URLSearchParams({api:'1',destination:venueQuery(group)});
}

export function mapResults({groups=[],search='',category='all',area='all',origin=null,radius='all'}={}) {
  const term = normalized(search);
  const limit = radius === 'all' ? null : Number(radius);
  const hasLimit = pointIsValid(origin) && Number.isFinite(limit) && limit > 0;
  return groups.filter(group => group.status === 'published' && (category === 'all' || group.category === category) && (area === 'all' || group.area === area) && normalized([group.name,group.description,group.venue,group.area,group.category].join(' ')).includes(term))
    .map(group => ({group,location:groupLocation(group),distance:distanceMiles(origin,groupLocation(group))}))
    .filter(result => !hasLimit || (result.distance !== null && result.distance <= limit))
    .sort((left,right) => pointIsValid(origin) ? (left.distance ?? Infinity)-(right.distance ?? Infinity) || left.group.name.localeCompare(right.group.name) : left.group.name.localeCompare(right.group.name));
}

const option = (value,label,selected) => `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
const externalLink = (label,url,extra='') => `<a class="btn ${extra}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} <span aria-hidden="true">↗</span><span class="sr-only"> (opens Google Maps in a new tab)</span></a>`;
function distanceLabel(result) {
  if (result.distance === null) return 'Distance unavailable';
  return `${result.distance < .1 ? 'Under 0.1' : result.distance.toFixed(1)} miles · estimated straight line`;
}

export function renderMap({groups=[],search='',category='all',area='all',origin=null,selectedId='',radius='all',locationQuery=''}={}) {
  const results = mapResults({groups,search,category,area,origin,radius});
  const hasOrigin = pointIsValid(origin);
  const selected = results.find(result => result.group.id === selectedId) || results[0];
  const categories = [...new Set(groups.filter(group => group.status === 'published').map(group => group.category))].sort();
  const areas = [...new Set(groups.filter(group => group.status === 'published').map(group => group.area))].sort();
  const unresolved = Boolean(locationQuery.trim() && !hasOrigin);
  return `<section class="map-discovery" aria-label="Find a community activity">
    <form class="map-search-form panel" data-form="map-search">
      <label class="field">Group, interest or venue<input name="mapQuery" value="${escapeHtml(search)}" placeholder="e.g. Digital Café, walking or library" maxlength="100"></label>
      <label class="field">Find near a town or village<input name="mapLocation" value="${escapeHtml(locationQuery)}" list="huddle-map-places" placeholder="e.g. Faringdon, Southmoor or SN7" maxlength="100"><datalist id="huddle-map-places">${MAP_PLACES.map(place => option(place.label,place.label)).join('')}</datalist></label>
      <button class="btn primary" type="submit">Find activities</button>
      <button class="btn" type="button" data-action="map-locate">Use my location</button>
    </form>
    <div class="map-filter-row">
      <label class="field">Activity type<select data-change="mapCategory">${option('all','All activity types',category)}${categories.map(value=>option(value,value,category)).join('')}</select></label>
      <label class="field">Activity area<select data-change="mapArea">${option('all','All towns & villages',area)}${areas.map(value=>option(value,value,area)).join('')}</select></label>
      <label class="field">Distance from your search<select data-change="mapRadius"${!hasOrigin?' disabled':''}>${[['all','Any distance'],['1','Within 1 mile'],['3','Within 3 miles'],['5','Within 5 miles'],['10','Within 10 miles'],['20','Within 20 miles']].map(([value,label])=>option(value,label,radius)).join('')}</select></label>
    </div>
    ${hasOrigin?`<div class="map-origin"><div><strong>Near ${escapeHtml(origin.label||'your current location')}</strong><p>${origin.approximate?'Using an approximate area centre.':'Your position is used on this page only.'} Results are sorted by estimated straight-line distance to each activity’s area centre.</p></div><button class="btn" data-action="map-clear-location">Clear location</button></div>`:`<p class="map-helper">Choose a local town or allow your location to sort nearby activities. SN7 searches use Faringdon centre; they do not pinpoint a full postcode.</p>`}
    ${unresolved?`<div class="map-unresolved" role="status"><p>We cannot locate “${escapeHtml(locationQuery)}” in this local preview. Choose one of the towns above, or search for that place in Google Maps.</p>${externalLink('Search this place on Google Maps',googleMapUrl(locationQuery+', United Kingdom'))}</div>`:''}
    <div class="map-result-heading"><h2>${results.length} ${results.length===1?'activity':'activities'} found</h2><p>Published groups only · choose an activity to preview its venue.</p></div>
    <div class="map-layout">
      <div class="map-results" aria-label="Activity results">${results.length?results.map(result=>`<article class="map-result${result===selected?' selected':''}"><span class="map-category">${escapeHtml(result.group.category)} · ${escapeHtml(result.group.area)}</span><h3>${escapeHtml(result.group.name)}</h3><p>${escapeHtml(result.group.venue)}</p>${hasOrigin?`<p class="map-distance">${escapeHtml(distanceLabel(result))}</p>`:''}<div class="actions"><button class="btn${result===selected?' primary':''}" data-action="map-select" data-id="${escapeHtml(result.group.id)}" aria-pressed="${result===selected}">${result===selected?'Venue shown':'Show on map'}</button><button class="btn" data-action="group" data-id="${escapeHtml(result.group.id)}">Group & dates</button></div></article>`).join(''):`<div class="map-empty"><h3>No activities match yet</h3><p>Try another interest, a wider distance or “All towns & villages”.</p><button class="btn" data-action="map-reset">Clear all map filters</button></div>`}</div>
      <section class="map-preview panel" aria-label="Selected venue map">${selected?`<div class="map-preview-head"><span class="map-category">GOOGLE MAPS · SELECTED VENUE</span><h2>${escapeHtml(selected.group.name)}</h2><p>${escapeHtml(selected.group.venue)} · ${escapeHtml(selected.group.area)}</p></div><iframe title="Google map for ${escapeHtml(selected.group.venue)}, ${escapeHtml(selected.group.area)}" src="https://maps.google.com/maps?${escapeHtml(new URLSearchParams({q:venueQuery(selected.group),z:'14',output:'embed'}).toString())}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe><div class="map-preview-footer"><div class="actions">${externalLink('Open Google Maps',googleMapUrl(selected.group))}${externalLink('Get directions',directionsUrl(selected.group),'primary')}</div><p>Google searches the named venue. Please check the exact meeting point with the group. If the preview does not load, use Open Google Maps.</p></div>`:`<div class="map-empty"><h3>Your selected venue will appear here</h3><p>Choose an activity from the results to explore its location.</p></div>`}</section>
    </div>
    <p class="map-footnote">This preview shows one selected venue at a time. Nearby distances use approximate town or village centres, not measured journeys or accessibility information. Your browser location is not saved or passed into Google links.</p>
  </section>`;
}
