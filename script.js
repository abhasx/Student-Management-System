// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
let sb = null;           // supabase client
let TABLE = 'students';
let students = [];
let isDemo = false;
let filterStatus = 'all';
let currentPage = 1;
const PER = 8;
let searchQ = '';

// ── Boot ──
(function boot() {
  const cfg = loadCfg();
  if (cfg) { fillDrawer(cfg); connect(cfg); }
  else if (localStorage.getItem('sms_demo') === '1') { enableDemo(true); }
})();

// ════════════════════════════════════════
// SUPABASE
// ════════════════════════════════════════
function connect(cfg) {
  try {
    sb = supabase.createClient(cfg.url, cfg.key);
    TABLE = cfg.table || 'students';
    setStatus('connecting');
    fetchAll();
  } catch(e) { setStatus('off'); toast('Config error: ' + e.message, 'err'); }
}

async function fetchAll() {
  if (isDemo) return;
  setStatus('connecting');
  try {
    const { data, error } = await sb.from(TABLE).select('*').order('created_at', { ascending: false });
    if (error) throw error;
    students = (data || []).map(normalise);
    setStatus('on');
    refreshAll();
  } catch(e) {
    setStatus('off');
    toast('Supabase error: ' + e.message, 'err');
    students = [];
    refreshAll();
  }
}

async function dbInsert(doc) {
  if (isDemo) { doc.id = 'demo-' + Date.now(); students.unshift(doc); return doc; }
  const { data, error } = await sb.from(TABLE).insert([doc]).select().single();
  if (error) throw error;
  return normalise(data);
}

async function dbUpdate(id, doc) {
  if (isDemo) { const i = students.findIndex(s=>s.id===id); if(i>=0) students[i]={...doc,id}; return; }
  const { error } = await sb.from(TABLE).update(doc).eq('id', id);
  if (error) throw error;
}

