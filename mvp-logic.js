(function(){
const UNDO_WINDOW_MS=7000;
const ACTION_LIMIT=12;
const rankKeysMvp=['E','D','C','B','A','S'];
let activeHunterChallenge=null;
let activeToastTimer=null;
let activeBossTimer=null;
const baseDefaultStateMvp=defaultState;

defaultState=function(){
  const base=baseDefaultStateMvp();
  return {...base,actions:[],hunterExams:base.hunterExams||[],hunterRankXp:Number(base.hunterRankXp||0),hunterAttributes:base.hunterAttributes||null,rusty:base.rusty||{active:false,startedAt:'',maxRankXp:0,currentRankXp:0,lastTrainingDate:'',clearedForTrainingDate:''},bossFight:base.bossFight||{active:false,startedAt:0,endsAt:0,progress:{},status:''}};
};
state=normalizeMvpState(state);

renderAll=function(){
  state=normalizeMvpState(state);
  syncMvpRustyState();
  renderDashboard();
  renderMissions();
  renderAttributes();
  renderAchievements();
  renderWorkouts();
  renderMvpHunterExam();
  renderMvpBossFight();
  renderRanks();
  renderHistory();
  renderRecentActions();
};

document.addEventListener('DOMContentLoaded',()=>{
  setupMvpForm();
  setupMvpHunter();
  setupMvpActions();
  renderAll();
});

function normalizeMvpState(current){
  const fresh=defaultState();
  const next={...fresh,...(current||{})};
  next.totalXp=Number(next.totalXp||0);
  next.week=next.week||{};
  next.records=Array.isArray(next.records)?next.records:[];
  next.actions=Array.isArray(next.actions)?next.actions:[];
  next.hunterExams=Array.isArray(next.hunterExams)?next.hunterExams:[];
  next.hunterRankXp=Number(next.hunterRankXp||0);
  next.hunterAttributes=next.hunterAttributes||null;
  next.rusty={...fresh.rusty,...(next.rusty||{})};
  next.bossFight={...fresh.bossFight,...(next.bossFight||{})};
  next.bossFight.progress=next.bossFight.progress||{};
  return next;
}

function setupMvpForm(){
  const oldForm=document.getElementById('weeklyForm');
  if(!oldForm)return;
  const form=oldForm.cloneNode(true);
  oldForm.parentNode.replaceChild(form,oldForm);
  const dateInput=form.querySelector('#weekDate');
  if(dateInput)dateInput.valueAsDate=new Date();
  const trainingInputs=form.querySelector('#trainingInputs');
  if(trainingInputs){
    trainingInputs.innerHTML=['Segunda','Terca','Quarta','Quinta'].map(day=>`<div class="training-day"><strong>${day}</strong><div class="radio-row"><label><input type="radio" name="${day}" value="none" checked> Nao</label><label><input type="radio" name="${day}" value="complete"> Completo</label><label><input type="radio" name="${day}" value="minimum"> Minimo</label></div></div>`).join('');
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    const record=buildRecord();
    const xp=calculateRecordXp(record);
    state.records.unshift(record);
    form.reset();
    if(dateInput)dateInput.valueAsDate=new Date();
    addXpAction({kind:'weekly-record',label:'Registro semanal',xpDelta:xp,payload:{recordId:record.id}});
    switchTab('historico');
  });
  const clearButton=form.querySelector('#clearDataButton');
  if(clearButton){
    clearButton.addEventListener('click',()=>{
      if(confirm('Apagar todos os registros e XP do Projeto Atlas?')){
        state=defaultState();
        saveState();
        renderAll();
      }
    });
  }
}

function setupMvpHunter(){
  const start=replaceNodeById('startHunterExam');
  const form=replaceNodeById('hunterExamForm');
  if(!start||!form)return;
  const cancel=form.querySelector('#cancelHunterExam');
  start.addEventListener('click',()=>{
    activeHunterChallenge=buildHunterChallenge();
    renderActiveHunterChallenge(activeHunterChallenge);
    const intro=document.getElementById('hunterIntro');
    const result=document.getElementById('hunterResult');
    if(intro)intro.hidden=true;
    form.hidden=false;
    if(result)result.innerHTML='';
  });
  if(cancel){
    cancel.addEventListener('click',()=>{
      activeHunterChallenge=null;
      form.hidden=true;
      const intro=document.getElementById('hunterIntro');
      if(intro)intro.hidden=false;
    });
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();
    finishMvpHunterExam();
  });
}

