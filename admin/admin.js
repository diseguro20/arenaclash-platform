const adminApp = {
  token: null,
  user: null,
  activeView: 'overview',
  refreshInterval: null,

  getToken() {
    let t = localStorage.getItem('arenaclash_token') || localStorage.getItem('token');
    if (!t) {
      const match = document.cookie.match(/(?:^|;\s*)(?:hw_session|token)=([^;]+)/);
      if (match) t = decodeURIComponent(match[1]);
    }
    return t;
  },

  setToken(t, u) {
    this.token = t;
    this.user = u;
    localStorage.setItem('arenaclash_token', t);
    if (u) localStorage.setItem('arenaclash_admin_user', JSON.stringify(u));
    document.cookie = `hw_session=${encodeURIComponent(t)}; path=/; max-age=604800; SameSite=Lax`;
  },

  getHeaders() {
    const t = this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': t ? `Bearer ${t}` : '',
    };
  },

  async init() {
    this.token = this.getToken();
    if (!this.token) {
      this.showLoginModal();
      return;
    }

    try {
      // Validate token with stats endpoint
      const res = await fetch('/api/admin/stats', { headers: this.getHeaders() });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          this.showLoginModal('Sua sessão expirou ou você não possui permissão de administrador.');
          return;
        }
      }
      this.hideLoginModal();
      
      const storedUser = localStorage.getItem('arenaclash_admin_user');
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          document.getElementById('admin-name').textContent = u.nome || 'Administrador';
          document.getElementById('admin-avatar').textContent = (u.nome || 'AD').slice(0, 2).toUpperCase();
        } catch (_) {}
      }

      this.loadStats();
      this.loadUsers();
      this.loadDeposits();
      this.loadWithdrawals();
      this.loadAffiliates();
      this.loadGames();
      this.loadSettings();

      // Set up periodic refresh
      if (this.refreshInterval) clearInterval(this.refreshInterval);
      this.refreshInterval = setInterval(() => {
        if (this.activeView === 'overview') this.loadStats();
        else if (this.activeView === 'players') this.loadUsers();
        else if (this.activeView === 'deposits') this.loadDeposits();
        else if (this.activeView === 'withdrawals') this.loadWithdrawals();
      }, 30000);

    } catch (err) {
      console.warn('Init error:', err);
      this.showLoginModal();
    }
  },

  switchView(viewName, btn) {
    this.activeView = viewName;
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');
    if (btn) btn.classList.add('active');

    const titles = {
      overview: 'Visão Geral e Métricas',
      players: 'Base de Jogadores',
      deposits: 'Depósitos PIX (Entradas)',
      withdrawals: 'Saques PIX (Saídas)',
      affiliates: 'Afiliados & Influenciadores',
      games: 'Auditoria de Partidas (Helix Jump)',
      audit: 'Trilha de Auditoria Administrativa',
      settings: 'Configurações da Plataforma',
    };
    document.getElementById('topbar-page-title').textContent = titles[viewName] || 'Painel';

    // Lazy load specific view data
    if (viewName === 'overview') this.loadStats();
    if (viewName === 'players') this.loadUsers();
    if (viewName === 'deposits') this.loadDeposits();
    if (viewName === 'withdrawals') this.loadWithdrawals();
    if (viewName === 'affiliates') this.loadAffiliates();
    if (viewName === 'games') this.loadGames();
    if (viewName === 'audit') this.loadAudit();
    if (viewName === 'settings') this.loadSettings();
  },

  fmtMoney(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  fmtDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) {
      return dateStr;
    }
  },

  toast(msg, isError = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.borderLeftColor = isError ? 'var(--accent-red)' : 'var(--primary)';
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  },

  // 1. STATS
  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats', { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const m = data.metrics || {};
      document.getElementById('stat-total-users').textContent = m.totalUsers || 0;
      document.getElementById('stat-active-users').textContent = `${m.activeUsers || 0} ativos`;
      document.getElementById('stat-total-bets').textContent = this.fmtMoney(m.totalBets);
      document.getElementById('stat-total-payouts').textContent = this.fmtMoney(m.totalPayouts);
      document.getElementById('stat-house-profit').textContent = this.fmtMoney(m.houseProfit);
      document.getElementById('stat-total-deposited').textContent = this.fmtMoney(m.totalDeposited);
      document.getElementById('stat-total-withdrawn').textContent = this.fmtMoney(m.totalWithdrawn);
      document.getElementById('stat-wallet-balance').textContent = this.fmtMoney(m.totalWalletBalance);
      document.getElementById('stat-bonus-balance').textContent = this.fmtMoney(m.totalBonusBalance);
      document.getElementById('stat-affiliate-balance').textContent = this.fmtMoney(m.totalAffiliateBalance);

      document.getElementById('stat-games-summary').textContent = `${m.totalGames || 0} rodadas (${m.wins || 0}V · ${m.losses || 0}D)`;
      document.getElementById('badge-pending-deposits').textContent = m.pendingDepositsCount || 0;
      document.getElementById('badge-pending-withdrawals').textContent = m.pendingWithdrawalsCount || 0;

      // Difficulty buttons
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      const activeDiff = document.getElementById('diff-' + (data.settings?.difficulty || 'balanced'));
      if (activeDiff) activeDiff.classList.add('active');

    } catch (err) {
      console.warn('Erro ao carregar estatísticas:', err);
    }
  },

  // 2. USERS
  userSearchTimeout: null,
  scheduleUserSearch(val) {
    clearTimeout(this.userSearchTimeout);
    this.userSearchTimeout = setTimeout(() => this.loadUsers(val), 350);
  },

  async loadUsers(q = '') {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">Carregando jogadores...</td></tr>';

    try {
      const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.users || data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhum jogador encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = data.users.map(u => `
        <tr>
          <td>
            <div style="font-weight:700;color:#fff;">${u.nome}</div>
            <div style="font-size:11px;color:var(--text-muted);">${u.telefone || u.email}</div>
            <div style="font-size:10px;color:rgba(255,255,255,0.4);">ID: ${u.id.slice(0, 10)}… · Ref: <b>${u.codigo_convite}</b></div>
          </td>
          <td>
            <strong style="color:var(--accent-green);">${this.fmtMoney(u.saldo)}</strong>
            ${u.saldo_bonus > 0 ? `<div style="font-size:11px;color:var(--accent-amber);">Bônus: ${this.fmtMoney(u.saldo_bonus)}</div>` : ''}
          </td>
          <td>
            <strong style="color:#fff;">${this.fmtMoney(u.saldo_afiliado)}</strong>
            <div style="font-size:11px;color:var(--text-muted);">${u.indicado_por ? `Indicado por: ${u.indicado_por}` : 'Orgânico'}</div>
          </td>
          <td>
            <span class="badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}">${u.status === 'active' ? 'Ativo' : 'Suspenso'}</span>
            ${u.is_admin ? '<span class="badge badge-pink" style="margin-left:4px;">ADMIN</span>' : ''}
            ${u.is_influencer ? '<span class="badge badge-blue" style="margin-left:4px;">INFLUENCER</span>' : ''}
          </td>
          <td style="font-size:12px;color:var(--text-muted);">${this.fmtDate(u.created_at)}</td>
          <td>
            <div class="action-row">
              <button class="btn-sm btn-primary" onclick="adminApp.openBalanceModal('${u.id}', '${u.nome}', ${u.saldo})">R$ Saldo</button>
              <button class="btn-sm" onclick="adminApp.openInfluencerModal('${u.id}', '${u.nome}', '${u.codigo_convite}', ${u.influencer_rate1}, ${u.influencer_rate2}, ${u.is_influencer})">Influencer</button>
              <button class="btn-sm" onclick="adminApp.toggleAdmin('${u.id}', ${u.is_admin})">${u.is_admin ? 'Tirar Admin' : 'Dar Admin'}</button>
              <button class="btn-sm" onclick="adminApp.openPasswordModal('${u.id}', '${u.nome}')">Senha</button>
              <button class="btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-primary'}" onclick="adminApp.toggleStatus('${u.id}', '${u.status}')">${u.status === 'active' ? 'Suspender' : 'Reativar'}</button>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</td></tr>`;
    }
  },

  // 3. DEPOSITS
  async loadDeposits(status = 'all', q = '') {
    const tbody = document.getElementById('deposits-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Carregando depósitos...</td></tr>';

    try {
      const res = await fetch(`/api/admin/finance/deposits?status=${status}&q=${encodeURIComponent(q)}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.deposits || data.deposits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhum depósito encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = data.deposits.map(d => {
        const isApproved = d.status === 'aprovado' || d.status === 'COMPLETED' || d.status === 'approved';
        const isPending = d.status === 'pending' || d.status === 'pendente';
        return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;">${d.user_nome || 'Jogador'}</div>
              <div style="font-size:11px;color:var(--text-muted);">${d.user_telefone || d.user_email || '—'}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);">ID: ${d.id.slice(0, 16)}…</div>
            </td>
            <td><strong style="color:var(--accent-green);font-size:14px;">${this.fmtMoney(d.valor || d.amount)}</strong></td>
            <td><span class="badge ${d.gateway === 'omega' ? 'badge-blue' : 'badge-pink'}">${(d.gateway || 'Vizzion').toUpperCase()}</span></td>
            <td><span class="badge ${isApproved ? 'badge-green' : isPending ? 'badge-amber' : 'badge-red'}">${isApproved ? 'APROVADO' : isPending ? 'PENDENTE' : 'FALHOU'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${this.fmtDate(d.created_at)}</td>
            <td>
              ${isPending ? `<button class="btn-sm btn-primary" onclick="adminApp.forceApproveDeposit('${d.id}')">✓ Aprovar e Creditar</button>` : '<span style="font-size:12px;color:var(--accent-green);">Creditado</span>'}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</td></tr>`;
    }
  },

  async forceApproveDeposit(depositId) {
    if (!confirm('Deseja realmente aprovar manualmente este depósito e creditar o saldo do usuário?')) return;
    try {
      const res = await fetch('/api/admin/finance/deposits', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ depositId, action: 'force_approve' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.toast('Depósito aprovado e saldo creditado!');
      this.loadDeposits();
      this.loadStats();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // 4. WITHDRAWALS
  async loadWithdrawals(status = 'all', q = '') {
    const tbody = document.getElementById('withdrawals-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Carregando saques...</td></tr>';

    try {
      const res = await fetch(`/api/admin/finance/withdrawals?status=${status}&q=${encodeURIComponent(q)}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.withdrawals || data.withdrawals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhuma solicitação de saque encontrada.</td></tr>';
        return;
      }

      tbody.innerHTML = data.withdrawals.map(w => {
        const isApproved = w.status === 'aprovado' || w.status === 'pago' || w.status === 'COMPLETED';
        const isPending = w.status === 'pending' || w.status === 'pendente';
        return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;">${w.user_nome || 'Jogador'}</div>
              <div style="font-size:11px;color:var(--text-muted);">${w.user_telefone || w.cpf || '—'}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.4);">ID: ${w.id.slice(0, 16)}…</div>
            </td>
            <td><strong style="color:#fff;font-size:14px;">${this.fmtMoney(w.valor || w.amount)}</strong></td>
            <td>
              <div style="font-weight:600;color:var(--text-main);">${w.chave_pix || 'N/A'}</div>
              <small style="color:var(--text-muted);text-transform:uppercase;">${w.tipo_chave || 'CPF'}</small>
            </td>
            <td><span class="badge ${isApproved ? 'badge-green' : isPending ? 'badge-amber' : 'badge-red'}">${isApproved ? 'PAGO' : isPending ? 'PENDENTE' : 'REJEITADO'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${this.fmtDate(w.created_at)}</td>
            <td>
              ${isPending ? `
                <div class="action-row">
                  <button class="btn-sm btn-primary" onclick="adminApp.approveWithdrawal('${w.id}', ${w.valor || w.amount}, '${w.chave_pix}')">✓ Pagar PIX</button>
                  <button class="btn-sm btn-danger" onclick="adminApp.rejectWithdrawal('${w.id}', ${w.valor || w.amount})">✕ Rejeitar & Estornar</button>
                </div>
              ` : `<span style="font-size:12px;color:${isApproved ? 'var(--accent-green)' : 'var(--accent-red)'};">${isApproved ? 'Transferido' : 'Rejeitado / Estornado'}</span>`}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</td></tr>`;
    }
  },

  async approveWithdrawal(withdrawalId, amount, pixKey) {
    if (!confirm(`Confirmar envio de saque via PIX no valor de ${this.fmtMoney(amount)} para a chave: ${pixKey}?`)) return;
    try {
      const res = await fetch('/api/admin/finance/withdrawals', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ withdrawalId, action: 'approve' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.toast(`Saque de ${this.fmtMoney(amount)} aprovado com sucesso!`);
      this.loadWithdrawals();
      this.loadStats();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async rejectWithdrawal(withdrawalId, amount) {
    const reason = prompt(`Motivo da rejeição do saque de ${this.fmtMoney(amount)} (o saldo será estornado ao jogador):`);
    if (reason === null) return;
    try {
      const res = await fetch('/api/admin/finance/withdrawals', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ withdrawalId, action: 'reject', reason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      this.toast('Saque rejeitado e saldo estornado para a conta do usuário.');
      this.loadWithdrawals();
      this.loadStats();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // 5. AFFILIATES
  async loadAffiliates() {
    const tbody = document.getElementById('affiliates-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Carregando afiliados...</td></tr>';

    try {
      const res = await fetch('/api/admin/affiliates', { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.affiliates || data.affiliates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhum afiliado ativo encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = data.affiliates.map(a => `
        <tr>
          <td>
            <div style="font-weight:700;color:#fff;">${a.nome}</div>
            <div style="font-size:11px;color:var(--text-muted);">${a.telefone || a.email}</div>
            <div style="font-size:11px;color:var(--primary);font-weight:700;">Código: ${a.codigo} ${a.is_influencer ? '★ INFLUENCER' : ''}</div>
          </td>
          <td><strong>${a.leads}</strong> cadastros</td>
          <td><strong>${a.deposits_count}</strong> depósitos</td>
          <td><strong style="color:var(--accent-green);">${this.fmtMoney(a.revenue_generated)}</strong></td>
          <td><strong style="color:#fff;">${this.fmtMoney(a.saldo_afiliado)}</strong></td>
          <td>
            <button class="btn-sm btn-primary" onclick="adminApp.openInfluencerModal('${a.id}', '${a.nome}', '${a.codigo}', 10, 2, ${a.is_influencer})">Configurar Taxas</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</td></tr>`;
    }
  },

  // 6. GAMES AUDIT
  async loadGames() {
    const tbody = document.getElementById('games-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Carregando partidas...</td></tr>';

    try {
      const res = await fetch('/api/admin/games', { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.games || data.games.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhuma partida registrada até o momento.</td></tr>';
        return;
      }

      tbody.innerHTML = data.games.map(g => {
        const isWin = g.resultado === 'vitoria' || g.result === 'win' || (g.lucro && g.lucro > 0);
        return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;">${g.user_nome || 'Jogador'}</div>
              <div style="font-size:11px;color:var(--text-muted);">${g.user_telefone || ''}</div>
            </td>
            <td><strong>${this.fmtMoney(g.aposta || g.bet || g.amount)}</strong></td>
            <td><strong style="color:${isWin ? 'var(--accent-green)' : 'var(--accent-red)'};">${(g.multiplicador || 1).toFixed(2)}x</strong></td>
            <td><strong style="color:${isWin ? 'var(--accent-green)' : 'var(--text-muted)'};">${this.fmtMoney(g.lucro || g.payout || 0)}</strong></td>
            <td><span class="badge ${isWin ? 'badge-green' : 'badge-red'}">${isWin ? 'VITÓRIA' : 'QUEDA'}</span></td>
            <td style="font-size:12px;color:var(--text-muted);">${this.fmtDate(g.created_at)}</td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</td></tr>`;
    }
  },

  // 7. AUDIT LOGS
  async loadAudit() {
    const container = document.getElementById('audit-list');
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Carregando registros de auditoria...</div>';

    try {
      const res = await fetch('/api/admin/audit', { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (!data.logs || data.logs.length === 0) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Nenhum log registrado.</div>';
        return;
      }

      container.innerHTML = data.logs.map(l => `
        <div style="padding:14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <span class="badge badge-pink">${l.action}</span>
            <span style="font-size:13px;margin-left:8px;color:#fff;">${l.detail}</span>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Por: <b>${l.actor}</b> · Alvo: ${l.target}</div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${this.fmtDate(l.created_at)}</div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = `<div style="color:var(--accent-red);padding:16px;">Erro: ${err.message}</div>`;
    }
  },

  // 8. SETTINGS
  async loadSettings() {
    try {
      const res = await fetch('/api/admin/settings', { headers: this.getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const s = data.settings || {};
      document.getElementById('setting-min-deposit').value = s.minDeposit || 10;
      document.getElementById('setting-max-deposit').value = s.maxDeposit || 500;
      document.getElementById('setting-min-withdrawal').value = s.minWithdrawal || 20;
      document.getElementById('setting-min-bet').value = s.minBet || 1;
      document.getElementById('setting-max-bet').value = s.maxBet || 100;
      document.getElementById('setting-vizzion-percent').value = s.vizzionPercent || 80;
      document.getElementById('setting-omega-percent').value = s.omegaPercent || 20;
      document.getElementById('setting-affiliate-rate1').value = s.affiliateRate1 || 10;
      document.getElementById('setting-affiliate-rate2').value = s.affiliateRate2 || 2;
      document.getElementById('setting-maintenance').checked = Boolean(s.maintenance);

      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      const activeBtn = document.getElementById('diff-' + (s.difficulty || 'balanced'));
      if (activeBtn) activeBtn.classList.add('active');

    } catch (err) {
      console.warn('Erro ao carregar configurações:', err);
    }
  },

  async saveSettings(e) {
    e.preventDefault();
    try {
      const body = {
        minDeposit: Number(document.getElementById('setting-min-deposit').value),
        maxDeposit: Number(document.getElementById('setting-max-deposit').value),
        minWithdrawal: Number(document.getElementById('setting-min-withdrawal').value),
        minBet: Number(document.getElementById('setting-min-bet').value),
        maxBet: Number(document.getElementById('setting-max-bet').value),
        vizzionPercent: Number(document.getElementById('setting-vizzion-percent').value),
        omegaPercent: Number(document.getElementById('setting-omega-percent').value),
        affiliateRate1: Number(document.getElementById('setting-affiliate-rate1').value),
        affiliateRate2: Number(document.getElementById('setting-affiliate-rate2').value),
        maintenance: document.getElementById('setting-maintenance').checked,
      };

      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast('Configurações salvas e aplicadas em tempo real!');
      this.loadSettings();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async setDifficulty(level) {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ difficulty: level })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('diff-' + level)?.classList.add('active');
      this.toast(`✓ Dificuldade ajustada para: ${level.toUpperCase()}`);
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // MODALS & USER ACTIONS
  openBalanceModal(userId, name, currentBalance) {
    document.getElementById('modal-balance-user-id').value = userId;
    document.getElementById('modal-balance-user-name').textContent = name;
    document.getElementById('modal-balance-current').textContent = this.fmtMoney(currentBalance);
    document.getElementById('modal-balance-amount').value = '';
    document.getElementById('modal-balance-reason').value = '';
    document.getElementById('modal-balance').classList.add('active');
  },

  closeBalanceModal() {
    document.getElementById('modal-balance').classList.remove('active');
  },

  async submitBalanceAdjustment() {
    const userId = document.getElementById('modal-balance-user-id').value;
    const amount = Number(document.getElementById('modal-balance-amount').value);
    const reason = document.getElementById('modal-balance-reason').value.trim();

    if (isNaN(amount) || amount === 0) {
      alert('Informe um valor de ajuste válido.');
      return;
    }

    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: 'adjust_balance',
          targetId: userId,
          amount,
          reason,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast(data.message || 'Saldo atualizado!');
      this.closeBalanceModal();
      this.loadUsers();
      this.loadStats();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },

  openInfluencerModal(userId, name, currentCode, rate1, rate2, isInf) {
    document.getElementById('modal-inf-user-id').value = userId;
    document.getElementById('modal-inf-user-name').textContent = name;
    document.getElementById('modal-inf-enabled').checked = Boolean(isInf);
    document.getElementById('modal-inf-code').value = currentCode || '';
    document.getElementById('modal-inf-rate1').value = rate1 || 10;
    document.getElementById('modal-inf-rate2').value = rate2 || 2;
    document.getElementById('modal-influencer').classList.add('active');
  },

  closeInfluencerModal() {
    document.getElementById('modal-influencer').classList.remove('active');
  },

  async submitInfluencer() {
    const userId = document.getElementById('modal-inf-user-id').value;
    const enabled = document.getElementById('modal-inf-enabled').checked;
    const refCode = document.getElementById('modal-inf-code').value.trim().toUpperCase();
    const rate1 = Number(document.getElementById('modal-inf-rate1').value);
    const rate2 = Number(document.getElementById('modal-inf-rate2').value);

    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: 'set_influencer',
          targetId: userId,
          value: { enabled, refCode, rate1, rate2 }
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast('Configurações de influencer salvas!');
      this.closeInfluencerModal();
      this.loadUsers();
      this.loadAffiliates();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },

  openPasswordModal(userId, name) {
    document.getElementById('modal-pwd-user-id').value = userId;
    document.getElementById('modal-pwd-user-name').textContent = name;
    document.getElementById('modal-pwd-new').value = '';
    document.getElementById('modal-password').classList.add('active');
  },

  closePasswordModal() {
    document.getElementById('modal-password').classList.remove('active');
  },

  async submitPasswordReset() {
    const userId = document.getElementById('modal-pwd-user-id').value;
    const newPassword = document.getElementById('modal-pwd-new').value.trim();

    if (newPassword.length < 6) {
      alert('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: 'reset_password',
          targetId: userId,
          value: newPassword,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast('Senha alterada com sucesso!');
      this.closePasswordModal();
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  },

  async toggleAdmin(userId, currentAdmin) {
    if (!confirm(`Deseja ${currentAdmin ? 'REMOVER' : 'CONCEDER'} acesso de administrador a este usuário?`)) return;
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: 'set_user_role',
          targetId: userId,
          value: !currentAdmin,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast('Permissão atualizada!');
      this.loadUsers();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  async toggleStatus(userId, currentStatus) {
    const actionText = currentStatus === 'active' ? 'suspender' : 'reativar';
    if (!confirm(`Deseja realmente ${actionText} a conta deste usuário?`)) return;
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          action: 'set_user_status',
          targetId: userId,
          value: currentStatus === 'active' ? 'suspended' : 'active',
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      this.toast(`Conta ${actionText === 'suspender' ? 'suspensa' : 'reativada'}!`);
      this.loadUsers();
    } catch (err) {
      this.toast(err.message, true);
    }
  },

  // LOGIN MODAL
  showLoginModal(msg = '') {
    const m = document.getElementById('modal-login');
    if (m) m.classList.add('active');
    const err = document.getElementById('login-error');
    if (err) {
      if (msg) {
        err.textContent = msg;
        err.style.display = 'block';
      } else {
        err.style.display = 'none';
      }
    }
  },

  hideLoginModal() {
    const m = document.getElementById('modal-login');
    if (m) m.classList.remove('active');
  },

  async handleAdminLogin(e) {
    e.preventDefault();
    const ident = document.getElementById('login-identifier').value.trim();
    const pass = document.getElementById('login-password').value;
    const err = document.getElementById('login-error');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credenciais inválidas.');

      this.setToken(data.token, data.user);
      this.hideLoginModal();
      this.toast('Login realizado com sucesso!');
      window.location.reload();
    } catch (errObj) {
      if (err) {
        err.textContent = errObj.message;
        err.style.display = 'block';
      }
    }
  },

  logout() {
    localStorage.removeItem('arenaclash_token');
    localStorage.removeItem('arenaclash_admin_user');
    document.cookie = 'hw_session=; path=/; max-age=0;';
    window.location.href = '/';
  }
};

window.adminApp = adminApp;
document.addEventListener('DOMContentLoaded', () => {
  adminApp.init();
});