async function dbDelete(id) {
  if (isDemo) { students = students.filter(s=>s.id!==id); return; }
  const { error } = await sb.from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

function normalise(r) {
  return { ...r, id: r.id || r._id, fname: r.fname||'', lname: r.lname||'', gpa: r.gpa!=null?parseFloat(r.gpa):null };
}

// ════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════
function loadCfg() {
  try { const c=localStorage.getItem('sms_sbcfg'); return c?JSON.parse(c):null; } catch{ return null; }
}
function fillDrawer(cfg) {
  document.getElementById('cfg-url').value = cfg.url||'';
  document.getElementById('cfg-key').value = cfg.key||'';
  document.getElementById('cfg-table').value = cfg.table||'students';
}
function saveConfig() {
  const cfg = {
    url: document.getElementById('cfg-url').value.trim().replace(/\/+$/,''),
    key: document.getElementById('cfg-key').value.trim(),
    table: document.getElementById('cfg-table').value.trim()||'students'
  };
  if (!cfg.url || !cfg.key) { toast('URL and key are required', 'err'); return; }
  localStorage.setItem('sms_sbcfg', JSON.stringify(cfg));
  localStorage.removeItem('sms_demo');
  isDemo = false;
  closeDrawer();
  connect(cfg);
  toast('Connecting to Supabase…', 'info');
}
async function testConn() {
  const url = document.getElementById('cfg-url').value.trim().replace(/\/+$/,'');
  const key = document.getElementById('cfg-key').value.trim();
  const tbl = document.getElementById('cfg-table').value.trim()||'students';
  const box = document.getElementById('test-box');
  box.className='test-box'; box.textContent='Testing…'; box.style.display='block';
  try {
    const client = supabase.createClient(url, key);
    const { error } = await client.from(tbl).select('id').limit(1);
    if (error) throw error;
    box.className='test-box ok'; box.textContent='✓ Connected successfully!';
  } catch(e) {
    box.className='test-box err'; box.textContent='✕ ' + e.message;
  }
}

// ════════════════════════════════════════
// DEMO
// ════════════════════════════════════════
function enableDemo(silent=false) {
  isDemo = true;
  localStorage.setItem('sms_demo','1');
  students = makeDemoData();
  setStatus('demo');
  closeDrawer();
  refreshAll();
  if (!silent) toast('Demo mode — 24 sample students loaded', 'info');
}
function makeDemoData() {
  // Updated courses list
  const courses = ['BTech', 'MBA', 'BBA', 'BSc', 'BCom', 'BEd', 'BCA'];
  const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
  const statuses = ['active','active','active','active','active','active','inactive','probation'];
  const names = [
    ['Aarav','Sharma'],['Priya','Patel'],['Rohan','Gupta'],['Ananya','Singh'],
    ['Kabir','Kumar'],['Sneha','Verma'],['Arjun','Mehta'],['Divya','Reddy'],
    ['Vivaan','Joshi'],['Meera','Nair'],['Aditya','Iyer'],['Kavya','Das'],
    ['Ishaan','Rao'],['Pooja','Pillai'],['Vihaan','Shah'],['Riya','Chaudhary'],
    ['Arnav','Malhotra'],['Simran','Kaur'],['Dhruv','Saxena'],['Tanya','Mishra'],
    ['Rehan','Khan'],['Aisha','Siddiqui'],['Siddharth','Bose'],['Neha','Ghosh']
  ];
  return names.map(([fname,lname],i)=>({
    id: 'demo-'+i, fname, lname,
    email: `${fname.toLowerCase()}.${lname.toLowerCase()}@scholr.edu`,
    sid: `STU-${String(2400+i).padStart(4,'0')}`,
    course: courses[i % courses.length],
    year: years[i % years.length],
    // CGPA on 0–10 scale
    gpa: parseFloat((4 + Math.random() * 6).toFixed(2)),
    status: statuses[i % statuses.length],
    phone: `+91 ${Math.floor(70000+Math.random()*29999)} ${Math.floor(10000+Math.random()*89999)}`,
    created_at: new Date(Date.now()-i*864e5).toISOString()
  }));
}

// ════════════════════════════════════════
// STATUS
// ════════════════════════════════════════
function setStatus(s) {
  const dot=document.getElementById('db-dot'), lbl=document.getElementById('db-label');
  dot.className='db-dot';
  if(s==='on'||s==='demo'){dot.classList.add('on');lbl.textContent=s==='demo'?'Demo mode':'Connected';}
  else if(s==='connecting'){dot.classList.add('pulse');lbl.textContent='Connecting…';}
  else{lbl.textContent='Not connected';}
}

// ════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════
document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    el.classList.add('active');
    const pg=el.dataset.page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+pg).classList.add('active');
    document.getElementById('bc-current').textContent=el.textContent.trim();
    document.getElementById('search-box').style.display=pg==='students'?'block':'none';
    document.getElementById('add-btn').style.display=pg==='students'?'':'none';
    if(pg==='grades') renderGrades();
  });
});
document.getElementById('open-config-btn').addEventListener('click',openDrawer);
document.getElementById('db-status-pill').addEventListener('click',openDrawer);
document.getElementById('close-drawer').addEventListener('click',closeDrawer);
document.getElementById('add-btn').addEventListener('click',openAdd);
document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target===document.getElementById('modal-overlay'))closeModal();});

function openDrawer(){document.getElementById('drawer').classList.add('open');}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');}

// ════════════════════════════════════════
// RENDER HELPERS
// ════════════════════════════════════════
function refreshAll(){
  document.getElementById('nav-count').textContent=students.length;
  renderDash();
  renderStudents();
}

// ── Dashboard ──
function renderDash(){
  const active=students.filter(s=>s.status==='active').length;
  const prob=students.filter(s=>s.status==='probation').length;
  const gpas=students.map(s=>s.gpa).filter(g=>g!=null&&!isNaN(g));
  const avgGpa=gpas.length?(gpas.reduce((a,b)=>a+b,0)/gpas.length).toFixed(2):'—';
  const courses=new Set(students.map(s=>s.course).filter(Boolean));
  document.getElementById('s-total').textContent=students.length||'0';
  document.getElementById('s-active-sub').textContent=active+' active enrolled';
  document.getElementById('s-gpa').textContent=avgGpa;
  document.getElementById('s-courses').textContent=courses.size||'0';
  document.getElementById('s-prob').textContent=prob||'0';
  renderCourseChart();
  renderStatusChart();
  renderRecent();
}

function renderCourseChart(){
  const el=document.getElementById('course-chart');
  const counts={};
  students.forEach(s=>{if(s.course) counts[s.course]=(counts[s.course]||0)+1;});
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,7);
  if(!sorted.length){el.innerHTML='<div class="empty"><p>No data yet</p></div>';return;}
  const max=sorted[0][1];
  el.innerHTML=`<div class="chart-label">Top Courses</div>`+sorted.map(([name,ct])=>`
    <div class="h-bar-row">
      <div class="h-bar-name" title="${name}">${name}</div>
      <div class="h-bar-track"><div class="h-bar-fill" style="width:${Math.round(ct/max*100)}%"></div></div>
      <div class="h-bar-ct">${ct}</div>
    </div>`).join('');
}

