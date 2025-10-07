// UI interactions (floating action button + accessibility)
(function(){
  function adjustFab(action){
    if(!action) return;
    action.classList.remove('flip-x','flip-y');
    const list = action.querySelector('ul');
    if(!list) return;
    // Force visibility to measure when toggling on
    const wasHidden = !action.classList.contains('active');
    if (wasHidden) { action.classList.add('active'); list.style.visibility='hidden'; list.style.opacity='0'; }
    const rect = list.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let flipX=false, flipY=false;
    if (rect.right > vw) flipX = true;
    if (rect.left < 0) flipX = true; // left overflow
    if (rect.top < 0) flipY = true;  // top overflow
    if (rect.bottom > vh) flipY = true; // bottom overflow
    if (flipX) action.classList.add('flip-x');
    if (flipY) action.classList.add('flip-y');
    if (wasHidden) { action.classList.remove('active'); list.style.visibility=''; list.style.opacity=''; }
  }

  function actionToggle(){
    const action = document.querySelector('.action');
    if(!action) return;
    const isActive = action.classList.toggle('active');
    action.setAttribute('aria-expanded', isActive? 'true':'false');
    if (isActive) {
      // next frame to ensure layout updated
      requestAnimationFrame(()=> adjustFab(action));
    }
  }
  window.actionToggle = actionToggle;

  const fab = document.getElementById('fab');
  if(fab){
    fab.addEventListener('click', (e)=>{ e.stopPropagation(); actionToggle(); });
    fab.addEventListener('keydown', (e)=>{
      if(e.key==='Enter' || e.key===' '){ e.preventDefault(); actionToggle(); }
      if(e.key==='Escape'){ fab.classList.remove('active'); fab.setAttribute('aria-expanded','false'); }
    });
    fab.setAttribute('tabindex','0');
    fab.setAttribute('aria-expanded','false');
  }

  // Close when clicking outside
  document.addEventListener('click', (e)=>{
    const act = document.querySelector('.action.active');
    if(act && !act.contains(e.target)){
      act.classList.remove('active');
      act.setAttribute('aria-expanded','false');
    }
  });

  window.addEventListener('resize', ()=> adjustFab(document.querySelector('.action.active')));
})();
