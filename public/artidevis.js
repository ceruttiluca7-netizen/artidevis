(function () {
    const script = document.currentScript ||
      document.querySelector('script[data-email][data-nom]');
  
    const config = {
      email:    script.getAttribute('data-email')    || '',
      couleur:  script.getAttribute('data-couleur')  || '#1d4ed8',
      nom:      script.getAttribute('data-nom')      || 'L\'artisan',
      services: (script.getAttribute('data-services') || 'Autre')
                  .split(',').map(s => s.trim()).filter(Boolean),
      endpoint: 'https://artidevis-chi.vercel.app/api/send-devis',
    };
  
    function hex2rgb(hex) {
      return [
        parseInt(hex.slice(1,3),16),
        parseInt(hex.slice(3,5),16),
        parseInt(hex.slice(5,7),16)
      ].join(',');
    }
  
    const css = `
      #ad-overlay {
        display:none;position:fixed;inset:0;
        background:rgba(10,15,25,0.55);
        backdrop-filter:blur(4px);
        z-index:99999;align-items:center;justify-content:center;padding:16px;
      }
      #ad-overlay.ad-open{display:flex;}
      @keyframes ad-slide-up{
        from{opacity:0;transform:translateY(18px) scale(0.98);}
        to{opacity:1;transform:translateY(0) scale(1);}
      }
      #ad-modal{
        --ad-primary:${config.couleur};
        --ad-rgb:${hex2rgb(config.couleur)};
        background:#fff;border-radius:16px;
        box-shadow:0 24px 64px rgba(0,0,0,0.18);
        max-width:480px;width:100%;
        font-family:'Segoe UI',system-ui,sans-serif;
        overflow:hidden;
        animation:ad-slide-up 0.28s cubic-bezier(0.34,1.4,0.64,1);
      }
      #ad-header{background:var(--ad-primary);padding:22px 24px 18px;position:relative;}
      #ad-header h2{margin:0;color:#fff;font-size:17px;font-weight:700;}
      #ad-header p{margin:4px 0 0;color:rgba(255,255,255,0.82);font-size:13px;}
      #ad-close{
        position:absolute;top:14px;right:16px;
        background:rgba(255,255,255,0.18);border:none;color:#fff;
        width:30px;height:30px;border-radius:50%;cursor:pointer;
        font-size:17px;line-height:30px;text-align:center;padding:0;
      }
      #ad-body{padding:22px 24px 0;}
      #ad-progress{display:flex;gap:6px;margin-bottom:20px;}
      .ad-dot{height:4px;flex:1;border-radius:2px;background:#e5e7eb;transition:background 0.3s;}
      .ad-dot.ad-active{background:var(--ad-primary);}
      .ad-step{display:none;}
      .ad-step.ad-visible{display:block;}
      .ad-label{font-size:13px;font-weight:600;color:#374151;margin:0 0 10px;display:block;}
      #ad-services-list{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;}
      .ad-svc input{position:absolute;opacity:0;width:0;height:0;}
      .ad-svc label{
        display:flex;align-items:center;gap:8px;padding:10px 12px;
        border:1.5px solid #e5e7eb;border-radius:10px;cursor:pointer;
        font-size:13.5px;color:#374151;background:#fafafa;
        transition:all 0.15s;user-select:none;
      }
      .ad-svc label::before{
        content:'';width:16px;height:16px;min-width:16px;
        border:2px solid #d1d5db;border-radius:4px;background:#fff;transition:all 0.15s;
      }
      .ad-svc input:checked+label{
        border-color:var(--ad-primary);
        background:rgba(var(--ad-rgb),0.06);
        color:var(--ad-primary);font-weight:600;
      }
      .ad-svc input:checked+label::before{
        background:var(--ad-primary);border-color:var(--ad-primary);
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath d='M1 5l3.5 3.5L11 1' stroke='%23fff' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
        background-size:10px;background-repeat:no-repeat;background-position:center;
      }
      #ad-autre-wrap{display:none;margin-bottom:12px;}
      #ad-autre-wrap.ad-shown{display:block;}
      #ad-autre-text,#ad-description{
        width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
        border-radius:10px;font-size:13.5px;color:#111;outline:none;
        box-sizing:border-box;transition:border-color 0.15s;font-family:inherit;
      }
      #ad-description{resize:none;height:80px;margin-bottom:16px;}
      #ad-autre-text:focus,#ad-description:focus{border-color:var(--ad-primary);}
      #ad-qualif-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;}
      .ad-qualif-btn{
        padding:7px 13px;border:1.5px solid #e5e7eb;border-radius:20px;
        background:#fafafa;font-size:13px;color:#374151;cursor:pointer;transition:all 0.15s;
      }
      .ad-qualif-btn.ad-selected{
        border-color:var(--ad-primary);
        background:rgba(var(--ad-rgb),0.08);
        color:var(--ad-primary);font-weight:600;
      }
      .ad-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .ad-field{margin-bottom:12px;}
      .ad-field label{display:block;font-size:12px;font-weight:600;color:#6b7280;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em;}
      .ad-field input{
        width:100%;padding:10px 12px;border:1.5px solid #e5e7eb;
        border-radius:10px;font-size:14px;color:#111;outline:none;
        box-sizing:border-box;transition:border-color 0.15s;font-family:inherit;
      }
      .ad-field input:focus{border-color:var(--ad-primary);}
      .ad-field input.ad-error{border-color:#ef4444;}
      #ad-footer{padding:16px 24px 20px;display:flex;align-items:center;gap:10px;}
      .ad-btn-back{
        background:none;border:none;color:#6b7280;font-size:13.5px;
        cursor:pointer;padding:8px 4px;font-family:inherit;
      }
      .ad-btn-primary{
        flex:1;background:var(--ad-primary);color:#fff;border:none;
        border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;
        cursor:pointer;font-family:inherit;transition:opacity 0.15s;
      }
      .ad-btn-primary:hover{opacity:0.88;}
      .ad-btn-primary:disabled{opacity:0.6;cursor:not-allowed;}
      #ad-rgpd{text-align:center;font-size:11px;color:#9ca3af;padding:0 24px 16px;line-height:1.5;}
      #ad-branding{
        border-top:1px solid #f3f4f6;padding:10px 24px;
        display:flex;align-items:center;justify-content:center;gap:6px;background:#fafafa;
      }
      #ad-branding span{font-size:11px;color:#9ca3af;}
      #ad-branding a{font-size:11px;color:#6b7280;font-weight:600;text-decoration:none;}
      #ad-success{display:none;text-align:center;padding:40px 30px;}
      #ad-success.ad-visible{display:block;}
      #ad-success .ad-check{
        width:56px;height:56px;border-radius:50%;
        background:rgba(var(--ad-rgb),0.1);
        margin:0 auto 16px;display:flex;align-items:center;justify-content:center;
      }
      #ad-success h3{margin:0 0 8px;font-size:18px;color:#111;font-weight:700;}
      #ad-success p{margin:0;font-size:14px;color:#6b7280;line-height:1.6;}
      #ad-send-error{
        display:none;background:#fef2f2;border:1px solid #fca5a5;
        border-radius:8px;padding:10px 14px;font-size:13px;color:#b91c1c;
        margin:0 24px 12px;text-align:center;
      }
      #ad-send-error.ad-visible{display:block;}
      @media(max-width:480px){
        #ad-services-list{grid-template-columns:1fr;}
        .ad-row{grid-template-columns:1fr;}
        #ad-modal{border-radius:14px 14px 0 0;}
        #ad-overlay{align-items:flex-end;padding:0;}
      }
    `;
  
    function buildServices() {
      let html = config.services.map((s,i) => {
        const isAutre = s.toLowerCase() === 'autre';
        return `<div class="ad-svc" style="position:relative">
          <input type="checkbox" id="ad-s${i}" value="${s}" ${isAutre?'data-autre="1"':''}>
          <label for="ad-s${i}">${s}</label>
        </div>`;
      }).join('');
      if (!config.services.some(s => s.toLowerCase() === 'autre')) {
        const i = config.services.length;
        html += `<div class="ad-svc" style="position:relative">
          <input type="checkbox" id="ad-s${i}" value="Autre" data-autre="1">
          <label for="ad-s${i}">Autre</label>
        </div>`;
      }
      return html;
    }
  
    const html = `
      <div id="ad-overlay" role="dialog" aria-modal="true">
        <div id="ad-modal">
          <div id="ad-header">
            <h2>Demander un devis</h2>
            <p>${config.nom}</p>
            <button id="ad-close" aria-label="Fermer">&times;</button>
          </div>
          <div id="ad-body">
            <div id="ad-progress">
              <div class="ad-dot ad-active" id="ad-dot-1"></div>
              <div class="ad-dot" id="ad-dot-2"></div>
            </div>
            <div class="ad-step ad-visible" id="ad-step-1">
              <span class="ad-label">Pour quel(s) service(s) ?</span>
              <div id="ad-services-list">${buildServices()}</div>
              <div id="ad-autre-wrap">
                <input type="text" id="ad-autre-text" placeholder="Précisez votre besoin...">
              </div>
            </div>
            <div class="ad-step" id="ad-step-2">
              <span class="ad-label">Type de projet</span>
              <div id="ad-qualif-btns">
                <button class="ad-qualif-btn" type="button">Petits travaux</button>
                <button class="ad-qualif-btn" type="button">Rénovation partielle</button>
                <button class="ad-qualif-btn" type="button">Rénovation complète</button>
                <button class="ad-qualif-btn" type="button">Construction neuve</button>
              </div>
              <span class="ad-label">Décrivez votre projet <span style="font-weight:400;color:#9ca3af">(optionnel)</span></span>
              <textarea id="ad-description" placeholder="Quelques mots sur votre projet..."></textarea>
              <div class="ad-row">
                <div class="ad-field">
                  <label for="ad-prenom">Prénom *</label>
                  <input type="text" id="ad-prenom" placeholder="Jean">
                </div>
                <div class="ad-field">
                  <label for="ad-email-prospect">Email *</label>
                  <input type="email" id="ad-email-prospect" placeholder="jean@email.fr">
                </div>
              </div>
            </div>
            <div id="ad-success">
              <div class="ad-check">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ad-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3>Demande envoyée !</h3>
              <p>${config.nom} a bien reçu votre demande.<br>Il vous répondra dans les meilleurs délais.</p>
            </div>
          </div>
          <div id="ad-send-error">Une erreur est survenue. Veuillez réessayer.</div>
          <div id="ad-footer">
            <button class="ad-btn-back" id="ad-btn-back" style="display:none">&#8592; Retour</button>
            <button class="ad-btn-primary" id="ad-btn-next">Suivant</button>
          </div>
          <div id="ad-rgpd">Vos informations sont transmises uniquement à l'artisan et ne sont pas conservées.</div>
          <div id="ad-branding">
            <span>Propulsé par</span>
            <a href="https://artivitrine.fr" target="_blank" rel="noopener">ArtiDevis · ArtiVitrine</a>
          </div>
        </div>
      </div>
    `;
  
    // Mount
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap);
  
    // Refs
    const overlay   = document.getElementById('ad-overlay');
    const btnClose  = document.getElementById('ad-close');
    const btnNext   = document.getElementById('ad-btn-next');
    const btnBack   = document.getElementById('ad-btn-back');
    const step1     = document.getElementById('ad-step-1');
    const step2     = document.getElementById('ad-step-2');
    const success   = document.getElementById('ad-success');
    const sendError = document.getElementById('ad-send-error');
    const dot2      = document.getElementById('ad-dot-2');
    const autreWrap = document.getElementById('ad-autre-wrap');
    const autreText = document.getElementById('ad-autre-text');
    const footer    = document.getElementById('ad-footer');
    const rgpd      = document.getElementById('ad-rgpd');
    let step = 1;
    let qualif = null;
  
    function open() { overlay.classList.add('ad-open'); document.body.style.overflow='hidden'; }
    function close() { overlay.classList.remove('ad-open'); document.body.style.overflow=''; }
  
    // Auto-attach mailto links
    function attach() {
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        el.addEventListener('click', e => { e.preventDefault(); open(); });
      });
      document.querySelectorAll('[data-artidevis]').forEach(el => {
        el.addEventListener('click', open);
      });
    }
  
    document.querySelectorAll('[data-autre]').forEach(cb => {
      cb.addEventListener('change', () => {
        const any = [...document.querySelectorAll('[data-autre]')].some(c => c.checked);
        autreWrap.classList.toggle('ad-shown', any);
      });
    });
  
    document.querySelectorAll('.ad-qualif-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ad-qualif-btn').forEach(b => b.classList.remove('ad-selected'));
        btn.classList.add('ad-selected');
        qualif = btn.textContent;
      });
    });
  
    function goStep2() {
      const checked = [...document.querySelectorAll('#ad-services-list input:checked')];
      if (!checked.length) {
        document.getElementById('ad-services-list').style.outline = '2px solid #ef4444';
        setTimeout(() => document.getElementById('ad-services-list').style.outline = '', 1500);
        return;
      }
      step1.classList.remove('ad-visible');
      step2.classList.add('ad-visible');
      dot2.classList.add('ad-active');
      btnBack.style.display = '';
      btnNext.textContent = 'Envoyer ma demande';
      step = 2;
    }
  
    function validate() {
      let ok = true;
      const p = document.getElementById('ad-prenom');
      const e = document.getElementById('ad-email-prospect');
      [p,e].forEach(f => f.classList.remove('ad-error'));
      if (!p.value.trim()) { p.classList.add('ad-error'); ok = false; }
      if (!e.value.trim() || !e.value.includes('@')) { e.classList.add('ad-error'); ok = false; }
      return ok;
    }
  
    async function send() {
      if (!validate()) return;
      btnNext.disabled = true;
      btnNext.textContent = 'Envoi en cours...';
      sendError.classList.remove('ad-visible');
  
      const checked = [...document.querySelectorAll('#ad-services-list input:checked')];
      const services = checked.map(c => (c.dataset.autre && autreText.value.trim()) ? autreText.value.trim() : c.value);
  
      try {
        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artisanEmail:   config.email,
            artisanNom:     config.nom,
            services,
            typeProjet:     qualif,
            description:    document.getElementById('ad-description').value.trim() || null,
            prospectPrenom: document.getElementById('ad-prenom').value.trim(),
            prospectEmail:  document.getElementById('ad-email-prospect').value.trim(),
          }),
        });
        if (!res.ok) throw new Error();
        step2.classList.remove('ad-visible');
        success.classList.add('ad-visible');
        footer.style.display = 'none';
        rgpd.style.display = 'none';
      } catch {
        sendError.classList.add('ad-visible');
        btnNext.disabled = false;
        btnNext.textContent = 'Réessayer';
      }
    }
  
    btnClose.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    btnBack.addEventListener('click', () => {
      step2.classList.remove('ad-visible');
      step1.classList.add('ad-visible');
      dot2.classList.remove('ad-active');
      btnBack.style.display = 'none';
      btnNext.textContent = 'Suivant';
      step = 1;
    });
    btnNext.addEventListener('click', () => { if (step === 1) goStep2(); else send(); });
    window.ArtiDevis = { open };
  
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
    else attach();
  })();