function setupMvpActions(){
  const reset=replaceNodeById('resetWeekButton');
  if(reset){
    reset.addEventListener('click',()=>{
      state.week={};
      saveState();
      renderAll();
    });
  }
  document.addEventListener('click',event=>{
    const undo=event.target.closest('[data-undo-action]');
    if(undo)undoAction(undo.dataset.undoAction);
    const openBoss=event.target.closest('[data-open-boss]');
    if(openBoss){switchTab('boss');setTimeout(()=>document.getElementById('bossFightPanel')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}
    const startBoss=event.target.closest('[data-mvp-start-boss]');
    if(startBoss)startMvpBossFight();
    const bossInc=event.target.closest('[data-mvp-boss-inc]');
    if(bossInc)updateMvpBossProgress(bossInc.dataset.mvpBossInc,1);
    const bossDec=event.target.closest('[data-mvp-boss-dec]');
    if(bossDec)updateMvpBossProgress(bossDec.dataset.mvpBossDec,-1);
  });
}

function replaceNodeById(id){
  const node=document.getElementById(id);
  if(!node||!node.parentNode)return node;
  const clone=node.cloneNode(true);
  node.parentNode.replaceChild(clone,node);
  return clone;
}

function xpToNextLevel(level){
  return Math.round(500+level*120+Math.pow(level,1.35)*80);
}

function levelInfo(totalXp){
  let level=1;
  let remaining=Math.max(0,Number(totalXp||0));
  let needed=xpToNextLevel(level);
  while(remaining>=needed){
    remaining-=needed;
    level+=1;
    needed=xpToNextLevel(level);
  }
  return {level,currentXp:remaining,needed,progress:Math.min(100,remaining/needed*100)};
}

function missionXp(id,type){
  if(!type)return 0;
  if(id==='football')return type==='minimum'?40:80;
  if(id==='thu')return type==='minimum'?20:30;
  return type==='minimum'?40:100;
}

function actionId(){
  return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now()+Math.random());
}

function addXpAction({kind,label,xpDelta,payload}){
  const action={id:actionId(),createdAt:new Date().toISOString(),kind,label,xpDelta:Number(xpDelta||0),payload:payload||{},undone:false};
  state.totalXp=Math.max(0,Number(state.totalXp||0)+action.xpDelta);
  state.actions=[action,...(state.actions||[])].slice(0,ACTION_LIMIT);
  saveState();
  renderAll();
  showUndoToast(action);
}

function undoAction(actionIdValue){
  const action=(state.actions||[]).find(item=>item.id===actionIdValue);
  if(!action||action.undone)return;
  state.totalXp=Math.max(0,Number(state.totalXp||0)-Number(action.xpDelta||0));
  if(action.kind==='mission'){
    const missionId=action.payload.missionId;
    const previous=action.payload.previousStatus;
    if(previous)state.week[missionId]=previous;
    else delete state.week[missionId];
  }
  if(action.kind==='weekly-record'){
    state.records=(state.records||[]).filter(record=>record.id!==action.payload.recordId);
  }
  action.undone=true;
  action.undoneAt=new Date().toISOString();
  saveState();
  renderAll();
  showPassiveToast('Acao desfeita','O XP e o registro foram ajustados.');
}

function showUndoToast(action){
  if(!action||!Number(action.xpDelta))return;
  const host=document.getElementById('toastHost');
  if(!host)return;
  if(activeToastTimer)clearTimeout(activeToastTimer);
  const sign=action.xpDelta>0?'+':'';
  host.innerHTML=`<article class="toast"><p><strong>${sign}${action.xpDelta} XP</strong><small>${escapeHtml(action.label)} salvo.</small></p><button type="button" data-undo-action="${action.id}">Desfazer</button></article>`;
  activeToastTimer=setTimeout(()=>{host.innerHTML=''},UNDO_WINDOW_MS);
}

function showPassiveToast(title,message){
  const host=document.getElementById('toastHost');
  if(!host)return;
  if(activeToastTimer)clearTimeout(activeToastTimer);
  host.innerHTML=`<article class="toast"><p><strong>${escapeHtml(title)}</strong><small>${escapeHtml(message)}</small></p></article>`;
  activeToastTimer=setTimeout(()=>{host.innerHTML=''},3200);
}

completeMission=function(id,type){
  const mission=missions.find(item=>item.id===id);
  if(!mission)return;
  const previous=state.week[id]||'';
  const next=previous===type?'':type;
  const delta=missionXp(id,next)-missionXp(id,previous);
  if(next)state.week[id]=next;
  else delete state.week[id];
  if(delta!==0){
    addXpAction({kind:'mission',label:`${mission.label} - ${mission.title}`,xpDelta:delta,payload:{missionId:id,previousStatus:previous,nextStatus:next}});
  }else{
    saveState();
    renderAll();
  }
};

renderMissions=function(){
  const target=document.getElementById('weeklyMissions');
  if(!target)return;
  target.innerHTML=missions.map(m=>{
    const status=state.week[m.id];
    const doneClass=status?'done':'';
    const text=m.id==='thu'?'Leve, mobilidade e recuperacao.':`${missionXp(m.id,'complete')} XP disponiveis.`;
    return `<article class="mission-card ${doneClass}"><div><strong>${m.label} - ${m.title}</strong><p>${text}</p></div><div class="mission-actions"><button class="${status==='minimum'?'active':''}" data-mission="${m.id}" data-type="minimum">Minimo</button><button class="${status==='complete'?'active':''}" data-mission="${m.id}" data-type="complete">Feito</button></div></article>`;
  }).join('');
  document.querySelectorAll('[data-mission]').forEach(button=>button.addEventListener('click',()=>completeMission(button.dataset.mission,button.dataset.type)));
};

