(() => {
'use strict';

// =====================================================================
// Utilidades
// =====================================================================
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = v => (v === '' || v == null) ? null : Number(String(v).replace(/\./g, '').replace(',', '.'));
const numInput = v => (v === '' || v == null) ? null : Number(v);
const soma = arr => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mesKey = d => String(d).slice(0, 7);
const addMes = (key, n) => {
  let [y, m] = key.split('-').map(Number);
  m += n;
  y += Math.floor((m - 1) / 12);
  m = (((m - 1) % 12) + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};
const difMeses = (a, b) => {
  const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
};
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesLabel = k => { const [y, m] = k.split('-'); return `${MESES[m - 1]}/${y.slice(2)}`; };
const fmtData = d => d ? String(d).slice(0, 10).split('-').reverse().join('/') : '';
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const STATUS = { pendente: 'Pendente', cotando: 'Cotando', comprado: 'Comprado', ganho: 'Ganho' };
const PRIORIDADE = { essencial: 'Essencial', desejavel: 'Desejável', superfluo: 'Supérfluo' };
const TABELAS = ['config', 'comodos', 'categorias', 'itens', 'cotacoes', 'aportes'];

const ICONES = {
  painel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 19V10M10 19V5M16 19v-7M22 19H2"/></svg>',
  itens: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  financas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'
};
const ABAS = [['painel', 'Painel'], ['itens', 'Itens'], ['financas', 'Finanças'], ['ajustes', 'Ajustes']];

// =====================================================================
// Estado
// =====================================================================
let sb = null, sessao = null, aba = 'painel', canal = null, timerRecarga = null, conectado = true;
let graficos = [];
const db = { config: {}, comodos: [], categorias: [], itens: [], cotacoes: [], aportes: [] };
const filtros = { busca: '', comodo: '', categoria: '', status: '', prioridade: '' };

// =====================================================================
// Toast / erros
// =====================================================================
let timerToast;
function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'visivel' + (erro ? ' erro' : '');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => (t.className = ''), erro ? 4500 : 2200);
}
function mostrarErro(e) {
  console.error(e);
  let msg = e?.message || String(e);
  if (/duplicate key/i.test(msg)) msg = 'Já existe um registro com esse nome.';
  if (/Failed to fetch/i.test(msg)) msg = 'Sem conexão com o servidor. Verifique a internet.';
  toast(msg, true);
}
// Executa uma operação do Supabase; retorna {ok, data}
async function exec(op, okMsg) {
  try {
    const { data, error } = await op;
    if (error) { mostrarErro(error); return { ok: false }; }
    if (okMsg) toast(okMsg);
    return { ok: true, data };
  } catch (e) { mostrarErro(e); return { ok: false }; }
}

// =====================================================================
// Inicialização, configuração e login
// =====================================================================
function lerConfig() {
  const c = window.ENXOVAL_CONFIG || {};
  let url = c.supabaseUrl, key = c.supabaseAnonKey;
  if (!url || !key) {
    try {
      const s = JSON.parse(localStorage.getItem('enxoval.supabase') || '{}');
      url = url || s.url; key = key || s.key;
    } catch { /* sem storage */ }
  }
  return url && key ? { url: url.trim(), key: key.trim() } : null;
}

async function iniciar() {
  if (!window.supabase) {
    $('#app').innerHTML = '<div class="tela-entrada"><h1>Ops</h1><p class="muted">Não foi possível carregar a biblioteca do Supabase. Verifique a internet e recarregue.</p></div>';
    return;
  }
  const cfg = lerConfig();
  if (!cfg) return telaSetup();
  sb = window.supabase.createClient(cfg.url, cfg.key);
  const { data } = await sb.auth.getSession();
  sessao = data.session;
  sb.auth.onAuthStateChange((_evento, s) => {
    const antes = !!sessao;
    sessao = s;
    if (!!s !== antes) rotear();
  });
  rotear();
}

async function rotear() {
  if (!sessao) {
    if (canal) { sb.removeChannel(canal); canal = null; }
    return telaLogin();
  }
  $('#app').innerHTML = '<div class="carregando">Carregando…</div>';
  try {
    await carregar();
  } catch (e) {
    mostrarErro(e);
    $('#app').innerHTML = `<div class="tela-entrada"><h1>Erro ao carregar</h1><p class="muted">${esc(e.message || e)}</p><button class="btn" id="tentar">Tentar de novo</button></div>`;
    $('#tentar').onclick = rotear;
    return;
  }
  if (!db.config.id) return telaSemAcesso();
  assinarRealtime();
  render();
}

function telaSetup() {
  $('#app').innerHTML = `
    <div class="tela-entrada">
      <h1>Nosso Enxoval</h1>
      <p class="muted">Primeiro acesso neste aparelho: informe os dados do projeto Supabase (Project Settings › API).</p>
      <form id="f-setup">
        <label>Project URL<input name="url" type="url" required placeholder="https://xxxx.supabase.co"></label>
        <label>Chave anon (public)<input name="key" required autocomplete="off"></label>
        <button class="btn">Salvar</button>
      </form>
    </div>`;
  $('#f-setup').onsubmit = e => {
    e.preventDefault();
    const f = new FormData(e.target);
    try { localStorage.setItem('enxoval.supabase', JSON.stringify({ url: f.get('url'), key: f.get('key') })); }
    catch { return toast('Este navegador bloqueou o armazenamento local.', true); }
    location.reload();
  };
}

function telaLogin() {
  $('#app').innerHTML = `
    <div class="tela-entrada">
      <h1>Nosso Enxoval</h1>
      <p class="muted">Entre com o e-mail e a senha cadastrados.</p>
      <form id="f-login">
        <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
        <label>Senha<input name="senha" type="password" required autocomplete="current-password"></label>
        <div class="erro-msg" id="erro-login"></div>
        <button class="btn">Entrar</button>
      </form>
    </div>`;
  $('#f-login').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('senha') });
    btn.disabled = false;
    if (error) $('#erro-login').textContent = /invalid/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message;
  };
}

