(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const data = window.MOTIONCOACH_MEDIA;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const groups = new Map();
  let activeCase = 'single-whip', benchIndex = 0, restoreGroups = [];
  const cases = [
    {id:'single-whip',title:'Single Whip',prompt:'Edit the video so that the person performs Taijiquan Single Whip.'},
    {id:'plank-to-lunge',title:'Plank to Lunge',prompt:'Edit the video so that the person performs Pilates Plank to Lunge.'},
    {id:'scooby-doo',title:'Scooby Doo',prompt:"Replace the person's current action with Locking Scooby Doo."},
    {id:'toy-man',title:'Toy Man',prompt:'Make the person transition from the current action to Popping Toy Man.'}
  ];
  const models = [
    {id:'source_video',label:'Source video',sub:'Original input'},
    {id:'seedance',label:'Seedance 2.0',sub:'Base editor'},
    {id:'seedance_with_our',label:'Seedance 2.0',sub:'+ MotionCoach',ours:true},
    {id:'minimax_h3',label:'MiniMax-H3',sub:'Base editor'},
    {id:'minimax_h3_with_our',label:'MiniMax-H3',sub:'+ MotionCoach',ours:true}
  ];
  function registerGroup(id,container,button,idle='Play pair',running='Pause pair') {
    const group={id,container,button,idle,running,playing:false,version:0};
    groups.set(id,group);button.addEventListener('click',()=>group.playing?pauseGroup(id):playGroup(id));
    return group;
  }
  const clips = id => [...groups.get(id).container.querySelectorAll('video')];
  function setState(group,playing) {
    group.playing=playing;group.button.textContent=playing?group.running:group.idle;
    group.button.classList.toggle('playing',playing);
    if(group.id==='comparison') group.button.setAttribute('aria-label',`${playing?'Pause':'Play'} all comparison videos`);
    else group.button.setAttribute('aria-label',`${playing?group.running:group.idle}: ${group.title||group.id}`);
  }
  function loadVideo(video) {
    if(video.dataset.src){video.src=video.dataset.src;delete video.dataset.src;video.load();}
  }
  async function playGroup(id,restart=false) {
    const group=groups.get(id), version=++group.version, current=clips(id);
    current.forEach(v=>{loadVideo(v);if(restart)v.currentTime=0;});
    setState(group,true);
    const results=await Promise.allSettled(current.map(v=>v.play()));
    if(version!==group.version)return;
    setState(group,results.some(r=>r.status==='fulfilled'));
    if(results.some(r=>r.status==='rejected'))$('#announcement').textContent='A video could not start. Open it individually or try playback again.';
  }
  function pauseGroup(id) {
    const group=groups.get(id);if(!group)return;++group.version;
    clips(id).forEach(v=>v.pause());setState(group,false);
  }
  function pauseEverything(){groups.forEach(g=>pauseGroup(g.id));}
  const lazyVideo=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){loadVideo(e.target);lazyVideo.unobserve(e.target);}},{rootMargin:'250px'});
  const visibleGroups=new IntersectionObserver(entries=>{for(const e of entries)if(!e.isIntersecting){const id=e.target.dataset.group;if(groups.get(id)?.playing)pauseGroup(id);}},{threshold:0.03});
  function trackGroup(group){group.container.dataset.group=group.id;visibleGroups.observe(group.container);}
  function videoCard({src,poster,label,sub='',ours=false,title='',lazy=false}) {
    const card=document.createElement('article');card.className=`video-card${ours?' is-ours':''}`;
    const heading=document.createElement('div');heading.className='video-label';
    const name=document.createElement('span');name.textContent=label;
    if(sub){const small=document.createElement('small');small.textContent=sub;name.append(small);}heading.append(name);
    if(ours&&sub){const badge=document.createElement('span');badge.className='ours-chip';badge.textContent='OURS';heading.append(badge);}
    const shell=document.createElement('div');shell.className='video-shell';
    const video=document.createElement('video');video.muted=true;video.loop=true;video.playsInline=true;
    video.setAttribute('muted','');video.setAttribute('playsinline','');video.preload=lazy?'none':'metadata';video.poster=poster;
    video.setAttribute('aria-label',`${title}: ${label}${sub?' '+sub:''}`);
    if(lazy){video.dataset.src=src;lazyVideo.observe(video);}else video.src=src;
    const enlarge=document.createElement('button');enlarge.type='button';enlarge.className='enlarge-video';enlarge.setAttribute('aria-label',`Enlarge ${title} — ${label}${sub?' '+sub:''}`);
    const icon=document.createElement('span');icon.textContent='⤢';icon.setAttribute('aria-hidden','true');enlarge.append(icon);
    enlarge.addEventListener('click',()=>openVideo(src,poster,`${title} · ${label}${sub?' '+sub:''}`,video.currentTime));
    video.addEventListener('error',()=>{if(shell.querySelector('.video-error'))return;const error=document.createElement('div');error.className='video-error';error.textContent='Video unavailable. Please reload.';shell.append(error);});
    shell.append(video,enlarge);card.append(heading,shell);return card;
  }
  const comparison=registerGroup('comparison',$('#video-grid'),$('#play-toggle'),'Play all','Pause all');
  trackGroup(comparison);
  function renderCase(id,play=false) {
    pauseGroup('comparison');activeCase=id;const c=cases.find(c=>c.id===id);
    $$('.case-tabs button').forEach(b=>{const active=b.dataset.case===id;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    $('#comparison').setAttribute('aria-labelledby',`tab-${id}`);$('#edit-prompt').textContent=`“${c.prompt}”`;$('#case-counter').textContent=`0${cases.indexOf(c)+1} / 04`;
    $('#video-grid').replaceChildren(...models.map(m=>videoCard({src:`assets/videos/${id}-${m.id}.mp4`,poster:`assets/posters/${id}-${m.id}.jpg`,label:m.label,sub:m.sub,ours:m.ours,title:c.title})));
    $('#announcement').textContent=`${c.title} comparison selected.`;
    window.dispatchEvent(new CustomEvent('motion-case-change',{detail:{id:c.id,title:c.title}}));
    if(play)playGroup('comparison');
  }
  $$('.case-tabs button').forEach((b,index,buttons)=>{
    b.addEventListener('click',()=>renderCase(b.dataset.case,comparison.playing));
    b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(index+1)%buttons.length;if(e.key==='ArrowLeft')next=(index-1+buttons.length)%buttons.length;if(e.key==='Home')next=0;if(e.key==='End')next=buttons.length-1;if(next===undefined)return;e.preventDefault();buttons[next].focus();renderCase(buttons[next].dataset.case,comparison.playing);});
  });
  $('#replay').addEventListener('click',()=>playGroup('comparison',true));
  renderCase(activeCase);
  data.hero.forEach((entry,index)=>{
    const tile=document.createElement('div');tile.className='motion-tile';
    tile.dataset.shape=entry.shape||'square';
    const img=document.createElement('img');img.src=entry.image;img.alt='';img.width=640;img.height=360;img.decoding='async';if(index<4)img.fetchPriority='high';
    tile.append(img);$('#motion-wall').append(tile);
  });
  data.benchmark.forEach((c,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${String(i+1).padStart(2,'0')} · ${c.title}`;$('#bench-case').append(o);});
  const benchmark=registerGroup('benchmark',$('#bench-videos'),$('#bench-play'));trackGroup(benchmark);
  function renderBenchmark(index,play=false){
    pauseGroup('benchmark');benchIndex=(index+data.benchmark.length)%data.benchmark.length;const c=data.benchmark[benchIndex];benchmark.title=c.title;
    $('#bench-case').value=String(benchIndex);$('#bench-counter').textContent=`${String(benchIndex+1).padStart(2,'0')} / ${String(data.benchmark.length).padStart(2,'0')}`;$('#bench-title').textContent=c.title;$('#bench-category').textContent=c.category;
    $('#bench-videos').replaceChildren(...[['Source video',c.source],['Reference clip',c.reference]].map(([label,src])=>videoCard({src,poster:src.replace('.mp4','.jpg'),label,title:c.title,lazy:true})));
    $('#bench-keyframes').replaceChildren(...c.keyframes.map((src,i)=>{const button=document.createElement('button');button.type='button';button.setAttribute('aria-label',`Enlarge ${c.title} semantic keyframe ${i+1}`);const img=document.createElement('img');img.src=src;img.alt=`${c.title}: semantic keyframe ${i+1}`;img.loading='lazy';button.append(img);button.addEventListener('click',()=>openImage(src,`${c.title} · Keyframe ${i+1}`));return button;}));
    $('#bench-annotation-image').src=c.annotation;$('#bench-annotation-image').alt=`${c.title}: source, reference, edit prompt, motion technique, negative constraints and timeline`;
    $('#announcement').textContent=`Benchmark case ${benchIndex+1}: ${c.title}`;
    if(play)playGroup('benchmark');
  }
  $('#bench-case').addEventListener('change',e=>renderBenchmark(Number(e.target.value),benchmark.playing));
  $('#bench-prev').addEventListener('click',()=>renderBenchmark(benchIndex-1,benchmark.playing));
  $('#bench-next').addEventListener('click',()=>renderBenchmark(benchIndex+1,benchmark.playing));
  $('#bench-annotation').addEventListener('click',()=>{const c=data.benchmark[benchIndex];openImage(c.annotation,`${c.title} · Annotated benchmark case`);});
  renderBenchmark(0);
  data.extra.forEach(c=>{
    const article=document.createElement('article');article.className='extra-card';
    const header=document.createElement('div');header.className='extra-card-header';
    const titleBlock=document.createElement('div');const category=document.createElement('span');category.className='extra-category';category.textContent=c.category;
    const title=document.createElement('h3');title.textContent=c.title;titleBlock.append(category,title);
    const play=document.createElement('button');play.type='button';play.className='play-button';play.textContent='Play pair';play.setAttribute('aria-label',`Play pair: ${c.title}`);header.append(titleBlock,play);
    const caption=document.createElement('p');caption.className='edit-caption';caption.textContent=`“${c.prompt}”`;
    const pair=document.createElement('div');pair.className='extra-pair';
    pair.append(videoCard({src:c.source,poster:c.source.replace('.mp4','.jpg'),label:'Source video',title:c.title,lazy:true}),videoCard({src:c.edited,poster:c.edited.replace('.mp4','.jpg'),label:'Edited video',ours:true,title:c.title,lazy:true}));
    article.append(header,caption,pair);$('#extra-grid').append(article);
    const group=registerGroup(`extra-${c.id}`,pair,play);group.title=c.title;trackGroup(group);
  });
  const dialog=$('#media-dialog');
  function prepareDialog(title){restoreGroups=[...groups.values()].filter(g=>g.playing).map(g=>g.id);pauseEverything();window.dispatchEvent(new Event('motion-media-open'));$('#dialog-title').textContent=title;}
  function openVideo(src,poster,title,time=0){
    prepareDialog(title);const video=document.createElement('video');video.controls=true;video.playsInline=true;video.muted=true;video.loop=true;video.src=src;video.poster=poster;
    video.addEventListener('loadedmetadata',()=>{video.currentTime=Math.min(time,Math.max(0,video.duration-.1));},{once:true});$('#dialog-content').replaceChildren(video);dialog.showModal();video.play().catch(()=>{});
  }
  function openImage(src,title){prepareDialog(title);const img=document.createElement('img');img.src=src;img.alt=title;$('#dialog-content').replaceChildren(img);dialog.showModal();}
  $$('.figure-button').forEach(b=>b.addEventListener('click',()=>openImage(b.querySelector('img').src,b.dataset.figure)));
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{$('#dialog-content').querySelectorAll('video').forEach(v=>v.pause());$('#dialog-content').replaceChildren();restoreGroups.forEach(id=>playGroup(id));restoreGroups=[];});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pauseEverything();$('#dialog-content').querySelectorAll('video').forEach(v=>v.pause());restoreGroups=[];}});
  $$('[data-resource]').forEach(a=>{const url=(window.MOTIONCOACH_LINKS||{})[a.dataset.resource];if(url){a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.querySelector('.availability')?.remove();}else{a.addEventListener('click',e=>e.preventDefault());}});
  window.addEventListener('motion-detail-play',pauseEverything);
  const navLinks=$$('nav a');
  const navSections=navLinks.map(a=>$(a.getAttribute('href'))).filter(Boolean);
  function updateSectionNav(){const current=navSections.filter(s=>s.getBoundingClientRect().top<=160).at(-1);navLinks.forEach(a=>{if(current&&a.hash===`#${current.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}
  window.addEventListener('scroll',updateSectionNav,{passive:true});updateSectionNav();
  new IntersectionObserver(entries=>{$('.site-header').classList.toggle('scrolled',!entries[0].isIntersecting);},{rootMargin:'-74px 0px 0px 0px'}).observe($('.hero'));
  if(!reduceMotion&&!navigator.connection?.saveData){const autoplay=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){playGroup('comparison');autoplay.disconnect();}},{threshold:.25});autoplay.observe($('#video-grid'));}
})();