function renderStatusChart(){
  const el=document.getElementById('status-chart');
  const total=students.length;
  if(!total){el.innerHTML='<div class="empty"><p>No data</p></div>';return;}
  const counts={active:0,inactive:0,probation:0};
  students.forEach(s=>{ if(counts[s.status]!=null) counts[s.status]++; });
  const colors={active:'var(--green)',inactive:'var(--ink4)',probation:'var(--amber)'};
  const labels={active:'Active',inactive:'Inactive',probation:'Probation'};
  el.innerHTML=`<div class="chart-label">By Status</div>`+Object.entries(counts).map(([st,ct])=>`
    <div class="h-bar-row">
      <div class="h-bar-name">${labels[st]}</div>
      <div class="h-bar-track"><div class="h-bar-fill" style="width:${total?Math.round(ct/total*100):0}%;background:${colors[st]}"></div></div>
      <div class="h-bar-ct">${ct}</div>
    </div>`).join('');
}

function renderRecent(){
  const el=document.getElementById('recent-body');
  const recent=students.slice(0,6);
  if(!recent.length){el.innerHTML=emptyState('No students added yet');return;}
  el.innerHTML=buildTable(recent,false);
}

// ── Students ──
function filteredStudents(){
  let data=students;
  if(searchQ) data=data.filter(s=>(s.fname+' '+s.lname+' '+s.email+' '+s.sid+' '+s.course).toLowerCase().includes(searchQ));
  if(filterStatus!=='all') data=data.filter(s=>s.status===filterStatus);
  return data;
}

function renderStudents(){
  const all=filteredStudents();
  const pages=Math.max(1,Math.ceil(all.length/PER));
  if(currentPage>pages) currentPage=1;
  const slice=all.slice((currentPage-1)*PER, currentPage*PER);
  const el=document.getElementById('students-body');
  el.innerHTML=slice.length?buildTable(slice,true):emptyState('No students found');
  document.getElementById('pager-info').textContent=all.length?`Showing ${(currentPage-1)*PER+1}–${Math.min(currentPage*PER,all.length)} of ${all.length}`:'0 results';
  const pb=document.getElementById('pager-btns');
  pb.innerHTML=Array.from({length:pages},(_,i)=>`<button class="pager-btn${i+1===currentPage?' active':''}" onclick="goPage(${i+1})">${i+1}</button>`).join('');
}

function goPage(p){currentPage=p;renderStudents();}

document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    t.classList.add('active');
    filterStatus=t.dataset.filter;
    currentPage=1;
    renderStudents();
  });
});
document.getElementById('search-input').addEventListener('input',e=>{
  searchQ=e.target.value.toLowerCase(); currentPage=1; renderStudents();
});

// ── Table builder ──
function buildTable(data, actions){
  const cols=actions
    ? '<th>Student</th><th>Course</th><th>Year</th><th>CGPA</th><th>Status</th><th>Actions</th>'
    : '<th>Student</th><th>Course</th><th>CGPA</th><th>Status</th>';
  const rows=data.map(s=>studentRow(s,actions)).join('');
  return `<table><thead><tr>${cols}</tr></thead><tbody>${rows}</tbody></table>`;
}

// CGPA 0–10 colour thresholds
function cgpaColor(gpa) {
  if (gpa == null) return 'var(--ink4)';
  if (gpa >= 9.0) return 'var(--green)';
  if (gpa >= 7.5) return 'var(--blue)';
  if (gpa >= 6.0) return 'var(--amber)';
  if (gpa >= 4.0) return 'var(--red)';
  return '#9b59b6';
}