function telaSemAcesso() {
  $('#app').innerHTML = `
    <div class="tela-entrada">
      <h1>Sem acesso</h1>
      <p class="muted">O login funcionou, mas o e-mail <strong>${esc(sessao.user.email)}</strong> não está na tabela <code>membros</code> do banco. Adicione-o no Supabase e entre de novo.</p>
      <button class="btn sec" id="sair">Sair</button>
    </div>`;
  $('#sair').onclick = () => sb.auth.signOut();
}

// =====================================================================
// Dados
// =====================================================================
async function carregar() {
  const res = await Promise.all(TABELAS.map(t => sb.from(t).select('*')));
  const falha = res.find(r => r.error);
  if (falha) throw falha.error;
  TABELAS.forEach((t, i) => (db[t] = res[i].data || []));
  db.config = db.config[0] || {};
  db.comodos.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
  db.categorias.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  db.itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  db.cotacoes.sort((a, b) => a.preco - b.preco);
  db.aportes.sort((a, b) => (b.data || '').localeCompare(a.data || '') || b.id - a.id);
}

function assinarRealtime() {
  if (canal) return;
  canal = sb.channel('enxoval-sync');
  TABELAS.forEach(t => canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, agendarRecarga));
  canal.subscribe(status => {
    conectado = status === 'SUBSCRIBED';
    const s = $('.sync');
    if (s) { s.classList.toggle('off', !conectado); s.textContent = conectado ? 'sincronizado' : 'reconectando'; }
  });
}

function agendarRecarga() {
  clearTimeout(timerRecarga);
  timerRecarga = setTimeout(recarregar, 350);
}
async function recarregar() {
  try { await carregar(); render(); atualizarModalCotacoes(); }
  catch (e) { mostrarErro(e); }
}

// =====================================================================
// Cálculos
// =====================================================================
const cotacoesDe = id => db.cotacoes.filter(c => c.item_id === id);
const menorPreco = id => { const cs = cotacoesDe(id); return cs.length ? Math.min(...cs.map(c => Number(c.preco))) : null; };
const estimado = i => { const p = menorPreco(i.id); return p == null ? null : p * i.quantidade; };
const emAberto = i => i.status === 'pendente' || i.status === 'cotando';
const gastoItem = i => i.status === 'comprado' ? Number(i.valor_pago) || 0 : 0;
const previstoItem = i => emAberto(i) ? (estimado(i) || 0) : 0;
const itensDoComodo = id => db.itens.filter(i => (i.comodo_id ?? null) === id);

// Divide um item comprado em parcelas mensais (centavo que sobra vai na última)
function parcelasDoItem(i) {
  if (i.status !== 'comprado' || !Number(i.valor_pago)) return [];
  const total = Math.round(Number(i.valor_pago) * 100);
  const parcelado = i.forma_pagamento === 'parcelado' && i.parcelas > 1;
  const n = parcelado ? i.parcelas : 1;
  const inicio = mesKey(parcelado && i.primeira_parcela ? i.primeira_parcela : (i.data_compra || hoje()));
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, k) => ({
    mes: addMes(inicio, k),
    valor: (k === n - 1 ? total - base * (n - 1) : base) / 100,
    numero: k + 1, de: n, item: i
  }));
}
const todasParcelas = () => db.itens.flatMap(parcelasDoItem);

function resumo() {
  const c = db.config, atual = mesKey(hoje());
  const parcelas = todasParcelas();
  const gasto = soma(db.itens.map(gastoItem));
  const previsto = soma(db.itens.map(previstoItem));
  const desembolsado = soma(parcelas.filter(p => p.mes <= atual).map(p => p.valor));
  const aportado = soma(db.aportes.map(a => a.valor));
  return {
    atual, parcelas, gasto, previsto, desembolsado, aportado,
    aPagar: gasto - desembolsado,
    proximoMes: soma(parcelas.filter(p => p.mes === addMes(atual, 1)).map(p => p.valor)),
    orcamento: Number(c.orcamento_total) || 0,
    meta: Number(c.meta_valor) || 0
  };
}

function serieEvolucao() {
  const c = db.config, atual = mesKey(hoje());
  const parcelas = todasParcelas();
  const mi = c.meta_inicio ? mesKey(c.meta_inicio) : null;
  const mf = c.meta_data ? mesKey(c.meta_data) : null;
  const marcos = [atual, ...db.aportes.map(a => mesKey(a.data)), ...parcelas.map(p => p.mes)];
  if (mi) marcos.push(mi);
  if (mf) marcos.push(mf);
  marcos.sort();
  const ini = marcos[0], fim = marcos[marcos.length - 1];
  const labels = [];
  for (let k = ini; k <= fim && labels.length < 120; k = addMes(k, 1)) labels.push(k);

  const porMesA = {}, porMesD = {};
  db.aportes.forEach(a => { const m = mesKey(a.data); porMesA[m] = (porMesA[m] || 0) + Number(a.valor); });
  parcelas.forEach(p => { porMesD[p.mes] = (porMesD[p.mes] || 0) + p.valor; });

  const meta = Number(c.meta_valor) || 0;
  const span = mi && mf ? difMeses(mi, mf) : 0;
  let acA = 0, acD = 0;
  const aportes = [], desemb = [], ideal = [];
  labels.forEach(m => {
    acA += porMesA[m] || 0;
    acD += porMesD[m] || 0;
    aportes.push(m <= atual ? +acA.toFixed(2) : null);
    desemb.push(+acD.toFixed(2));
    ideal.push(meta > 0 && mi && mf && m >= mi && m <= mf ? +(span ? meta * difMeses(mi, m) / span : meta).toFixed(2) : null);
  });
  return { labels, aportes, desemb, ideal, temMeta: meta > 0 && mi && mf };
}

