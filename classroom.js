// Only assigned classroom work is shared. Personal lessons stay in study_state.
let classroomCache={rooms:[],members:[],progress:[]};
function classroomPanel(){
 const owned=classroomCache.rooms.find(r=>r.owner_id===session?.user.id);
 const joined=classroomCache.rooms.filter(r=>r.owner_id!==session?.user.id);
 return `<section class="panel"><p class="eyebrow">TEACH & LEARN</p><h3>老师与学生的补习室</h3>${!session?'<p class="hint">先在下方登录：老师发布教材，学生通过邀请码加入。学习笔记和复述会提交给本班老师批改。</p>':`<div class="actions"><button id="publish-class" class="solid">${owned?'更新教材库':'我是老师 · 发布教材库'}</button><button id="join-class">我是学生 · 邀请码加入</button><button id="refresh-class">刷新补习室</button></div><p class="hint">发布会共享你录入的全部个人教材原文和关键词；不会发布你自己的批注或历史。修改教材后自动更新。</p>${owned?`<div class="class-invite"><label>给学生的邀请码</label><input readonly value="${esc(owned.invite_code)}" aria-label="补习室邀请码"><button id="copy-invite" class="small" style="margin-top:10px">复制邀请码</button><p class="hint">只有登录并持有邀请码的学生可以加入。加入时会同意把本班学习笔记、复述和完成记录交给你查看。</p></div><h3 style="margin-top:26px">学生学习状况</h3>${teacherStudents(owned)}`:''}${joined.map(r=>`<div class="record"><h3>${esc(r.title)}</h3><p class="hint">已加入 · ${r.materials.length} 份教材。仅本班教材的笔记与学习记录会同步给老师。</p>${studentFeedback(r.id)}</div>`).join('')}`}</section>`;
}
function teacherStudents(room){
 const members=classroomCache.members.filter(m=>m.classroom_id===room.id);
 if(!members.length)return '<p class="hint">还没有学生加入。将上面的邀请码发给朋友即可。</p>';
 return members.map(m=>{
  const p=classroomCache.progress.find(p=>p.classroom_id===room.id&&p.student_id===m.student_id);
  const records=p?.payload?.records||[],items=p?.payload?.items||[];
  return `<div class="record"><h3>${esc(m.display_name)}</h3><p class="hint">完成 ${records.length} 次 · ${Math.round(records.reduce((n,r)=>n+(r.seconds||0),0)/60)} 分钟${p?' · 最近同步 '+new Date(p.updated_at).toLocaleString('zh-CN'):''}</p><button class="small" data-student="${esc(m.student_id)}" data-room="${esc(room.id)}">查看笔记与批改 (${items.length} 份材料)</button></div>`;
 }).join('');
}
function studentFeedback(roomId){const p=classroomCache.progress.find(p=>p.classroom_id===roomId&&p.student_id===session?.user.id);return (p?.feedback||[]).slice().reverse().map(f=>`<div class="teacher-feedback"><strong>老师批注 · ${esc(f.target||'整体反馈')}</strong><p>${esc(f.text)}</p><small>${new Date(f.date).toLocaleString('zh-CN')}</small></div>`).join('')||'<p class="hint">老师暂未留下批注。</p>'}
function bindClassroom(){
 const on=(s,f)=>{if($(s))$(s).onclick=f};
 on('#publish-class',async()=>{if(!session)return;try{await queueSync(true);await api('/rest/v1/rpc/publish_classroom',{method:'POST',body:JSON.stringify({new_materials:publicLessons()})},session.access_token);await queueSync(true);render();toast('教材库已发布，把邀请码发给朋友即可。')}catch(e){toast(e.message)}});
 on('#refresh-class',async()=>{await queueSync(true);render()});
 on('#copy-invite',async()=>{const room=classroomCache.rooms.find(r=>r.owner_id===session?.user.id);try{await navigator.clipboard.writeText(room.invite_code);toast('邀请码已复制')}catch{toast('请长按邀请码复制')}});
 on('#join-class',joinClassroomDialog);
 document.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>studentReview(b.dataset.room,b.dataset.student));
}
function publicLessons(){return visibleItems().filter(i=>!i.classroomId).map(({id,title,body,type,keywords,updatedAt})=>({id,title,body,type,keywords:keywords||[],updatedAt}))}
function joinClassroomDialog(){
 const d=$('#modal');d.innerHTML=`<form id="join-form"><h2>加入老师的补习室</h2><label for="class-code">邀请码</label><input id="class-code" required placeholder="老师发给你的邀请码"><label for="student-name">老师看到的名字</label><input id="student-name" maxlength="60" required><p class="hint">加入后，本班教材的阅读批注、复述、科学笔记和完成记录会提交给老师，用于检查和批改。你的私人材料不会共享。</p><label class="consent"><input type="checkbox" id="class-consent" required> 我同意把本班学习情况和笔记提交给老师。</label><div class="actions"><button class="solid" type="submit">同意并加入</button><button type="button" id="cancel-join">取消</button></div></form>`;d.showModal();$('#cancel-join').onclick=()=>d.close();$('#join-form').onsubmit=async e=>{e.preventDefault();const code=$('#class-code').value.trim();if(!/^[0-9a-f-]{36}$/i.test(code))return toast('请检查邀请码格式');try{await queueSync(true);await api('/rest/v1/rpc/join_classroom',{method:'POST',body:JSON.stringify({code,student_name:$('#student-name').value.trim()})},session.access_token);d.close();await queueSync(true);render();toast('已加入，教材已经放进你的学习列表。')}catch(e){toast(e.message)}};
}
function studentReview(room,student){
 const m=classroomCache.members.find(m=>m.classroom_id===room&&m.student_id===student);
 const p=classroomCache.progress.find(p=>p.classroom_id===room&&p.student_id===student);
 const d=$('#modal'),items=p?.payload?.items||[],records=p?.payload?.records||[];
 d.innerHTML=`<div class="topline"><h2 style="font-size:22px;margin:0">${esc(m.display_name)}的学习档案</h2><button id="close-review" class="quiet">关闭</button></div><p class="hint">笔记是学生的原始作答，请自行检查知识点是否正确。</p>${items.map(x=>`<details class="review-material"><summary>${esc(x.title)}</summary><h4>阅读批注</h4><p>${esc(x.notes||'尚未填写')}</p><h4>复述 / 科学笔记</h4><p>${esc(x.recall||'尚未填写')}</p><h4>遗漏与待巩固</h4><p>${esc(x.omissions||'尚未填写')}</p></details>`).join('')||'<p class="hint">学生尚未同步笔记。</p>'}<h3 style="margin-top:24px">完成记录</h3>${records.slice().reverse().map(r=>`<details class="review-material"><summary>${esc(r.title)} · ${new Date(r.date).toLocaleDateString('zh-CN')}</summary><p>${TYPES[r.type]} · ${Math.max(1,Math.round(r.seconds/60))} 分钟${r.type==='words'?` · 完成 ${r.known} 张卡片 / ${r.attempts} 次作答`:''}</p><p>${esc(r.recall||'无文字复述')}</p><p>待巩固：${esc(r.omissions||'无')}</p></details>`).join('')||'<p class="hint">尚未完成学习。</p>'}${p?`<form id="feedback-form"><label for="feedback-target">批改对象</label><select id="feedback-target"><option>整体反馈</option>${items.map(i=>`<option>${esc(i.title)}</option>`).join('')}</select><label for="feedback-text">给学生的批注 / 订正建议</label><textarea id="feedback-text" required maxlength="5000" placeholder="例如：这里遗漏了适用条件，请补充后再复述一遍。"></textarea><button class="solid">保存批注</button></form>`:''}<h3 style="margin-top:24px">已留批注</h3>${(p?.feedback||[]).slice().reverse().map(f=>`<p class="teacher-feedback">${esc(f.target)}：${esc(f.text)}</p>`).join('')}`;
 d.showModal();$('#close-review').onclick=()=>d.close();if($('#feedback-form'))$('#feedback-form').onsubmit=async e=>{e.preventDefault();try{await api('/rest/v1/rpc/review_classroom_student',{method:'POST',body:JSON.stringify({room_id:room,student,target:$('#feedback-target').value,comment_text:$('#feedback-text').value.trim()})},session.access_token);d.close();await queueSync(true);render();toast('批注已保存，学生同步后可查看。')}catch(e){toast(e.message)}};
}
async function classroomSync(token,owner){
 const rooms=await api('/rest/v1/classrooms?select=*',{},token);
 if(session?.user.id!==owner)return;
 const owned=rooms.find(r=>r.owner_id===owner);
 if(owned)await api('/rest/v1/rpc/publish_classroom',{method:'POST',body:JSON.stringify({new_materials:publicLessons()})},token);
 for(const room of rooms.filter(r=>r.owner_id!==owner)){
  for(const old of data.items.filter(i=>i.classroomId===room.id)){
   const removed=!room.materials.some(s=>s.id===old.sourceId);
   if(Boolean(old.sourceRemoved)!==removed){old.sourceRemoved=removed;old.updatedAt=now()}
  }
  for(const source of room.materials){
   let item=data.items.find(i=>i.classroomId===room.id&&i.sourceId===source.id);
   if(!item){item={id:uid(),classroomId:room.id,sourceId:source.id};data.items.push(item)}
   if(item.sourceUpdatedAt!==source.updatedAt){Object.assign(item,{title:source.title,type:source.type,body:source.body,keywords:source.keywords||[],sourceUpdatedAt:source.updatedAt,updatedAt:now()})}
  }
  const assigned=data.items.filter(i=>i.classroomId===room.id&&!i.deleted);
  const payload={items:assigned.map(({id,sourceId,title,notes,recall,omissions,updatedAt})=>({id,sourceId,title,notes:notes||'',recall:recall||'',omissions:omissions||'',updatedAt})),records:data.records.filter(r=>r.classroomId===room.id&&!r.deleted)};
  await api('/rest/v1/rpc/submit_classroom_progress',{method:'POST',body:JSON.stringify({room_id:room.id,new_payload:payload})},token);
 }
 const [members,progress]=await Promise.all([api('/rest/v1/classroom_members?select=*',{},token),api('/rest/v1/classroom_progress?select=*',{},token)]);
 if(session?.user.id===owner)classroomCache={rooms,members,progress};
}