function studentRow(s, actions){
  const name=((s.fname||'')+' '+(s.lname||'')).trim()||'—';
  const ini=((s.fname||'')[0]||'')+((s.lname||'')[0]||'');
  const palette=[['#e8f5ee','#1a6b4a'],['#eef3fc','#1e4fa0'],['#fef5e7','#b7620e'],['#fdf0ee','#c0392b'],['#f3effe','#6d28d9'],['#e0fdf4','#0f766e']];
  const [bg,fg]=palette[(s.fname||'').charCodeAt(0)%palette.length];
  const gpa=s.gpa!=null?parseFloat(s.gpa):null;
  const gpaTxt=gpa!=null?gpa.toFixed(2):'—';
  const gpaCol=cgpaColor(gpa);
  const statusMap={active:['badge-green','Active'],inactive:['badge-amber','Inactive'],probation:['badge-red','Probation']};
  const [sc,sl]=statusMap[s.status]||['badge-blue',s.status||'Active'];
  const actCols=actions?`<td>${s.year||'—'}</td>`:'';
  const actBtn=actions?`<td><div class="action-row">
    <button class="btn btn-outline btn-sm" onclick="openEdit('${s.id}')">Edit</button>
    <button class="btn btn-danger btn-sm" onclick="confirmDel('${s.id}')">Delete</button>
  </div></td>`:'';
  return `<tr>
    <td><div class="stu-cell">
      <div class="avatar" style="background:${bg};color:${fg}">${ini||'?'}</div>
      <div><div class="stu-name">${name}</div><div class="stu-meta">${s.sid||s.email||''}</div></div>
    </div></td>
    <td>${s.course||'—'}</td>
    ${actCols}
    <td><span class="gpa-pill" style="background:${gpaCol}18;color:${gpaCol}">${gpaTxt}</span></td>
    <td><span class="badge ${sc}">${sl}</span></td>
    ${actBtn}
  </tr>`;
}

// ── Grades ──
// Updated grade distribution for CGPA 0–10 scale
function renderGrades(){
  // Grade bands: O (9-10), A+ (8-9), A (7-8), B+ (6-7), B (5-6), C (<5)
  const dist={O:[],Aplus:[],A:[],Bplus:[],B:[],C:[]};
  students.forEach(s=>{
    const g=s.gpa;
    if(g==null||isNaN(g)) return;
    if(g>=9.0)       dist.O.push(s);
    else if(g>=8.0)  dist.Aplus.push(s);
    else if(g>=7.0)  dist.A.push(s);
    else if(g>=6.0)  dist.Bplus.push(s);
    else if(g>=5.0)  dist.B.push(s);
    else             dist.C.push(s);
  });
  const total=Object.values(dist).reduce((a,b)=>a+b.length,0);
  const meta={
    O:    {r:'9.00–10.00', c:'var(--green)',  label:'O'},
    Aplus:{r:'8.00–8.99',  c:'var(--blue)',   label:'A+'},
    A:    {r:'7.00–7.99',  c:'#0f766e',       label:'A'},
    Bplus:{r:'6.00–6.99',  c:'var(--amber)',  label:'B+'},
    B:    {r:'5.00–5.99',  c:'var(--red)',    label:'B'},
    C:    {r:'0.00–4.99',  c:'#9b59b6',       label:'C'},
  };

  document.getElementById('grade-tiles').innerHTML=Object.entries(dist).map(([g,arr])=>`
    <div class="grade-tile">
      <div class="grade-letter" style="color:${meta[g].c}">${meta[g].label}</div>
      <div class="grade-range">${meta[g].r}</div>
      <div class="grade-count">${arr.length}</div>
      <div class="grade-pct">${total?Math.round(arr.length/total*100):0}%</div>
    </div>`).join('');

  const sorted=[...students].filter(s=>s.gpa!=null).sort((a,b)=>b.gpa-a.gpa);
  document.getElementById('grades-body').innerHTML=sorted.length?`
    <table><thead><tr><th>Student</th><th>Course</th><th>CGPA</th><th>Grade</th><th>Status</th></tr></thead>
    <tbody>${sorted.map(s=>{
      const g=s.gpa;
      let grade, gradeKey;
      if(g>=9.0){gradeKey='O';} else if(g>=8.0){gradeKey='Aplus';} else if(g>=7.0){gradeKey='A';}
      else if(g>=6.0){gradeKey='Bplus';} else if(g>=5.0){gradeKey='B';} else {gradeKey='C';}
      grade=meta[gradeKey].label;
      const c=meta[gradeKey].c;
      const name=((s.fname||'')+' '+(s.lname||'')).trim();
      const ini=((s.fname||'')[0]||'')+((s.lname||'')[0]||'');
      const bg=c+'18';
      const statusMap={active:['badge-green','Active'],inactive:['badge-amber','Inactive'],probation:['badge-red','Probation']};
      const [sc,sl]=statusMap[s.status]||['badge-blue',s.status||'Active'];
      return `<tr>
        <td><div class="stu-cell">
          <div class="avatar" style="background:${bg};color:${c}">${ini}</div>
          <div><div class="stu-name">${name}</div><div class="stu-meta">${s.sid||''}</div></div>
        </div></td>
        <td>${s.course||'—'}</td>
        <td><span class="gpa-pill" style="background:${bg};color:${c}">${g.toFixed(2)}</span></td>
        <td><span class="gpa-pill" style="background:${bg};color:${c};font-size:13px;padding:4px 12px">${grade}</span></td>
        <td><span class="badge ${sc}">${sl}</span></td>
      </tr>`;
    }).join('')}</tbody></table>`
  :emptyState('No grade data available');
}