function renderRecentActions(){
  const target=document.getElementById('recentActions');
  if(!target)return;
  const actions=(state.actions||[]).slice(0,8);
  if(!actions.length){
    target.innerHTML='<article class="history-card"><p>Nenhuma acao recente. Quando XP for adicionado, voce podera desfazer aqui.</p></article>';
    return;
  }
  target.innerHTML=actions.map(action=>{
    const sign=action.xpDelta>0?'+':'';
    return `<article class="action-card ${action.undone?'undone':''}"><div><strong>${escapeHtml(action.label)}</strong><p>${formatDate(action.createdAt.slice(0,10))}${action.undone?' - desfeita':''}</p></div><span class="action-xp">${sign}${action.xpDelta} XP</span><button type="button" data-undo-action="${action.id}" ${action.undone?'disabled':''}>Desfazer</button></article>`;
  }).join('');
}

buildRecord=function(){
  const form=document.getElementById('weeklyForm');
  const training={};
  ['Segunda','Terca','Quarta','Quinta'].forEach(day=>{
    const checked=form.querySelector(`input[name="${day}"]:checked`);
    training[day]=checked?checked.value:'none';
  });
  return {id:actionId(),date:form.querySelector('#weekDate').value,weight:Number(form.querySelector('#weight').value),training,footballRating:Number(form.querySelector('#footballRating').value),pain:{knee:form.querySelector('#kneePain').checked,back:form.querySelector('#backPain').checked,shoulder:form.querySelector('#shoulderPain').checked}};
};

calculateRecordXp=function(record){
  return Object.values(record.training||{}).reduce((sum,type)=>sum+(type==='complete'?100:type==='minimum'?40:0),0)+(record.footballRating>0?80:0);
};

const dayProfile={
  Segunda:{pushupsSet:12,pushupsTotal:72,squatsSet:0,squatsTotal:0,plank:60,mobility:5,upper:1,lower:0,recovery:0},
  Terca:{pushupsSet:0,pushupsTotal:0,squatsSet:15,squatsTotal:60,plank:30,mobility:8,upper:0,lower:1,recovery:0},
  Quarta:{pushupsSet:15,pushupsTotal:45,squatsSet:0,squatsTotal:0,plank:30,mobility:4,upper:1,lower:0,recovery:0},
  Quinta:{pushupsSet:0,pushupsTotal:0,squatsSet:0,squatsTotal:0,plank:30,mobility:20,upper:0,lower:0,recovery:1}
};
const minimumProfile={pushupsSet:10,pushupsTotal:20,squatsSet:15,squatsTotal:30,plank:20,mobility:5,upper:.35,lower:.35,recovery:.2};
const weekDayMap={mon:'Segunda',tue:'Terca',wed:'Quarta',thu:'Quinta'};

function estimateCapacity(source=state){
  const metrics={pushupsSet:0,pushupsTotal:0,squatsSet:0,squatsTotal:0,plank:0,mobility:0,upper:0,lower:0,recovery:0,sessions:0,legacyPushups:0,legacyPullups:0,legacyPlank:0,wallSit:0};
  (source.records||[]).forEach(record=>{
    collectTrainingMetrics(record.training||{},metrics,1);
    metrics.legacyPushups=Math.max(metrics.legacyPushups,Number(record.maxPushups||0));
    metrics.legacyPullups=Math.max(metrics.legacyPullups,Number(record.maxPullups||0));
    metrics.legacyPlank=Math.max(metrics.legacyPlank,Number(record.maxPlank||0));
  });
  collectTrainingMetrics(source.week||{},metrics,.65);
  (source.hunterExams||[]).forEach(exam=>{
    if(exam.capacitySnapshot){
      metrics.legacyPushups=Math.max(metrics.legacyPushups,Number(exam.capacitySnapshot.pushups||0));
      metrics.legacyPullups=Math.max(metrics.legacyPullups,Number(exam.capacitySnapshot.pullups||0));
      metrics.legacyPlank=Math.max(metrics.legacyPlank,Number(exam.capacitySnapshot.plank||0));
      metrics.squatsSet=Math.max(metrics.squatsSet,Number(exam.capacitySnapshot.squats||0));
      metrics.wallSit=Math.max(metrics.wallSit,Number(exam.capacitySnapshot.wallSit||0));
      metrics.mobility=Math.max(metrics.mobility,Number(exam.capacitySnapshot.mobility||0));
    }
    metrics.legacyPushups=Math.max(metrics.legacyPushups,Number(exam.pushups||0));
    metrics.legacyPullups=Math.max(metrics.legacyPullups,Number(exam.pullups||0));
    metrics.legacyPlank=Math.max(metrics.legacyPlank,Number(exam.plank||0));
    metrics.wallSit=Math.max(metrics.wallSit,Number(exam.wallSit||0));
    metrics.mobility=Math.max(metrics.mobility,Number(exam.mobility||0));
  });
  const pushups=Math.max(10,metrics.legacyPushups,Math.round(metrics.pushupsSet*1.35+Math.min(24,metrics.upper*1.4)));
  const squats=Math.max(20,Math.round(metrics.squatsSet*1.7+Math.min(36,metrics.lower*3)));
  const plank=Math.max(30,metrics.legacyPlank,Math.round(metrics.plank*1.18+Math.min(45,metrics.sessions*3)));
  const mobility=Math.max(30,Math.round(metrics.mobility+Math.min(60,(metrics.recovery+metrics.sessions)*3)));
  const wallSit=Math.max(45,metrics.wallSit,Math.round(35+squats*.9+metrics.lower*3));
  const pullups=Math.max(0,metrics.legacyPullups,Math.floor(metrics.upper/4));
  const confidence=metrics.sessions>=8?'alta':metrics.sessions>=3?'media':'baixa';
  return {pushups,pullups,squats,plank,wallSit,mobility,confidence,sessions:metrics.sessions};
}