// =====================================================================
// Shell
// =====================================================================
function render() {
  graficos.forEach(g => g.destroy());
  graficos = [];
  const scrollY = window.scrollY;
  $('#app').innerHTML = `
    <header class="topo">
      <h1>Nosso Enxoval</h1>
      <span class="sync ${conectado ? '' : 'off'}">${conectado ? 'sincronizado' : 'reconectando'}</span>
    </header>
    <main id="conteudo"></main>
    ${aba === 'itens' ? '<button class="fab" id="novo-item" aria-label="Novo item">+</button>' : ''}
    <nav class="abas">
      ${ABAS.map(([k, l]) => `<button data-aba="${k}" class="${aba === k ? 'ativa' : ''}">${ICONES[k]}<span>${l}</span></button>`).join('')}
    </nav>`;
  $$('[data-aba]').forEach(b => b.onclick = () => {
    if (aba === b.dataset.aba) return;
    aba = b.dataset.aba; render(); window.scrollTo(0, 0);
  });
  const el = $('#conteudo');
  ({ painel: renderPainel, itens: renderItens, financas: renderFinancas, ajustes: renderAjustes })[aba](el);
  window.scrollTo(0, scrollY);
}

// =====================================================================
// Painel
// =====================================================================
function renderPainel(el) {
  const r = resumo(), c = db.config;
  const total = db.itens.length;
  const feitos = db.itens.filter(i => !emAberto(i)).length;
  const ganhos = db.itens.filter(i => i.status === 'ganho').length;
  const essPend = db.itens.filter(i => i.prioridade === 'essencial' && emAberto(i)).length;
  const semCotacao = db.itens.filter(i => emAberto(i) && estimado(i) == null).length;
  const projecao = r.gasto + r.previsto;

  // ritmo para a meta
  let ritmo = 'Defina a meta em Ajustes';
  if (r.meta > 0 && c.meta_data) {
    const falta = Math.max(r.meta - r.aportado, 0);
    const restantes = difMeses(r.atual, mesKey(c.meta_data)) + 1; // inclui o mês atual
    ritmo = falta === 0 ? 'Meta atingida'
      : restantes > 0 ? `Faltam ${brl(falta)} · ${brl(falta / restantes)}/mês`
      : `Prazo encerrado · faltam ${brl(falta)}`;
  }

  // alertas
  const alertas = [];
  if (r.orcamento > 0 && projecao > r.orcamento)
    alertas.push(['', `Projeção total (${brl(projecao)}) passa o orçamento de ${brl(r.orcamento)} em ${brl(projecao - r.orcamento)}.`]);
  db.comodos.forEach(cm => {
    const o = Number(cm.orcamento) || 0;
    if (!o) return;
    const its = itensDoComodo(cm.id);
    const g = soma(its.map(gastoItem)), p = soma(its.map(previstoItem));
    if (g > o) alertas.push(['', `${cm.nome}: gasto de ${brl(g)} já estourou o orçamento de ${brl(o)}.`]);
    else if (g + p > o) alertas.push(['aviso', `${cm.nome}: gasto + previsto (${brl(g + p)}) passa o orçamento de ${brl(o)}.`]);
  });
  if (r.aPagar > 0 && r.aportado - r.desembolsado < r.proximoMes)
    alertas.push(['aviso', `Saldo guardado (${brl(r.aportado - r.desembolsado)}) não cobre as parcelas do próximo mês (${brl(r.proximoMes)}).`]);

  el.innerHTML = `
    ${alertas.map(([t, m]) => `<div class="alerta ${t}">${esc(m)}</div>`).join('')}
    <div class="grid-kpi">
      <div class="card kpi destaque">
        <div class="rotulo">Guardado para a meta</div>
        <div class="valor">${brl(r.aportado)}${r.meta ? ` <small style="color:inherit;opacity:.8;font-weight:400">de ${brl(r.meta)}</small>` : ''}</div>
        ${r.meta ? `<div class="barra" style="background:rgba(255,255,255,.25)"><span style="width:${Math.min(100, r.aportado / r.meta * 100)}%;background:currentColor"></span></div>` : ''}
        <div class="sub" style="margin-top:6px">${esc(ritmo)}</div>
      </div>
      <div class="card kpi">
        <div class="rotulo">Gasto em compras</div>
        <div class="valor">${brl(r.gasto)}</div>
        <div class="sub">${r.orcamento ? `${Math.round(r.gasto / r.orcamento * 100)}% de ${brl(r.orcamento)}` : 'sem orçamento definido'}</div>
      </div>
      <div class="card kpi">
        <div class="rotulo">Previsto (a comprar)</div>
        <div class="valor">${brl(r.previsto)}</div>
        <div class="sub">${semCotacao ? `${semCotacao} ${semCotacao === 1 ? 'item' : 'itens'} sem cotação` : 'pelas menores cotações'}</div>
      </div>
      <div class="card kpi">
        <div class="rotulo">Parcelas a pagar</div>
        <div class="valor">${brl(r.aPagar)}</div>
        <div class="sub">próximo mês: ${brl(r.proximoMes)}</div>
      </div>
      <div class="card kpi">
        <div class="rotulo">Itens concluídos</div>
        <div class="valor">${feitos}/${total}</div>
        <div class="sub">${ganhos} de presente · ${essPend} essenciais pendentes</div>
      </div>
    </div>

    <section class="secao">
      <h2>Evolução</h2>
      <div class="card">
        ${db.aportes.length || r.gasto ? '<div class="grafico"><canvas id="g-evolucao"></canvas></div>'
          : '<div class="vazio">Registre aportes (Finanças) e compras para ver a evolução.</div>'}
        <p class="muted" style="font-size:.78rem;margin:10px 0 0">Guardado = aportes acumulados. Desembolso = parcelas e pagamentos à vista acumulados mês a mês (inclui parcelas futuras já assumidas).</p>
      </div>
    </section>`;

  if ($('#g-evolucao')) {
    const s = serieEvolucao();
    const atualIdx = s.labels.indexOf(r.atual);
    const ds = [
      { label: 'Guardado', data: s.aportes, borderColor: cssVar('--primary'), backgroundColor: cssVar('--primary'), tension: .25, pointRadius: 2, spanGaps: false },
      { label: 'Desembolso', data: s.desemb, borderColor: cssVar('--accent'), backgroundColor: cssVar('--accent'), tension: .25, pointRadius: 2, segment: { borderDash: ctx => ctx.p0DataIndex >= atualIdx ? [5, 4] : undefined } }
    ];
    if (s.temMeta) ds.push({ label: 'Trajetória ideal', data: s.ideal, borderColor: cssVar('--muted'), borderDash: [3, 3], pointRadius: 0, borderWidth: 1.5 });
    graficos.push(new Chart($('#g-evolucao'), {
      type: 'line',
      data: { labels: s.labels.map(mesLabel), datasets: ds },
      options: opcoesGrafico()
    }));
  }
}

