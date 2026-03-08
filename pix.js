(function () {
  const SUPABASE_FN = 'https://khrygwuykvojnlnaqmys.supabase.co/functions/v1';
  const SUPABASE_URL = 'https://khrygwuykvojnlnaqmys.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtocnlnd3V5a3Zvam5sbmFxbXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE2NTU4NTksImV4cCI6MjA1NzIzMTg1OX0.4lrhDNMmH6NsGg8SJjv5zrHMsDPsVoNVkiTTtHb5PEo';

  let _cfg = null;
  let timerIv = null;
  let _realtimeChannel = null;
  let _currentReference = null;

  function injectStyles(accent) {
    const old = document.getElementById('payos-styles');
    if (old) old.remove();
    const style = document.createElement('style');
    style.id = 'payos-styles';
    style.textContent = `
      #payos-overlay {
        position:fixed;inset:0;z-index:999999;
        background:rgba(0,0,0,.75);backdrop-filter:blur(6px);
        display:flex;align-items:center;justify-content:center;
        padding:16px;animation:payos-fade .2s ease;
      }
      @keyframes payos-fade{from{opacity:0}to{opacity:1}}
      #payos-modal {
        background:#0a0b0f;border:1px solid #1a1d2e;
        border-radius:20px;width:100%;max-width:380px;
        overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.8);
        animation:payos-up .3s cubic-bezier(.34,1.56,.64,1);
        font-family:'JetBrains Mono',monospace,sans-serif;
      }
      @keyframes payos-up{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:none}}
      #payos-header{padding:18px 20px;border-bottom:1px solid #1a1d2e;display:flex;align-items:center;justify-content:space-between;}
      #payos-logo{font-size:.95rem;font-weight:800;letter-spacing:-1px;color:ACCENT;text-shadow:0 0 20px ACCENTaa;}
      #payos-close{background:none;border:none;color:#6b7280;font-size:1.2rem;cursor:pointer;line-height:1;padding:2px 6px;border-radius:6px;transition:all .15s;}
      #payos-close:hover{background:#1a1d2e;color:#e8edf5;}
      #payos-body{padding:24px 20px;text-align:center;}
      #payos-amount{font-size:1.8rem;font-weight:800;letter-spacing:-1px;color:#e8edf5;margin-bottom:4px;}
      #payos-desc{font-size:.7rem;color:#6b7280;margin-bottom:20px;letter-spacing:1px;}
      #payos-qr-wrap{background:#fff;border-radius:14px;padding:12px;display:inline-block;margin-bottom:16px;}
      #payos-qr-wrap canvas,#payos-qr-wrap img{display:block;}
      #payos-code{background:#050608;border:1px solid ACCENTaa;border-radius:10px;padding:12px 14px;font-size:.65rem;color:ACCENT;word-break:break-all;text-align:left;cursor:pointer;transition:background .15s;line-height:1.7;margin-bottom:12px;}
      #payos-copy{width:100%;padding:13px;border-radius:10px;border:1px solid ACCENTaa;cursor:pointer;transition:all .2s;background:ACCENTaa;color:ACCENT;font-size:.8rem;font-weight:600;letter-spacing:1px;font-family:inherit;text-transform:uppercase;}
      #payos-copy:hover{box-shadow:0 0 24px ACCENTaa;}
      #payos-copy.copied{background:rgba(0,255,136,.15);border-color:rgba(0,255,136,.3);color:#00ff88;}
      #payos-timer{font-size:.65rem;color:#6b7280;margin-top:10px;}
      #payos-timer span{color:#ffb800;font-weight:600;}
      #payos-loading{padding:40px 0;color:#6b7280;font-size:.8rem;}
      #payos-loading .payos-spin{display:inline-block;width:28px;height:28px;border:3px solid #1a1d2e;border-top-color:ACCENT;border-radius:50%;animation:payos-rot .7s linear infinite;margin-bottom:12px;}
      @keyframes payos-rot{to{transform:rotate(360deg)}}
      #payos-error{padding:32px 20px;color:#ff3d5a;font-size:.78rem;line-height:1.7;}
      #payos-footer{padding:10px 20px 16px;text-align:center;font-size:.58rem;color:#374151;border-top:1px solid #1a1d2e;}
      #payos-footer a{color:#6b7280;text-decoration:none;}
    `.replace(/ACCENT/g, accent);
    document.head.appendChild(style);
  }

  async function loadConfig() {
    const userId = (window.PayOSConfig || {}).userId;
    const productId = (window.PayOSConfig || {}).productId;
    if (_cfg && _cfg._productId === productId) return _cfg;
    const resp = await fetch(`${SUPABASE_FN}/get-pix-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, product_id: productId })
    });
    if (!resp.ok) throw new Error('Configuração não encontrada');
    _cfg = await resp.json();
    _cfg._productId = productId;
    return _cfg;
  }

  function loadQRLib(cb) {
    if (window.QRCode) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function drawQR(containerId, code) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    new QRCode(el, { text: code, width: 200, height: 200, colorDark: '#000', colorLight: '#fff' });
  }

  function startTimer(elId, mins) {
    clearInterval(timerIv);
    let secs = mins * 60;
    const el = document.getElementById(elId);
    if (!el) return;
    timerIv = setInterval(() => {
      secs--;
      if (secs <= 0) { clearInterval(timerIv); el.textContent = 'Expirado'; el.style.color = '#ff3d5a'; return; }
      const m = Math.floor(secs / 60), s = secs % 60;
      el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if (secs < 60) el.style.color = '#ff3d5a';
    }, 1000);
  }

  function fmtBRL(cents) {
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
  }

  function closeModal() {
    clearInterval(timerIv);
    stopRealtime();
    const el = document.getElementById('payos-overlay');
    if (el) el.remove();
  }

  function stopRealtime() {
    if (_realtimeChannel) {
      clearInterval(_realtimeChannel);
      _realtimeChannel = null;
    }
  }

  function showConfirmed(redirectUrl) {
    clearInterval(timerIv);
    stopRealtime();
    const body = document.getElementById('payos-body');
    if (!body) return;
    body.innerHTML = `
      <div style="padding:32px 20px;text-align:center;">
        <div style="font-size:3rem;margin-bottom:12px;animation:payos-up .4s ease;">✅</div>
        <div style="font-size:1.1rem;font-weight:800;color:#00ff88;margin-bottom:8px;">Pagamento confirmado!</div>
        <div style="font-size:.72rem;color:#6b7280;line-height:1.7;">Seu pagamento foi recebido com sucesso.</div>
        ${redirectUrl ? `<div style="font-size:.68rem;color:#6b7280;margin-top:12px;">Redirecionando em <span id="payos-redir-count" style="color:#00e5ff;font-weight:700;">3</span>s...</div>` : ''}
      </div>
    `;
    if (redirectUrl) {
      let count = 3;
      const iv = setInterval(() => {
        count--;
        const el = document.getElementById('payos-redir-count');
        if (el) el.textContent = count;
        if (count <= 0) { clearInterval(iv); window.location.href = redirectUrl; }
      }, 1000);
    } else {
      setTimeout(() => closeModal(), 3000);
    }
  }

  function buildRedirectUrl(baseUrl) {
    if (!baseUrl) return null;
    try {
      const current = new URLSearchParams(window.location.search);
      const target = new URL(baseUrl);
      const utmKeys = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','src'];
      utmKeys.forEach(k => {
        if (current.get(k)) target.searchParams.set(k, current.get(k));
      });
      return target.toString();
    } catch(e) {
      return baseUrl;
    }
  }

  function startRealtime(reference, userId, redirectUrl) {
    stopRealtime();
    const since = new Date().toISOString();
    const finalUrl = buildRedirectUrl(redirectUrl);
    _realtimeChannel = setInterval(async () => {
      try {
        const res = await fetch(`${SUPABASE_FN}/check-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, since })
        });
        const data = await res.json();
        if (data && data.paid) {
          showConfirmed(finalUrl);
        }
      } catch(e) {}
    }, 3000);
  }

  function openModal(accent) {
    closeModal();
    injectStyles(accent || '#00e5ff');
    const overlay = document.createElement('div');
    overlay.id = 'payos-overlay';
    overlay.innerHTML = `
      <div id="payos-modal">
        <div id="payos-header">
          <span id="payos-logo">PayOS</span>
          <button id="payos-close" onclick="PayOS.fechar()">✕</button>
        </div>
        <div id="payos-body">
          <div id="payos-loading"><div class="payos-spin"></div><br>Gerando PIX...</div>
        </div>
        <div id="payos-footer">Pagamento seguro via <a href="https://pixflow1.vercel.app" target="_blank">PayOS</a></div>
      </div>
    `;
    overlay.addEventListener('click', function(e) { if (e.target === overlay) PayOS.fechar(); });
    document.body.appendChild(overlay);
  }

  function showPix(pixCode, amount, description) {
    const body = document.getElementById('payos-body');
    if (!body) return;
    body.innerHTML = `
      <div id="payos-amount">${fmtBRL(amount)}</div>
      <div id="payos-desc">${(description || 'PAGAMENTO PIX').toUpperCase()}</div>
      <div id="payos-qr-wrap"><div id="payos-qr"></div></div>
      <div id="payos-code" onclick="PayOS._copiar()">${pixCode.substring(0,120)}${pixCode.length>120?'...':''}</div>
      <button id="payos-copy" onclick="PayOS._copiar()">📋 Copiar código PIX</button>
      <div id="payos-timer">⏱ Expira em <span id="payos-countdown">15:00</span></div>
    `;
    PayOS._pixCode = pixCode;
    loadQRLib(() => drawQR('payos-qr', pixCode));
    startTimer('payos-countdown', 15);
  }

  function showError(msg) {
    const body = document.getElementById('payos-body');
    if (!body) return;
    body.innerHTML = `<div id="payos-error">⚠️ ${msg}<br><br><button onclick="PayOS.fechar()" style="background:none;border:1px solid #ff3d5a;color:#ff3d5a;padding:8px 16px;border-radius:8px;cursor:pointer;font-family:inherit;font-size:.75rem;">Fechar</button></div>`;
  }

  async function generatePix(cfg) {
    const userId = (window.PayOSConfig || {}).userId;
    const webhookUrl = `${SUPABASE_FN}/webhook?user=${userId}`;
    const reference = 'REF-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
    try {
      let resp, data, pixCode;
      if (cfg.gateway === 'pp') {
        resp = await fetch(`${SUPABASE_FN}/pix-pp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: cfg.api_key,
            amount: cfg.amount,
            description: cfg.description || 'Pagamento',
            reference,
            postback_url: webhookUrl,
            product_hash: cfg.pp_product_hash || null,
            customer: { name:'Cliente', email:'cliente+' + Math.random().toString(36).substr(2,8) + '@pagamento.com', phone:'11999999999', document: cfg.seller_doc || '00000000000' }
          })
        });
        data = await resp.json();
        pixCode = data.qr_code;
      } else {
        resp = await fetch(`${SUPABASE_FN}/pix-z1`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_token: cfg.api_key,
            amount: cfg.amount,
            offer_hash: cfg.offer_hash,
            product_hash: cfg.product_hash,
            description: cfg.description || 'Pagamento',
            webhook_url: webhookUrl,
            customer: { name:'Cliente', email:'cliente@pagamento.com', phone_number:'11999999999', document: cfg.seller_doc || '00000000000' }
          })
        });
        data = await resp.json();
        pixCode = data._qr_code || data.pix?.pix_qr_code || data.pix?.qr_code;
      }
      if (pixCode) {
        showPix(pixCode, cfg.amount, cfg.description);
        startRealtime(reference, userId, cfg.redirect_url || null);
      } else {
        showError('Não foi possível gerar o PIX. Tente novamente.');
      }
    } catch (e) {
      showError('Erro de conexão. Verifique sua internet e tente novamente.');
    }
  }


  window.PayOS = {
    _pixCode: '',
    pagar: async function () {
      const currentUserId = (window.PayOSConfig || {}).userId;
      if (!currentUserId) { alert('PayOS: userId não configurado!'); return; }
      _cfg = null;
      openModal('#00e5ff');
      try {
        const cfg = await loadConfig();
        injectStyles(cfg.accent_color || '#00e5ff');
        await generatePix(cfg);
      } catch (e) {
        showError('Erro ao carregar configuração. Verifique seu PayOS.');
      }
    },
    gerarInline: async function(btn) {
      const userId = (window.PayOSConfig || {}).userId;
      if (!userId) return;
      btn.disabled = true;
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:_prot .7s linear infinite;vertical-align:middle;margin-right:6px;"></span>Gerando...';
      if (!document.getElementById('_prot')) { const st=document.createElement('style'); st.id='_prot'; st.textContent='@keyframes _prot{to{transform:rotate(360deg)}} @keyframes _pfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'; document.head.appendChild(st); }
      try {
        const cfgRes = await fetch(`${SUPABASE_FN}/get-pix-config`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: userId, product_id: (window.PayOSConfig||{}).productId }) });
        const cfg = await cfgRes.json();
        const accentColor = cfg.accent_color || '#e11d48';
        const webhookUrl = `${SUPABASE_FN}/webhook?user=${userId}`;
        const reference = 'REF-' + Date.now() + '-' + Math.random().toString(36).substr(2,6).toUpperCase();
        let pixCode;
        if (cfg.gateway === 'pp') {
          const r = await fetch(`${SUPABASE_FN}/pix-pp`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ api_key:cfg.api_key, amount:cfg.amount, description:cfg.description||'Pagamento', reference, postback_url:webhookUrl, product_hash:cfg.pp_product_hash||null, customer:{name:'Cliente',email:'cliente+'+Math.random().toString(36).substr(2,8)+'@pagamento.com',phone:'11999999999',document:cfg.seller_doc||'00000000000'} }) });
          const d = await r.json(); pixCode = d.qr_code;
        } else {
          const r = await fetch(`${SUPABASE_FN}/pix-z1`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ api_token:cfg.api_key, amount:cfg.amount, offer_hash:cfg.offer_hash, product_hash:cfg.product_hash, description:cfg.description||'Pagamento', webhook_url:webhookUrl, customer:{name:'Cliente',email:'cliente@pagamento.com',phone_number:'11999999999',document:cfg.seller_doc||'00000000000'} }) });
          const d = await r.json(); pixCode = d._qr_code || d.pix?.pix_qr_code || d.pix?.qr_code;
        }
        if (!pixCode) { btn.innerHTML = originalHTML; btn.disabled = false; return; }
        const qrId = 'payos-il-qr-' + Date.now();
        const div = document.createElement('div');
        div.style.cssText = 'font-family:-apple-system,sans-serif;animation:_pfade .3s ease;';
        div.innerHTML = `
          <div style="background:#f8f8f8;border-radius:12px;padding:16px;display:flex;justify-content:center;margin-bottom:14px;" id="${qrId}"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:#f8f8f8;border-radius:10px;padding:12px 16px;margin-bottom:10px;">
            <span style="font-size:.8rem;color:#888;">Valor PIX:</span>
            <span style="font-size:1.1rem;font-weight:800;color:#111;">R$ ${(cfg.amount/100).toFixed(2).replace('.',',')}</span>
          </div>
          <div style="background:#f8f8f8;border-radius:10px;padding:10px 12px;font-size:.6rem;color:#555;word-break:break-all;margin-bottom:12px;">${pixCode.substring(0,80)}...</div>
          <button id="payos-il-copy" style="width:100%;padding:14px;border-radius:12px;border:none;background:${accentColor};color:#fff;font-size:.85rem;font-weight:700;cursor:pointer;">📋 Copiar código PIX</button>
          <div id="payos-il-ok" style="display:none;text-align:center;padding:16px 0;">
            <div style="font-size:2rem;margin-bottom:6px;">✅</div>
            <div style="font-weight:800;color:#22c55e;font-size:.95rem;">Pagamento confirmado!</div>
            ${cfg.redirect_url ? `<div style="font-size:.7rem;color:#888;margin-top:6px;">Redirecionando em <span id="payos-il-redir">3</span>s...</div>` : ''}
          </div>`;
        btn.replaceWith(div);
        document.getElementById('payos-il-copy').onclick = function() {
          navigator.clipboard.writeText(pixCode).then(() => { this.textContent='✓ Copiado!'; this.style.background='#22c55e'; setTimeout(()=>{this.textContent='📋 Copiar código PIX';this.style.background=accentColor;},2500); });
        };
        const drawQR = () => new QRCode(document.getElementById(qrId), {text:pixCode,width:200,height:200,colorDark:'#000',colorLight:'#fff'});
        if (window.QRCode) drawQR(); else { const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload=drawQR; document.head.appendChild(s); }
        const since = new Date().toISOString();
        const redirectUrl = cfg.redirect_url || null;
        const pollIv = setInterval(async () => {
          try {
            const res = await fetch(`${SUPABASE_FN}/check-payment`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id: userId, since }) });
            const data = await res.json();
            if (data && data.paid) {
              clearInterval(pollIv);
              const conf = document.getElementById('payos-il-ok');
              if (conf) conf.style.display = 'block';
              if (redirectUrl) { let c=3; const iv=setInterval(()=>{ c--; const el=document.getElementById('payos-il-redir'); if(el) el.textContent=c; if(c<=0){clearInterval(iv);window.location.href=redirectUrl;} },1000); }
            }
          } catch(e) {}
        }, 3000);
      } catch(e) { btn.innerHTML = originalHTML; btn.disabled = false; }
    },
    fechar: function () { closeModal(); },
    _copiar: function () {
      if (!this._pixCode) return;
      navigator.clipboard.writeText(this._pixCode).then(() => {
        const btn = document.getElementById('payos-copy');
        if (btn) { btn.textContent = '✓ Código copiado!'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = '📋 Copiar código PIX'; btn.classList.remove('copied'); }, 2500); }
      });
    }
  };

})();