// ════════════════════════════════════════
// MODAL
// ════════════════════════════════════════
function openAdd(){
  document.getElementById('modal-title').textContent='Add Student';
  document.getElementById('modal-sub').textContent='Fill in the details below';
  document.getElementById('edit-id').value='';
  ['fname','lname','email','sid','course','year','gpa','phone'].forEach(f=>document.getElementById('f-'+f).value='');
  document.getElementById('f-status').value='active';
  document.getElementById('modal-overlay').classList.add('open');
}
function openEdit(id){
  const s=students.find(x=>x.id===id);
  if(!s) return;
  document.getElementById('modal-title').textContent='Edit Student';
  document.getElementById('modal-sub').textContent='Update the student record';
  document.getElementById('edit-id').value=id;
  document.getElementById('f-fname').value=s.fname||'';
  document.getElementById('f-lname').value=s.lname||'';
  document.getElementById('f-email').value=s.email||'';
  document.getElementById('f-sid').value=s.sid||'';
  document.getElementById('f-course').value=s.course||'';
  document.getElementById('f-year').value=s.year||'';
  document.getElementById('f-gpa').value=s.gpa!=null?s.gpa:'';
  document.getElementById('f-status').value=s.status||'active';
  document.getElementById('f-phone').value=s.phone||'';
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open');}

async function saveStudent(){
  const fname=document.getElementById('f-fname').value.trim();
  const lname=document.getElementById('f-lname').value.trim();
  const email=document.getElementById('f-email').value.trim();
  if(!fname||!lname||!email){toast('First name, last name & email are required','err');return;}
  const gpaRaw=document.getElementById('f-gpa').value;
  const gpaVal=gpaRaw?parseFloat(gpaRaw):null;
  // Validate CGPA 0-10
  if(gpaVal!=null&&(gpaVal<0||gpaVal>10)){toast('CGPA must be between 0.00 and 10.00','err');return;}
  const doc={
    fname,lname,email,
    sid:document.getElementById('f-sid').value.trim(),
    course:document.getElementById('f-course').value,
    year:document.getElementById('f-year').value,
    gpa:gpaVal,
    status:document.getElementById('f-status').value,
    phone:document.getElementById('f-phone').value.trim()
  };
  const id=document.getElementById('edit-id').value;
  const btn=document.getElementById('save-btn');
  btn.innerHTML='<div class="spinner"></div> Saving…'; btn.disabled=true;
  try {
    if(id){
      await dbUpdate(id,doc);
      if(!isDemo){const i=students.findIndex(s=>s.id===id);if(i>=0)students[i]={...doc,id};}
      toast('Student updated!','ok');
    } else {
      const saved=await dbInsert({...doc,created_at:new Date().toISOString()});
      if(!isDemo) students.unshift(saved);
      toast('Student added!','ok');
    }
    closeModal(); refreshAll();
  } catch(e){ toast('Error: '+e.message,'err'); }
  finally{btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Save Student';btn.disabled=false;}
}

async function confirmDel(id){
  const s=students.find(x=>x.id===id);
  if(!s||!confirm(`Delete ${s.fname} ${s.lname}? This cannot be undone.`)) return;
  try{
    await dbDelete(id);
    if(!isDemo) students=students.filter(x=>x.id!==id);
    refreshAll(); toast('Student deleted','info');
  }catch(e){toast('Error: '+e.message,'err');}
}

// ════════════════════════════════════════
// TOAST
// ════════════════════════════════════════
function toast(msg,type='info'){
  const el=document.createElement('div');
  el.className='toast '+type;
  const icon={ok:'✓',err:'✕',info:'ℹ'}[type]||'•';
  el.innerHTML=`<strong>${icon}</strong> ${msg}`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>el.remove(),3800);
}

function emptyState(msg){
  return `<div class="empty"><div class="empty-icon">◌</div><p>${msg}</p></div>`;
}
