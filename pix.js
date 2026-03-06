(function () {
  // ── CONFIG injetada pelo vendedor ──────────────────────
  // window.PayOSConfig = {
  //   gateway: 'pp',           // 'pp' = Paradise | 'z1' = Zero One
  //   apiKey: 'sk_...',        // X-API-Key (PP) ou api_token (Z1)
  //   amount: 1990,            // valor em centavos
  //   description: 'Produto',  // descrição (PP) ou título (Z1)
  //   offerHash: '...',        // só Z1
  //   productHash: '...',      // só Z1
  //   sellerDoc: '00000000000',// CPF fallback do vendedor
  //   userId: '...',           // ID do usuário no PayOS (para webhook)
  //   accentColor: '#00e5ff',  // cor do botão (opcional)
  // }

  const SUPABASE_FN = 'https://khrygwuykvojnlnaqmys.supabase.co/functions/v1';

  const cfg = window.PayOSConfig || {};
  const accent = cfg.accentColor || '#00e5ff';

  // ── INJECT STYLES ──────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #payos-overlay {
      position: fixed; inset: 0; z-index: 999999;
      background: rgba(0,0,0,.75); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 16px; animation: payos-fade .2s ease;
    }
    @keyframes payos-fade { from { opacity: 0 } to { opacity: 1 } }
    #payos-modal {
      background: #0a0b0f; border: 1px solid #1a1d2e;
      border-radius: 20px; width: 100%; max-width: 380px;
      overflow: hidden; box-shadow: 0 32px 80px rgba(0,0,0,.8);
      animation: payos-up .3s cubic-bezier(.34,1.56,.64,1);
      font-family: 'JetBrains Mono', monospace, sans-serif;
    }
    @keyframes payos-up { from { opacity:0; transform: translateY(30px) scale(.95) } to { opacity:1; transform: none } }
    #payos-header {
      padding: 18px 20px; border-bottom: 1px solid #1a1d2e;
      display: flex; align-items: center; justify-content: space-between;
    }
    #payos-logo { font-size: .95rem; font-weight: 800; letter-spacing: -1px; color: ${accent}; text-shadow: 0 0 20px ${accent}66; }
    #payos-close {
      background: none; border: none; color: #6b7280;
      font-size: 1.2rem; cursor: pointer; line-height: 1;
      padding: 2px 6px; border-radius: 6px; transition: all .15s;
    }
    #payos-close:hover { background: #1a1d2e; color: #e8edf5; }
    #payos-body { padding: 24px 20px; text-align: center; }
    #payos-amount {
      font-size: 1.8rem; font-weight: 800; letter-spacing: -1px;
      color: #e8edf5; margin-bottom: 4px;
    }
    #payos-desc { font-size: .7rem; color: #6b7280; margin-bottom: 20px; letter-spacing: 1px; }
    #payos-qr-wrap {
      background: #fff; border-radius: 14px; padding: 12px;
      display: inline-block; margin-bottom: 16px;
    }
    #payos-qr-wrap canvas, #payos-qr-wrap img { display: block; }
    #payos-code {
      background: #050608; border: 1px solid ${accent}33;
      border-radius: 10px; padding: 12px 14px;
      font-size: .65rem; color: ${accent}; word-break: break-all;
      text-align: left; cursor: pointer; transition: background .15s;
      line-height: 1.7; margin-bottom: 12px;
    }
    #payos-code:hover { background: ${accent}08; }
    #payos-copy {
      width: 100%; padding: 13px; border-radius: 10px;
      border: 1px solid ${accent}44; cursor: pointer; transition: all .2s;
      background: ${accent}15; color: ${accent};
      font-size: .8rem; font-weight: 600; letter-spacing: 1px;
      font-family: inherit; text-transform: uppercase;
    }
    #payos-copy:hover { background: ${accent}25; box-shadow: 0 0 24px ${accent}22; }
    #payos-copy.copied { background: rgba(0,255,136,.15); border-color: rgba(0,255,136,.3); color: #00ff88; }
    #payos-timer { font-size: .65rem; color: #6b7280; margin-top: 10px; }
    #payos-timer span { color: #ffb800; font-weight: 600; }
    #payos-loading { padding: 40px 0; color: #6b7280; font-size: .8rem; }
    #payos-loading .payos-spin {
      display: inline-block; width: 28px; height: 28px;
      border: 3px solid #1a1d2e; border-top-color: ${accent};
      border-radius: 50%; animation: payos-rot .7s linear infinite; margin-bottom: 12px;
    }
    @keyframes payos-rot { to { transform: rotate(360deg) } }
    #payos-error { padding: 32px 20px; color: #ff3d5a; font-size: .78rem; line-height: 1.7; }
    #payos-footer {
      padding: 10px 20px 16px; text-align: center;
      font-size: .58rem; color: #374151; border-top: 1px solid #1a1d2e;
    }
    #payos-footer a { color: #6b7280; text-decoration: none; }
  `;
  document.head.appendChild(style);

  // ── LOAD QRCODE LIB ───────────────────────────────────
  function loadQRLib(cb) {
    if (window.QRCode) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ── DRAW QR ───────────────────────────────────────────
  function drawQR(containerId, code) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    new QRCode(el, { text: code, width: 200, height: 200, colorDark: '#000', colorLight: '#fff' });
  }

  // ── TIMER ─────────────────────────────────────────────
  let timerIv = null;
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

  // ── FORMAT BRL ────────────────────────────────────────
  function fmtBRL(cents) {
    return 'R$ ' + (cents / 100).toFixed(2).replace('.', ',');
  }

  // ── CLOSE MODAL ───────────────────────────────────────
  function closeModal() {
    clearInterval(timerIv);
    const el = document.getElementById('payos-overlay');
    if (el) el.remove();
  }

  // ── OPEN MODAL ────────────────────────────────────────
  function openModal() {
    closeModal();

    const overlay = document.createElement('div');
    overlay.id = 'payos-overlay';
    overlay.innerHTML = `
      <div id="payos-modal">
        <div id="payos-header">
          <span id="payos-logo">PayOS</span>
          <button id="payos-close" onclick="PayOS.fechar()">✕</button>
        </div>
        <div id="payos-body">
          <div id="payos-loading">
            <div class="payos-spin"></div><br>Gerando PIX...
          </div>
        </div>
        <div id="payos-footer">Pagamento seguro via <a href="https://pixflow1.vercel.app" target="_blank">PayOS</a></div>
      </div>
    `;
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) PayOS.fechar();
    });
    document.body.appendChild(overlay);
  }

  function showPix(pixCode, amount, description) {
    const body = document.getElementById('payos-body');
    if (!body) return;
    body.innerHTML = `
      <div id="payos-amount">${fmtBRL(amount)}</div>
      <div id="payos-desc">${(description || 'PAGAMENTO PIX').toUpperCase()}</div>
      <div id="payos-qr-wrap"><div id="payos-qr"></div></div>
      <div id="payos-code" onclick="PayOS._copiar()">${pixCode.substring(0, 120)}${pixCode.length > 120 ? '...' : ''}</div>
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

  // ── GENERATE PIX ──────────────────────────────────────
  async function generatePix() {
    const gw = cfg.gateway || 'pp';
    const amount = cfg.amount || 0;
    const webhookUrl = cfg.userId
      ? `${SUPABASE_FN}/webhook?user=${cfg.userId}`
      : null;

    try {
      let resp, data, pixCode;

      if (gw === 'pp') {
        resp = await fetch(`${SUPABASE_FN}/pix-pp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: cfg.apiKey,
            amount,
            description: cfg.description || 'Pagamento',
            reference: 'REF-' + Date.now(),
            postback_url: webhookUrl,
            customer: {
              name: 'Cliente',
              email: 'cliente@pagamento.com',
              phone: '11999999999',
              document: cfg.sellerDoc || '00000000000'
            }
          })
        });
        data = await resp.json();
        pixCode = data.qr_code;

      } else {
        resp = await fetch(`${SUPABASE_FN}/pix-z1`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_token: cfg.apiKey,
            amount,
            offer_hash: cfg.offerHash,
            product_hash: cfg.productHash,
            description: cfg.description || 'Pagamento',
            webhook_url: webhookUrl,
            customer: {
              name: 'Cliente',
              email: 'cliente@pagamento.com',
              phone_number: '11999999999',
              document: cfg.sellerDoc || '00000000000'
            }
          })
        });
        data = await resp.json();
        pixCode = data._qr_code || data.pix?.pix_qr_code || data.pix?.qr_code;
      }

      if (pixCode) {
        showPix(pixCode, amount, cfg.description);
      } else {
        showError('Não foi possível gerar o PIX. Tente novamente.');
      }

    } catch (e) {
      showError('Erro de conexão. Verifique sua internet e tente novamente.');
    }
  }

  // ── PUBLIC API ────────────────────────────────────────
  window.PayOS = {
    _pixCode: '',

    pagar: function () {
      openModal();
      generatePix();
    },

    fechar: function () {
      closeModal();
    },

    _copiar: function () {
      if (!this._pixCode) return;
      navigator.clipboard.writeText(this._pixCode).then(() => {
        const btn = document.getElementById('payos-copy');
        if (btn) {
          btn.textContent = '✓ Código copiado!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = '📋 Copiar código PIX';
            btn.classList.remove('copied');
          }, 2500);
        }
      });
    }
  };

})();