function collectTrainingMetrics(training,metrics,weight){
  Object.entries(training||{}).forEach(([rawDay,type])=>{
    if(type==='none'||!type)return;
    const day=weekDayMap[rawDay]||rawDay;
    const profile=type==='minimum'?minimumProfile:(dayProfile[day]||minimumProfile);
    metrics.pushupsSet=Math.max(metrics.pushupsSet,(profile.pushupsSet||0)*weight);
    metrics.pushupsTotal=Math.max(metrics.pushupsTotal,(profile.pushupsTotal||0)*weight);
    metrics.squatsSet=Math.max(metrics.squatsSet,(profile.squatsSet||0)*weight);
    metrics.squatsTotal=Math.max(metrics.squatsTotal,(profile.squatsTotal||0)*weight);
    metrics.plank=Math.max(metrics.plank,(profile.plank||0)*weight);
    metrics.mobility=Math.max(metrics.mobility,(profile.mobility||0)*weight);
    metrics.upper+=(profile.upper||0)*weight;
    metrics.lower+=(profile.lower||0)*weight;
    metrics.recovery+=(profile.recovery||0)*weight;
    metrics.sessions+=weight;
  });
}

attributeValues=function(){
  const cap=estimateCapacity(state);
  const done=(state.records||[]).reduce((sum,record)=>sum+completedTrainingDays(record),Object.keys(state.week||{}).filter(key=>key!=='football').length);
  const football=(state.records||[]).filter(record=>record.footballRating>0).length+(state.week.football?1:0);
  return {Forca:scoreToLevel(cap.pushups+cap.pullups*5+cap.squats*.35),Hipertrofia:scoreToLevel(done*18+weightGain(state)*25),Core:scoreToLevel(cap.plank),Mobilidade:scoreToLevel(cap.mobility),Postura:scoreToLevel(cap.mobility+cap.plank*.25),Explosao:scoreToLevel(football*22+cap.squats*.25),Joelhos:scoreToLevel(cap.wallSit+done*8-(state.records||[]).filter(record=>record.pain&&record.pain.knee).length*12)};
};

maxOf=function(source,key){
  const cap=estimateCapacity(source);
  if(key==='maxPushups')return cap.pushups;
  if(key==='maxPullups')return cap.pullups;
  if(key==='maxPlank')return cap.plank;
  return Math.max(0,...(source.records||[]).map(record=>Number(record[key]||0)));
};

weightGain=function(source){
  const entries=(source.records||[]).filter(record=>record.weight).sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(entries.length<2)return 0;
  return entries[0].weight-entries[entries.length-1].weight;
};

renderDashboard=function(){
  const level=levelInfo(state.totalXp);
  const rank=getRank(effectiveRankXp());
  const maxRank=getRank(Number(state.hunterRankXp||0));
  const next=ranks.find(item=>item.minXp>effectiveRankXp());
  document.getElementById('currentRank').textContent=rank.name;
  document.getElementById('currentLevel').textContent=level.level;
  document.getElementById('xpText').textContent=`${level.currentXp} / ${level.needed} XP para o proximo level`;
  document.getElementById('totalXpText').textContent=`Total: ${state.totalXp} XP`;
  document.getElementById('xpBar').style.width=level.progress+'%';
  document.getElementById('rankHint').textContent=isMvpRusty()?`Status Enferrujado ativo. Complete um Exame Hunter ou Boss Fight para restaurar ${maxRank.name}.`:next?`Proxima promocao Hunter: ${next.name}.`:'Rank maximo alcancado no Exame Hunter.';
  const banner=document.getElementById('rustyBanner');
  if(banner){
    banner.innerHTML=isMvpRusty()?`<article class="rusty-banner"><div><p class="eyebrow">Caminho de retorno</p><h2>ENFERRUJADO</h2><p>Seu rank atual caiu temporariamente. Seu rank maximo foi preservado; complete um desafio proporcional para restaurar.</p></div><button class="primary-button" type="button" data-open-boss>Ver desafio</button></article>`:'';
  }
};