function opcoesGrafico(extra = {}) {
  const texto = cssVar('--muted'), linha = cssVar('--line');
  return {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: texto, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${brl(ctx.parsed.y)}` } }
    },
    scales: {
      x: { ticks: { color: texto, font: { size: 10 }, maxRotation: 0, autoSkipPadding: 8 }, grid: { display: false } },
      y: { ticks: { color: texto, font: { size: 10 }, callback: v => v >= 1000 ? `R$${(v / 1000).toLocaleString('pt-BR')}k` : `R$${v}` }, grid: { color: linha }, beginAtZero: true }
    },
    ...extra
  };
}

// =====================================================================
// Itens
// =====================================================================
function renderItens(el) {
  const opt = (lista, sel, vazio) => `<option value="">${vazio}</option>` +
    lista.map(([v, l]) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('');
  el.innerHTML = `
    <div class="filtros">
      <input type="search" id="busca" placeholder="Buscar item…" value="${esc(filtros.busca)}">
      <div class="selects">
        <select data-filtro="comodo">${opt([...db.comodos.map(c => [c.id, c.nome]), ['sem', 'Sem cômodo']], filtros.comodo, 'Todos os cômodos')}</select>
        <select data-filtro="categoria">${opt(db.categorias.map(c => [c.id, c.nome]), filtros.categoria, 'Todas as categorias')}</select>
        <select data-filtro="status">${opt(Object.entries(STATUS), filtros.status, 'Todos os status')}</select>
        <select data-filtro="prioridade">${opt(Object.entries(PRIORIDADE), filtros.prioridade, 'Todas as prioridades')}</select>
      </div>
    </div>
    <div id="lista-itens"></div>`;
  $('#busca').oninput = e => { filtros.busca = e.target.value; renderListaItens(); };
  $$('[data-filtro]').forEach(s => s.onchange = () => { filtros[s.dataset.filtro] = s.value; renderListaItens(); });
  $('#novo-item').onclick = () => abrirItem(null);
  renderListaItens();
}

function renderListaItens() {
  const alvo = $('#lista-itens');
  if (!alvo) return;
  const b = filtros.busca.trim().toLowerCase();
  const itens = db.itens.filter(i =>
    (!b || i.nome.toLowerCase().includes(b)) &&
    (!filtros.comodo || (filtros.comodo === 'sem' ? i.comodo_id == null : String(i.comodo_id) === filtros.comodo)) &&
    (!filtros.categoria || String(i.categoria_id) === filtros.categoria) &&
    (!filtros.status || i.status === filtros.status) &&
    (!filtros.prioridade || i.prioridade === filtros.prioridade));

  if (!db.itens.length) { alvo.innerHTML = '<div class="vazio">Nenhum item ainda. Toque em + para adicionar o primeiro.</div>'; return; }
  if (!itens.length) { alvo.innerHTML = '<div class="vazio">Nenhum item com esses filtros.</div>'; return; }

  const grupos = [...db.comodos.map(c => [c.id, c.nome]), [null, 'Sem cômodo']]
    .map(([id, nome]) => [nome, itens.filter(i => (i.comodo_id ?? null) === id)])
    .filter(([, its]) => its.length);
  const ordemStatus = { pendente: 0, cotando: 1, comprado: 2, ganho: 3 };
  const ordemPrio = { essencial: 0, desejavel: 1, superfluo: 2 };

  alvo.innerHTML = grupos.map(([nome, its]) => {
    its.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || ordemPrio[a.prioridade] - ordemPrio[b.prioridade] || a.nome.localeCompare(b.nome, 'pt-BR'));
    const feitos = its.filter(i => !emAberto(i)).length;
    return `
      <div class="grupo-titulo"><span>${esc(nome)}</span><small>${feitos}/${its.length}</small></div>
      <div class="lista">${its.map(cardItem).join('')}</div>`;
  }).join('');
  $$('.item', alvo).forEach(b => b.onclick = () => abrirItem(Number(b.dataset.id)));
}

function cardItem(i) {
  const cat = db.categorias.find(c => c.id === i.categoria_id);
  let valor;
  if (i.status === 'comprado') {
    valor = brl(i.valor_pago);
    if (i.forma_pagamento === 'parcelado' && i.parcelas > 1) valor += ` <small>(${i.parcelas}x)</small>`;
  } else if (i.status === 'ganho') valor = '<small>presente</small>';
  else { const e = estimado(i); valor = e == null ? '<small>sem cotação</small>' : `<small>~</small> ${brl(e)}`; }
  const meta = [cat?.nome, `<span class="${i.prioridade === 'essencial' ? 'p-essencial' : ''}">${PRIORIDADE[i.prioridade]}</span>`].filter(Boolean).join(' · ');
  return `
    <button class="item ${emAberto(i) ? '' : 'feito'}" data-id="${i.id}">
      <div>
        <div class="nome">${esc(i.nome)}${i.quantidade > 1 ? ` <small>×${i.quantidade}</small>` : ''}</div>
        <div class="meta">${meta}</div>
      </div>
      <div class="dir">
        <span class="badge s-${i.status}">${STATUS[i.status]}</span>
        <span class="num" style="font-size:.85rem">${valor}</span>
      </div>
    </button>`;
}

// ---------- Modal genérico ----------
function abrirModal(html) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow = 'hidden';
  const fundo = $('.modal-fundo', root);
  fundo.onclick = e => { if (e.target === fundo) fecharModal(); };
  $$('[data-fechar]', root).forEach(b => b.onclick = fecharModal);
  return $('.modal', root);
}
function fecharModal() {
  $('#modal-root').innerHTML = '';
  document.body.style.overflow = '';
}

// ---------- Modal de item ----------
let itemAbertoId = null;

function abrirItem(id) {
  const i = id ? db.itens.find(x => x.id === id) : null;
  if (id && !i) return toast('Item não encontrado (pode ter sido excluído).', true);
  itemAbertoId = id;
  const v = i || { nome: '', quantidade: 1, prioridade: 'desejavel', status: 'pendente', comodo_id: filtros.comodo && filtros.comodo !== 'sem' ? Number(filtros.comodo) : null, categoria_id: filtros.categoria ? Number(filtros.categoria) : null };
  const opts = (lista, sel, vazio) => `<option value="">${vazio}</option>` +
    lista.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  const opEnum = (obj, sel) => Object.entries(obj).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');
  const proxMes = addMes(mesKey(hoje()), 1);

  const m = abrirModal(`
    <div class="modal-topo">
      <h2 style="margin:0">${i ? 'Editar item' : 'Novo item'}</h2>
      <button class="icone-btn" data-fechar aria-label="Fechar">✕</button>
    </div>
    <form id="f-item">
      <div class="campos">
        <label class="cheio">Nome<input name="nome" required value="${esc(v.nome)}" placeholder="Ex.: Jogo de panelas"></label>
        <label>Cômodo<select name="comodo_id">${opts(db.comodos, v.comodo_id, '—')}</select></label>
        <label>Categoria<select name="categoria_id">${opts(db.categorias, v.categoria_id, '—')}</select></label>
        <label>Quantidade<input name="quantidade" type="number" min="1" step="1" inputmode="numeric" value="${v.quantidade}"></label>
        <label>Prioridade<select name="prioridade">${opEnum(PRIORIDADE, v.prioridade)}</select></label>
        <label class="cheio">Status<select name="status">${opEnum(STATUS, v.status)}</select></label>
      </div>

      <fieldset id="fs-compra">
        <legend>Compra</legend>
        <div class="campos">
          <label>Valor total pago<input name="valor_pago" type="number" min="0" step="0.01" inputmode="decimal" value="${v.valor_pago ?? ''}"></label>
          <label>Loja<input name="loja_compra" value="${esc(v.loja_compra)}"></label>
          <label>Data da compra<input name="data_compra" type="date" value="${v.data_compra || hoje()}"></label>
          <label>Pagamento<select name="forma_pagamento">
            <option value="avista" ${v.forma_pagamento !== 'parcelado' ? 'selected' : ''}>À vista</option>
            <option value="parcelado" ${v.forma_pagamento === 'parcelado' ? 'selected' : ''}>Parcelado</option>
          </select></label>
          <label class="so-parcelado">Nº de parcelas<input name="parcelas" type="number" min="2" max="48" step="1" inputmode="numeric" value="${v.parcelas > 1 ? v.parcelas : 2}"></label>
          <label class="so-parcelado">1ª parcela em<input name="primeira_parcela" type="month" value="${v.primeira_parcela ? mesKey(v.primeira_parcela) : proxMes}"></label>
          <div class="cheio so-parcelado muted" id="info-parcela" style="font-size:.8rem"></div>
        </div>
      </fieldset>

      <fieldset id="fs-ganho">
        <legend>Presente</legend>
        <label>Ganho de (opcional)<input name="ganho_de" value="${esc(v.ganho_de)}" placeholder="Ex.: Tia Marta, chá de panela"></label>
      </fieldset>

      <label style="margin-top:12px">Observação<textarea name="observacao">${esc(v.observacao)}</textarea></label>

      <div class="acoes">
        ${i ? '<button type="button" class="btn perigo" id="excluir-item">Excluir</button>' : '<span></span>'}
        <button class="btn">${i ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </form>

    <section class="secao" style="margin-top:22px">
      <h2>Cotações</h2>
      <div class="card" id="cotacoes-box"></div>
    </section>`);

  const f = $('#f-item', m);
  const ajustar = () => {
    const st = f.status.value;
    $('#fs-compra', m).style.display = st === 'comprado' ? '' : 'none';
    $('#fs-ganho', m).style.display = st === 'ganho' ? '' : 'none';
    f.valor_pago.required = st === 'comprado';
    const parc = f.forma_pagamento.value === 'parcelado';
    $$('.so-parcelado', m).forEach(e => (e.style.display = parc ? '' : 'none'));
    const vp = numInput(f.valor_pago.value), n = Number(f.parcelas.value);
    $('#info-parcela', m).textContent = parc && vp && n > 1 ? `${n}x de ${brl(vp / n)}` : '';
  };
  ['status', 'forma_pagamento', 'valor_pago', 'parcelas'].forEach(n => f[n].addEventListener('input', ajustar));
  ajustar();

  f.onsubmit = async e => {
    e.preventDefault();
    const st = f.status.value;
    const parc = f.forma_pagamento.value === 'parcelado';
    const dados = {
      nome: f.nome.value.trim(),
      comodo_id: f.comodo_id.value ? Number(f.comodo_id.value) : null,
      categoria_id: f.categoria_id.value ? Number(f.categoria_id.value) : null,
      quantidade: Math.max(1, Number(f.quantidade.value) || 1),
      prioridade: f.prioridade.value,
      status: st,
      observacao: f.observacao.value.trim() || null,
      valor_pago: null, loja_compra: null, data_compra: null, forma_pagamento: null, parcelas: null, primeira_parcela: null,
      ganho_de: null
    };
    if (!dados.nome) return toast('Informe o nome do item.', true);
    if (st === 'comprado') {
      const vp = numInput(f.valor_pago.value);
      if (vp == null || vp < 0) return toast('Informe o valor total pago.', true);
      const n = Number(f.parcelas.value);
      if (parc && (!(n >= 2 && n <= 48) || !f.primeira_parcela.value)) return toast('Informe parcelas (2 a 48) e o mês da 1ª parcela.', true);
      Object.assign(dados, {
        valor_pago: vp,
        loja_compra: f.loja_compra.value.trim() || null,
        data_compra: f.data_compra.value || hoje(),
        forma_pagamento: parc ? 'parcelado' : 'avista',
        parcelas: parc ? n : 1,
        primeira_parcela: parc ? `${f.primeira_parcela.value}-01` : null
      });
    }
    if (st === 'ganho') dados.ganho_de = f.ganho_de.value.trim() || null;

    const btn = f.querySelector('.acoes .btn:not(.perigo)');
    btn.disabled = true;
    if (itemAbertoId) {
      const r = await exec(sb.from('itens').update(dados).eq('id', itemAbertoId), 'Item salvo');
      btn.disabled = false;
      if (r.ok) { fecharModal(); await recarregar(); }
    } else {
      const r = await exec(sb.from('itens').insert(dados).select().single(), 'Item adicionado — agora você pode incluir cotações');
      btn.disabled = false;
      if (r.ok) { await recarregar(); abrirItem(r.data.id); }
    }
  };

  const del = $('#excluir-item', m);
  if (del) del.onclick = async () => {
    if (!confirm(`Excluir "${i.nome}" e suas cotações?`)) return;
    const r = await exec(sb.from('itens').delete().eq('id', i.id), 'Item excluído');
    if (r.ok) { fecharModal(); await recarregar(); }
  };

  renderCotacoes();
}

function atualizarModalCotacoes() {
  if ($('#cotacoes-box')) renderCotacoes(true);
}

function renderCotacoes(preservarForm = false) {
  const box = $('#cotacoes-box');
  if (!box) return;
  if (!itemAbertoId) { box.innerHTML = '<div class="muted" style="font-size:.88rem">Salve o item para adicionar cotações.</div>'; return; }
  const item = db.itens.find(x => x.id === itemAbertoId);
  if (!item) return;

  // preserva o que foi digitado no formulário de nova cotação
  const rascunho = {};
  if (preservarForm) $$('#f-cot [name]', box).forEach(e => (rascunho[e.name] = e.value));

  const cs = cotacoesDe(itemAbertoId);
  const menor = cs.length ? Math.min(...cs.map(c => Number(c.preco))) : null;
  box.innerHTML = `
    ${cs.length ? cs.map(c => `
      <div class="cotacao ${cs.length > 1 && Number(c.preco) === menor ? 'melhor' : ''}">
        <div>
          <div class="loja">${esc(c.loja)}</div>
          <small class="num">${brl(c.preco)}/un${item.quantidade > 1 ? ` · total ${brl(c.preco * item.quantidade)}` : ''}${c.parcelas_max > 1 ? ` · até ${c.parcelas_max}x` : ''}</small>
          ${c.link ? `<div><a href="${esc(c.link)}" target="_blank" rel="noopener" style="font-size:.78rem">abrir link</a></div>` : ''}
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          ${emAberto(item) ? `<button type="button" class="btn sec mini" data-comprar="${c.id}">Comprei aqui</button>` : ''}
          <button type="button" class="icone-btn" data-del-cot="${c.id}" aria-label="Excluir cotação">✕</button>
        </div>
      </div>`).join('') : '<div class="muted" style="font-size:.88rem">Nenhuma cotação ainda.</div>'}
    <form id="f-cot" class="add-cotacao">
      <label>Loja<input name="loja" required value="${esc(rascunho.loja)}"></label>
      <label>Preço unitário<input name="preco" type="number" min="0" step="0.01" inputmode="decimal" required value="${esc(rascunho.preco)}"></label>
      <label>Parcela em até<input name="parcelas_max" type="number" min="1" max="48" step="1" inputmode="numeric" value="${esc(rascunho.parcelas_max || 1)}"></label>
      <label>Link (opcional)<input name="link" type="url" value="${esc(rascunho.link)}"></label>
      <button class="btn sec cheio">Adicionar cotação</button>
    </form>`;

  $('#f-cot', box).onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    const dados = {
      item_id: itemAbertoId,
      loja: f.loja.value.trim(),
      preco: numInput(f.preco.value),
      parcelas_max: Math.min(48, Math.max(1, Number(f.parcelas_max.value) || 1)),
      link: f.link.value.trim() || null
    };
    if (!dados.loja || dados.preco == null) return;
    const r = await exec(sb.from('cotacoes').insert(dados), 'Cotação adicionada');
    if (r.ok) {
      // se o item estava "pendente", passa para "cotando"
      if (item.status === 'pendente') {
        await exec(sb.from('itens').update({ status: 'cotando' }).eq('id', item.id));
        const sel = $('#f-item [name=status]');
        if (sel && sel.value === 'pendente') { sel.value = 'cotando'; sel.dispatchEvent(new Event('input')); }
      }
      await carregar(); render(); renderCotacoes();
    }
  };
  $$('[data-del-cot]', box).forEach(b => b.onclick = async () => {
    const r = await exec(sb.from('cotacoes').delete().eq('id', Number(b.dataset.delCot)));
    if (r.ok) { await carregar(); render(); renderCotacoes(true); }
  });
  // "Comprei aqui": preenche o formulário de compra a partir da cotação (o usuário revisa e salva)
  $$('[data-comprar]', box).forEach(b => b.onclick = () => {
    const c = cs.find(x => x.id === Number(b.dataset.comprar));
    const f = $('#f-item');
    f.status.value = 'comprado';
    f.valor_pago.value = (Number(c.preco) * Number(f.quantidade.value || 1)).toFixed(2);
    f.loja_compra.value = c.loja;
    f.data_compra.value = hoje();
    f.forma_pagamento.value = c.parcelas_max > 1 ? 'parcelado' : 'avista';
    if (c.parcelas_max > 1) f.parcelas.value = c.parcelas_max;
    f.status.dispatchEvent(new Event('input'));
    $('#fs-compra').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('Confira os dados da compra e toque em Salvar');
  });
}

// =====================================================================
// Finanças
// =====================================================================
function renderFinancas(el) {
  const r = resumo();
  const linhasComodo = [...db.comodos.map(c => [c.id, c.nome, Number(c.orcamento) || 0]), [null, 'Sem cômodo', 0]]
    .map(([id, nome, orc]) => {
      const its = itensDoComodo(id);
      return { nome, orc, gasto: soma(its.map(gastoItem)), prev: soma(its.map(previstoItem)), n: its.length };
    })
    .filter(l => l.n || l.orc);

  const barra = (gasto, prev, orc) => {
    const base = Math.max(orc, gasto + prev, 1);
    return `<div class="barra ${orc && gasto > orc ? 'estouro' : ''}">
      <span class="b-gasto" style="width:${gasto / base * 100}%"></span>
      <span class="b-prev" style="width:${prev / base * 100}%"></span></div>`;
  };

  // parcelamentos ativos
  const ativos = db.itens.filter(i => i.status === 'comprado' && i.forma_pagamento === 'parcelado' && i.parcelas > 1)
    .map(i => {
      const ps = parcelasDoItem(i);
      return { i, ps, pagas: ps.filter(p => p.mes <= r.atual).length, fim: ps[ps.length - 1].mes };
    })
    .filter(x => x.fim >= r.atual)
    .sort((a, b) => a.fim.localeCompare(b.fim));
  const meses12 = Array.from({ length: 12 }, (_, k) => addMes(r.atual, k));
  const porMes = meses12.map(m => soma(r.parcelas.filter(p => p.mes === m).map(p => p.valor)));

  el.innerHTML = `
    <section class="secao">
      <h2>Orçamento por cômodo</h2>
      <div class="card">
        ${linhasComodo.length ? linhasComodo.map(l => `
          <div style="padding:8px 0;border-bottom:1px solid var(--line)">
            <div class="linha"><strong>${esc(l.nome)}</strong>
              <span class="num">${brl(l.gasto)}${l.orc ? ` <small>/ ${brl(l.orc)}</small>` : ''}</span></div>
            ${barra(l.gasto, l.prev, l.orc)}
            <small>${l.prev ? `+ ${brl(l.prev)} previsto` : 'nada previsto em aberto'}${l.orc ? ` · ${l.gasto + l.prev > l.orc ? `<span style="color:var(--danger)">excede ${brl(l.gasto + l.prev - l.orc)}</span>` : `sobra ${brl(l.orc - l.gasto - l.prev)}`}` : ''}</small>
          </div>`).join('') : '<div class="vazio">Cadastre cômodos e itens para acompanhar.</div>'}
        <div style="padding-top:10px">
          <div class="linha"><strong>Total</strong><span class="num">${brl(r.gasto)}${r.orcamento ? ` <small>/ ${brl(r.orcamento)}</small>` : ''}</span></div>
          ${barra(r.gasto, r.previsto, r.orcamento)}
          <small>■ gasto &nbsp; ▨ previsto pelas menores cotações</small>
        </div>
      </div>
    </section>

    <section class="secao">
      <h2>Parcelas nos próximos 12 meses</h2>
      <div class="card">
        ${porMes.some(v => v) ? '<div class="grafico" style="height:200px"><canvas id="g-parcelas"></canvas></div>' : '<div class="vazio">Nenhuma parcela a vencer.</div>'}
        ${ativos.length ? `<div style="margin-top:12px">${ativos.map(a => `
          <div class="tabela-linha">
            <div>${esc(a.i.nome)}<br><small>${a.pagas}/${a.i.parcelas} pagas · termina ${mesLabel(a.fim)}</small></div>
            <span class="num">${brl(a.ps[0].valor)}<small>/mês</small></span>
            <span></span>
          </div>`).join('')}</div>` : ''}
      </div>
    </section>

    <section class="secao">
      <h2>Aportes</h2>
      <div class="card">
        <form id="f-aporte" class="campos">
          <label>Valor<input name="valor" type="number" step="0.01" inputmode="decimal" required placeholder="0,00"></label>
          <label>Data<input name="data" type="date" value="${hoje()}" required></label>
          <label class="cheio">Descrição (opcional)<input name="descricao" placeholder="Ex.: 13º, sobra do mês"></label>
          <button class="btn cheio">Registrar aporte</button>
        </form>
        <p class="muted" style="font-size:.78rem;margin:8px 0 0">Para registrar uma retirada, use valor negativo.</p>
        <div style="margin-top:10px">
          ${db.aportes.map(a => `
            <div class="tabela-linha">
              <div>${fmtData(a.data)}${a.descricao ? `<br><small>${esc(a.descricao)}</small>` : ''}</div>
              <span class="num" style="${a.valor < 0 ? 'color:var(--danger)' : ''}">${brl(a.valor)}</span>
              <button class="icone-btn" data-del-aporte="${a.id}" aria-label="Excluir aporte">✕</button>
            </div>`).join('')}
        </div>
        <div class="linha" style="margin-top:10px"><strong>Total guardado</strong><span class="num">${brl(r.aportado)}</span></div>
      </div>
    </section>`;

  if ($('#g-parcelas')) {
    graficos.push(new Chart($('#g-parcelas'), {
      type: 'bar',
      data: { labels: meses12.map(mesLabel), datasets: [{ label: 'Parcelas', data: porMes, backgroundColor: cssVar('--accent'), borderRadius: 4 }] },
      options: opcoesGrafico({ plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => brl(ctx.parsed.y) } } } })
    }));
  }

  $('#f-aporte').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    const valor = numInput(f.valor.value);
    if (!valor) return toast('Informe um valor diferente de zero.', true);
    const r2 = await exec(sb.from('aportes').insert({ valor, data: f.data.value, descricao: f.descricao.value.trim() || null }), 'Aporte registrado');
    if (r2.ok) await recarregar();
  };
  $$('[data-del-aporte]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este aporte?')) return;
    const r2 = await exec(sb.from('aportes').delete().eq('id', Number(b.dataset.delAporte)), 'Aporte excluído');
    if (r2.ok) await recarregar();
  });
}

// =====================================================================
// Ajustes
// =====================================================================
function renderAjustes(el) {
  const c = db.config;
  const usandoLocal = !(window.ENXOVAL_CONFIG?.supabaseUrl && window.ENXOVAL_CONFIG?.supabaseAnonKey);
  el.innerHTML = `
    <section class="secao">
      <h2>Meta e orçamento</h2>
      <form class="card campos" id="f-config">
        <label class="cheio">Meta de valor a juntar<input name="meta_valor" type="number" min="0" step="0.01" inputmode="decimal" value="${c.meta_valor ?? 0}"></label>
        <label>Início da meta<input name="meta_inicio" type="date" value="${c.meta_inicio || hoje()}" required></label>
        <label>Prazo<input name="meta_data" type="date" value="${c.meta_data || ''}"></label>
        <label class="cheio">Orçamento total do enxoval<input name="orcamento_total" type="number" min="0" step="0.01" inputmode="decimal" value="${c.orcamento_total ?? 0}"></label>
        <button class="btn cheio">Salvar</button>
      </form>
    </section>

    <section class="secao">
      <h2>Cômodos</h2>
      <div class="card">
        <div class="ajuste-linha" style="font-size:.75rem;color:var(--muted)"><span>Nome</span><span>Orçamento</span><span></span></div>
        ${db.comodos.map(cm => `
          <div class="ajuste-linha" data-comodo="${cm.id}">
            <input name="nome" value="${esc(cm.nome)}" aria-label="Nome do cômodo">
            <input name="orcamento" type="number" min="0" step="0.01" inputmode="decimal" value="${cm.orcamento}" aria-label="Orçamento">
            <button class="icone-btn" data-del-comodo="${cm.id}" aria-label="Excluir cômodo">✕</button>
          </div>`).join('')}
        <form class="ajuste-linha" id="f-comodo" style="margin-top:12px">
          <input name="nome" placeholder="Novo cômodo" required>
          <input name="orcamento" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Orçamento">
          <button class="btn mini">+</button>
        </form>
        <small>Soma dos orçamentos por cômodo: ${brl(soma(db.comodos.map(x => x.orcamento)))}</small>
      </div>
    </section>

    <section class="secao">
      <h2>Categorias</h2>
      <div class="card">
        ${db.categorias.map(ct => `
          <div class="ajuste-linha dois" data-categoria="${ct.id}">
            <input name="nome" value="${esc(ct.nome)}" aria-label="Nome da categoria">
            <button class="icone-btn" data-del-categoria="${ct.id}" aria-label="Excluir categoria">✕</button>
          </div>`).join('')}
        <form class="ajuste-linha dois" id="f-categoria" style="margin-top:12px">
          <input name="nome" placeholder="Nova categoria" required>
          <button class="btn mini">+</button>
        </form>
      </div>
    </section>

    <section class="secao">
      <h2>Conta</h2>
      <div class="card">
        <div class="linha"><span>${esc(sessao.user.email)}</span><button class="btn sec mini" id="sair">Sair</button></div>
        ${usandoLocal ? '<div class="linha"><small>Projeto Supabase salvo neste aparelho</small><button class="btn sec mini" id="trocar-projeto">Trocar</button></div>' : ''}
      </div>
    </section>`;

  $('#f-config').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    if (f.meta_data.value && f.meta_data.value < f.meta_inicio.value) return toast('O prazo deve ser depois do início.', true);
    const r = await exec(sb.from('config').update({
      meta_valor: numInput(f.meta_valor.value) || 0,
      meta_inicio: f.meta_inicio.value,
      meta_data: f.meta_data.value || null,
      orcamento_total: numInput(f.orcamento_total.value) || 0
    }).eq('id', 1), 'Configurações salvas');
    if (r.ok) await recarregar();
  };

  $$('[data-comodo]').forEach(linha => {
    const id = Number(linha.dataset.comodo);
    $$('input', linha).forEach(inp => inp.onchange = async () => {
      const valor = inp.name === 'orcamento' ? (numInput(inp.value) || 0) : inp.value.trim();
      if (inp.name === 'nome' && !valor) return toast('O nome não pode ficar vazio.', true);
      const r = await exec(sb.from('comodos').update({ [inp.name]: valor }).eq('id', id), 'Cômodo atualizado');
      if (r.ok) await recarregar();
    });
  });
  $$('[data-del-comodo]').forEach(b => b.onclick = async () => {
    const id = Number(b.dataset.delComodo);
    const n = itensDoComodo(id).length;
    if (!confirm(n ? `Este cômodo tem ${n} ${n === 1 ? 'item' : 'itens'}, que ficarão "sem cômodo". Excluir?` : 'Excluir este cômodo?')) return;
    const r = await exec(sb.from('comodos').delete().eq('id', id), 'Cômodo excluído');
    if (r.ok) await recarregar();
  });
  $('#f-comodo').onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    const ordem = Math.max(0, ...db.comodos.map(x => x.ordem)) + 1;
    const r = await exec(sb.from('comodos').insert({ nome: f.nome.value.trim(), orcamento: numInput(f.orcamento.value) || 0, ordem }), 'Cômodo adicionado');
    if (r.ok) await recarregar();
  };

  $$('[data-categoria]').forEach(linha => {
    const inp = $('input', linha);
    inp.onchange = async () => {
      if (!inp.value.trim()) return toast('O nome não pode ficar vazio.', true);
      const r = await exec(sb.from('categorias').update({ nome: inp.value.trim() }).eq('id', Number(linha.dataset.categoria)), 'Categoria atualizada');
      if (r.ok) await recarregar();
    };
  });
  $$('[data-del-categoria]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir esta categoria? Os itens dela ficam sem categoria.')) return;
    const r = await exec(sb.from('categorias').delete().eq('id', Number(b.dataset.delCategoria)), 'Categoria excluída');
    if (r.ok) await recarregar();
  });
  $('#f-categoria').onsubmit = async e => {
    e.preventDefault();
    const r = await exec(sb.from('categorias').insert({ nome: e.target.nome.value.trim() }), 'Categoria adicionada');
    if (r.ok) await recarregar();
  };

  $('#sair').onclick = () => sb.auth.signOut();
  const trocar = $('#trocar-projeto');
  if (trocar) trocar.onclick = async () => {
    if (!confirm('Remover os dados do projeto Supabase deste aparelho?')) return;
    try { localStorage.removeItem('enxoval.supabase'); } catch { /* ignore */ }
    await sb.auth.signOut();
    location.reload();
  };
}

// =====================================================================
iniciar();
})();