function effectiveRankXp(){
  return Math.max(0,isMvpRusty()?Number(state.rusty.currentRankXp||0):Number(state.hunterRankXp||0));
}

function isMvpRusty(){
  return !!(state.rusty&&state.rusty.active);
}

function rankKeyMvp(name){
  const text=String(name||'').toUpperCase();
  return rankKeysMvp.find(key=>text.includes('RANK '+key))||'E';
}

function nextHunterRankMvp(){
  const current=rankKeyMvp(getRank(effectiveRankXp()).name);
  return rankKeysMvp[rankKeysMvp.indexOf(current)+1]||'';
}

renderRanks=function(){
  const current=getRank(effectiveRankXp());
  const target=document.getElementById('ranksGrid');
  if(!target)return;
  target.innerHTML=ranks.map(rank=>`<article class="rank-card ${rank.name===current.name?'current':''}"><p class="eyebrow">${rank.minXp} XP Hunter</p><h3>${rank.name}</h3><ul>${rank.requirements.map(item=>'<li>'+item+'</li>').join('')}</ul></article>`).join('');
};

const mvpAchievements=[
  {name:'Primeiro Sangue',description:'Primeiro treino registrado',test:source=>source.records.length>0||Object.values(source.week||{}).some(Boolean)},
  {name:'Consistencia',description:'5 semanas registradas',test:source=>source.records.length>=5},
  {name:'Sem Desculpas',description:'20 treinos minimos concluidos',test:source=>countTrainingType(source,'minimum')>=20},
  {name:'Muralha',description:'Prancha estimada acima de 3 minutos',test:source=>estimateCapacity(source).plank>=180},
  {name:'Sentinela',description:'15 barras estimadas ou registradas',test:source=>estimateCapacity(source).pullups>=15},
  {name:'Aco',description:'4 semanas com todos os treinos feitos',test:source=>source.records.filter(record=>completedTrainingDays(record)>=4).length>=4},
  {name:'Jogador Completo',description:'10 semanas com futebol registrado',test:source=>source.records.filter(record=>record.footballRating>0).length>=10},
  {name:'Evolucao Visivel',description:'Ganhar 4kg desde o inicio',test:source=>weightGain(source)>=4}
];

renderAchievements=function(){
  const unlocked=mvpAchievements.filter(item=>item.test(state));
  document.getElementById('achievementCount').textContent=unlocked.length+' desbloqueadas';
  document.getElementById('achievementsGrid').innerHTML=mvpAchievements.map(item=>{
    const ok=item.test(state);
    return `<article class="achievement-card ${ok?'unlocked':'locked'}"><p class="eyebrow">${ok?'Desbloqueada':'Bloqueada'}</p><h3>${item.name}</h3><p>${item.description}</p></article>`;
  }).join('');
};

function renderMvpEvolution(){
  const target=document.getElementById('evolutionGrid');
  if(!target)return;
  const cap=estimateCapacity(state);
  const latest=(state.records||[])[0]||{};
  const level=levelInfo(state.totalXp);
  const metrics=[['Peso',latest.weight?latest.weight+' kg':'-','Ultimo check-in'],['Flexoes',cap.pushups,'Capacidade estimada'],['Agachamentos',cap.squats,'Capacidade estimada'],['Prancha',cap.plank+'s','Capacidade estimada'],['Level','Lv '+level.level,`${level.needed-level.currentXp} XP restantes`],['Confianca',cap.confidence,'Baseada no historico']];
  target.innerHTML=metrics.map(item=>`<article class="metric-card"><span>${item[0]}</span><strong>${item[1]}</strong><p>${item[2]}</p></article>`).join('');
}

renderHistory=function(){
  const hunterCards=(state.hunterExams||[]).map(renderMvpHunterExamCard);
  const recordCards=(state.records||[]).map(record=>`<article class="history-card"><div class="section-title"><h3>${formatDate(record.date)}</h3><span class="pill">+${calculateRecordXp(record)} XP</span></div><div class="history-meta"><span>${record.weight||'-'} kg</span><span>Futebol ${record.footballRating||'-'}/5</span><span>${completedTrainingDays(record)} treinos</span></div><p>${trainingSummary(record)}</p>${painSummary(record)?'<p><strong>Alertas:</strong> '+painSummary(record)+'</p>':''}</article>`);
  document.getElementById('historyCount').textContent=hunterCards.length+recordCards.length+' registros';
  renderMvpEvolution();
  document.getElementById('historyList').innerHTML=hunterCards.length||recordCards.length?hunterCards.concat(recordCards).join(''):'<article class="panel"><p>Nenhum registro ainda. Salve seu primeiro check-in semanal ou conclua um Exame Hunter.</p></article>';
};

function buildHunterChallenge(mode){
  const capacity=estimateCapacity(state);
  const rusty=mode==='rusty'||isMvpRusty();
  const target=rusty?rankKeyMvp(getRank(Number(state.rusty.maxRankXp||state.hunterRankXp||0)).name):nextHunterRankMvp();
  const rankIndex=Math.max(0,rankKeysMvp.indexOf(target||'E'));
  const intensity=rusty?.78:.86;
  const rankMultiplier=1+rankIndex*.08;
  const objectives=[
    {key:'pushups',label:'Flexoes totais',target:clamp(Math.round(capacity.pushups*intensity*rankMultiplier),10,120),unit:' reps',basis:capacity.pushups+' estimadas'},
    {key:'squats',label:'Agachamentos',target:clamp(Math.round(capacity.squats*intensity*rankMultiplier),20,180),unit:' reps',basis:capacity.squats+' estimados'},
    {key:'plank',label:'Prancha acumulada',target:clamp(Math.round(capacity.plank*intensity),30,300),unit:'s',basis:capacity.plank+'s estimados'}
  ];
  return {mode:rusty?'rusty':'promotion',targetRank:target,timeCap:rusty?7*60:10*60,intensity,capacitySnapshot:capacity,objectives};
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function renderChallengeCards(challenge){
  return challenge.objectives.map(item=>`<article class="hunter-challenge-card"><span>${item.label}</span><strong>${item.target}${item.unit}</strong><small>Base: ${item.basis}</small></article>`).join('')+`<article class="hunter-challenge-card"><span>Time cap</span><strong>${formatMvpTimer(challenge.timeCap)}</strong><small>${challenge.mode==='rusty'?'Restaurar condicionamento':'Promocao Hunter'}</small></article>`;
}

function renderActiveHunterChallenge(challenge){
  const challengeNode=document.getElementById('hunterChallenge');
  const target=document.getElementById('hunterTargetRank');
  if(challengeNode)challengeNode.innerHTML=renderChallengeCards(challenge);
  if(target)target.textContent=challenge.mode==='rusty'?'Restaurar Rank '+challenge.targetRank:(challenge.targetRank?'Alvo: Rank '+challenge.targetRank:'Rank maximo');
}

function finishMvpHunterExam(){
  const challenge=activeHunterChallenge||buildHunterChallenge();
  const before=rankKeyMvp(getRank(effectiveRankXp()).name);
  let status='completed';
  let rankAfter=before;
  if(challenge.mode==='rusty'){
    state.rusty={...state.rusty,active:false,clearedForTrainingDate:state.rusty.lastTrainingDate||''};
    state.bossFight={active:false,startedAt:0,endsAt:0,progress:{},status:'won'};
    rankAfter=rankKeyMvp(getRank(Number(state.hunterRankXp||0)).name);
  }else if(challenge.targetRank){
    const targetRank=ranks.find(rank=>rankKeyMvp(rank.name)===challenge.targetRank);
    if(targetRank)state.hunterRankXp=targetRank.minXp;
    rankAfter=challenge.targetRank;
    status='promoted';
  }else{
    status='max';
  }
  state.hunterAttributes=computeMvpHunterAttributes(challenge.capacitySnapshot,rankAfter);
  const exam={id:actionId(),date:new Date().toISOString().slice(0,10),status,mode:challenge.mode,rankBefore:before,rankAfter,challenge,capacitySnapshot:challenge.capacitySnapshot};
  state.hunterExams.unshift(exam);
  activeHunterChallenge=null;
  saveState();
  const form=document.getElementById('hunterExamForm');
  const intro=document.getElementById('hunterIntro');
  if(form)form.hidden=true;
  if(intro)intro.hidden=false;
  renderAll();
  renderMvpHunterResult(exam);
}

function computeMvpHunterAttributes(capacity,rank){
  const bonus=Math.max(0,rankKeysMvp.indexOf(rank))*55;
  return {Forca:scoreToLevel(capacity.pushups+capacity.pullups*5+capacity.squats*.35+bonus),Hipertrofia:scoreToLevel(capacity.pushups+capacity.squats*.25+bonus),Core:scoreToLevel(capacity.plank+capacity.wallSit*.35+bonus),Mobilidade:scoreToLevel(capacity.mobility+bonus),Postura:scoreToLevel(capacity.mobility+capacity.plank*.25+bonus),Explosao:scoreToLevel(capacity.squats*.3+capacity.pushups+bonus),Joelhos:scoreToLevel(capacity.wallSit+capacity.mobility+bonus)};
}

function renderMvpHunterExam(){
  const introTime=document.getElementById('hunterIntroTime');
  const target=document.getElementById('hunterTargetRank');
  const list=document.getElementById('hunterExamList');
  const count=document.getElementById('hunterExamCount');
  if(introTime)introTime.textContent=isMvpRusty()?'7 min':'10 min';
  if(target&&!activeHunterChallenge){
    const next=nextHunterRankMvp();
    target.textContent=isMvpRusty()?'Restaurar rank':next?'Alvo: Rank '+next:'Rank maximo';
  }
  if(count)count.textContent=(state.hunterExams||[]).length+' exames';
  if(list)list.innerHTML=(state.hunterExams||[]).length?state.hunterExams.map(renderMvpHunterExamCard).join(''):'<article class="history-card"><p>Nenhum Exame Hunter registrado ainda.</p></article>';
  const result=document.getElementById('hunterResult');
  if(result&&!result.innerHTML&&state.hunterExams[0])renderMvpHunterResult(state.hunterExams[0],true);
}

function renderMvpHunterResult(exam,compact){
  const result=document.getElementById('hunterResult');
  if(!result)return;
  result.innerHTML=`<article class="hunter-result ${exam.status==='promoted'||exam.mode==='rusty'?'promoted':'failed'}"><p class="eyebrow">${compact?'Ultimo resultado':'Resultado do Exame Hunter'}</p><h2>${hunterStatusMvp(exam)}</h2><p>${hunterSummaryMvp(exam)}</p><div class="hunter-challenge">${renderChallengeCards(exam.challenge)}</div></article>`;
}

function hunterStatusMvp(exam){
  if(exam.mode==='rusty')return 'CONDICIONAMENTO RESTAURADO';
  if(exam.status==='promoted')return 'PROMOVIDO';
  if(exam.status==='max')return 'RANK MAXIMO';
  return 'EXAME CONCLUIDO';
}

function hunterSummaryMvp(exam){
  if(exam.mode==='rusty')return 'Status Enferrujado removido. O rank maximo foi restaurado.';
  if(exam.status==='promoted')return 'Rank, atributos e progressao foram atualizados para Rank '+exam.rankAfter+'.';
  if(exam.status==='max')return 'Voce ja esta no limite atual do Projeto Atlas.';
  return 'Desafio registrado no historico.';
}

function renderMvpHunterExamCard(exam){
  const challenge=exam.challenge||buildHunterChallenge();
  return `<article class="history-card hunter-history-card"><div class="section-title"><h3>${formatDate(exam.date)}</h3><span class="pill">${hunterStatusMvp(exam)}</span></div><div class="history-meta"><span>Rank ${exam.rankBefore} -> ${exam.rankAfter}</span><span>${formatMvpTimer(challenge.timeCap)}</span><span>Confianca ${challenge.capacitySnapshot?challenge.capacitySnapshot.confidence:'baixa'}</span></div><div class="hunter-challenge">${renderChallengeCards(challenge)}</div></article>`;
}

function syncMvpRustyState(){
  if(isMvpRusty())return;
  const last=lastTrainingRecordMvp();
  if(!last||!last.date||state.rusty.clearedForTrainingDate===last.date)return;
  const days=Math.floor((startOfTodayMvp()-new Date(last.date+'T00:00:00'))/(1000*60*60*24));
  if(days<30)return;
  const maxXp=Number(state.hunterRankXp||0);
  state.rusty={...state.rusty,active:true,startedAt:new Date().toISOString().slice(0,10),maxRankXp:maxXp,currentRankXp:downgradeRankXpMvp(maxXp),lastTrainingDate:last.date};
  state.bossFight={active:false,startedAt:0,endsAt:0,progress:{},status:'unlocked'};
  saveState();
}

function lastTrainingRecordMvp(){
  return (state.records||[]).filter(record=>record.date&&completedTrainingDays(record)>0).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
}

function startOfTodayMvp(){
  const today=new Date();
  today.setHours(0,0,0,0);
  return today;
}

function downgradeRankXpMvp(xp){
  const current=rankKeyMvp(getRank(xp).name);
  const index=rankKeysMvp.indexOf(current);
  const target=rankKeysMvp[Math.max(0,index-1)];
  const rank=ranks.find(item=>rankKeyMvp(item.name)===target);
  return rank?rank.minXp:0;
}

function renderMvpBossFight(){
  const panel=document.getElementById('bossFightPanel');
  if(!panel)return;
  if(!isMvpRusty()){
    panel.innerHTML='<article class="boss-empty"><p class="eyebrow">Boss Fights</p><h2>Nenhum Boss ativo</h2><p>Boss Fights aparecem como caminho de retorno quando o status Enferrujado esta ativo.</p></article>';
    return;
  }
  if(state.bossFight.active&&Date.now()>=state.bossFight.endsAt)failMvpBossFight(false);
  const challenge=state.bossFight.challenge||buildHunterChallenge('rusty');
  const active=state.bossFight.active;
  const progress=state.bossFight.progress||{};
  const summary=bossSummaryMvp(challenge,progress);
  const remaining=active?Math.max(0,Math.ceil((state.bossFight.endsAt-Date.now())/1000)):challenge.timeCap;
  panel.innerHTML=`<article class="boss-arena"><div class="boss-topline"><p class="eyebrow">Boss Fight</p><span class="pill">Time Cap: ${formatMvpTimer(challenge.timeCap)}</span></div><h2>Ferrugem Rank ${challenge.targetRank}</h2><div id="bossTimer" class="boss-timer">${formatMvpTimer(remaining)}</div><div class="boss-progress"><div class="boss-progress-fill" style="width:${summary.percent}%"></div></div><div class="boss-progress-text"><span>${summary.done} / ${summary.total}</span><strong>${summary.percent}%</strong></div><p class="boss-rule">Desafio proporcional ao seu historico. Pode quebrar em series, desde que termine no tempo.</p><div class="boss-objectives">${challenge.objectives.map(item=>bossObjectiveMvp(item,progress,active)).join('')}</div><div class="form-actions">${active?'<span class="pill boss-running">Cronometro ativo</span>':`<button class="primary-button" type="button" data-mvp-start-boss>${state.bossFight.status==='failed'?'Tentar novamente':'Iniciar Boss Fight'}</button>`}<span class="pill">${active?'Em combate':'Aguardando inicio'}</span></div>${state.bossFight.status==='failed'?'<article class="boss-end defeat compact"><h3>DERROTA</h3><p>O tempo acabou. O status permanece, mas o desafio pode ser refeito quando quiser.</p></article>':''}</article>`;
  if(active)startMvpBossTimer();
}

function bossObjectiveMvp(item,progress,active){
  const value=Math.min(item.target,Number(progress[item.key]||0));
  const done=value>=item.target;
  return `<article class="boss-objective ${done?'done':''}"><div><strong>${item.label}</strong><small>Meta ${item.target}${item.unit} - ${item.basis}</small></div><div class="boss-counter"><button type="button" data-mvp-boss-dec="${item.key}" ${!active||value<=0?'disabled':''}>-1</button><span>${value} / ${item.target}</span><button type="button" data-mvp-boss-inc="${item.key}" ${!active||done?'disabled':''}>+1</button></div></article>`;
}

function startMvpBossFight(){
  if(!isMvpRusty())return;
  const challenge=buildHunterChallenge('rusty');
  const progress={};
  challenge.objectives.forEach(item=>progress[item.key]=0);
  state.bossFight={active:true,startedAt:Date.now(),endsAt:Date.now()+challenge.timeCap*1000,progress,status:'running',challenge};
  saveState();
  renderAll();
}

function updateMvpBossProgress(key,delta){
  if(!state.bossFight.active)return;
  const challenge=state.bossFight.challenge||buildHunterChallenge('rusty');
  const objective=challenge.objectives.find(item=>item.key===key);
  if(!objective)return;
  const progress={...(state.bossFight.progress||{})};
  progress[key]=Math.max(0,Math.min(objective.target,Number(progress[key]||0)+delta));
  state.bossFight.progress=progress;
  if(challenge.objectives.every(item=>Number(progress[item.key]||0)>=item.target)&&Date.now()<=state.bossFight.endsAt){
    completeMvpBossFight();
    return;
  }
  saveState();
  renderAll();
}

function bossSummaryMvp(challenge,progress){
  const done=challenge.objectives.reduce((sum,item)=>sum+Math.min(item.target,Number(progress[item.key]||0)),0);
  const total=challenge.objectives.reduce((sum,item)=>sum+item.target,0);
  return {done,total,percent:total?Math.min(100,Math.round(done/total*100)):0};
}

function completeMvpBossFight(){
  if(activeBossTimer)clearInterval(activeBossTimer);
  state.rusty={...state.rusty,active:false,clearedForTrainingDate:state.rusty.lastTrainingDate||''};
  state.bossFight={...state.bossFight,active:false,status:'won',endedAt:Date.now()};
  saveState();
  renderAll();
  switchTab('boss');
}

function failMvpBossFight(shouldRender){
  if(activeBossTimer)clearInterval(activeBossTimer);
  state.bossFight={...state.bossFight,active:false,status:'failed',endedAt:Date.now()};
  saveState();
  if(shouldRender)renderAll();
}

function startMvpBossTimer(){
  if(activeBossTimer)clearInterval(activeBossTimer);
  activeBossTimer=setInterval(()=>{
    if(!state.bossFight.active){clearInterval(activeBossTimer);return;}
    const remaining=Math.max(0,Math.ceil((state.bossFight.endsAt-Date.now())/1000));
    const timer=document.getElementById('bossTimer');
    if(timer)timer.textContent=formatMvpTimer(remaining);
    if(remaining<=0)failMvpBossFight(true);
  },1000);
}

function formatMvpTimer(seconds){
  return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
})();
