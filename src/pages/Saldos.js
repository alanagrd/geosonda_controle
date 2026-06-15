// v3
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Normaliza competência para MM/AAAA independente do formato salvo no banco
function normComp(val) {
  if (!val) return ''
  const s = String(val).trim()
  if (/^\d{2}\/\d{4}$/.test(s)) return s
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return `${s.slice(3, 5)}/${s.slice(6)}`
  return s
}

export default function Saldos() {
  const [dados, setDados]   = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [filtroTipo, setFiltroTipo]     = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroComp, setFiltroComp]     = useState('todos')
  const [expandida, setExpandida]       = useState(null)
  const [comps, setComps]               = useState([])
  const [ordemAlfabetica, setOrdemAlfabetica] = useState(false)
  const [modalTrDs, setModalTrDs] = useState(false)
  const [formTrDs, setFormTrDs]   = useState({ competencia: '', obra_origem: '', obra_destino: '', valor: '', motivo: '' })
  const [obras, setObras]         = useState([])
  const [savingTrDs, setSavingTrDs] = useState(false)
  const [erroTrDs, setErroTrDs]   = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: obras }, { data: dsData }, { data: fatData }, { data: trData }, { data: trDsData }] = await Promise.all([
      supabase.schema('geosonda').from('obras').select('*').order('nome'),
      supabase.schema('geosonda').from('ds').select('*').order('competencia').order('numero_ds'),
      supabase.schema('geosonda').from('faturamento').select('*').order('competencia').order('data_nf'),
      supabase.schema('geosonda').from('transferencias').select('*').order('competencia'),
      supabase.schema('geosonda').from('transferencias_ds').select('*').order('competencia'),
    ])
    setObras(obras || [])

    const todasComps = [
      ...new Set([
        ...(dsData || []).map(d => normComp(d.competencia)),
        ...(fatData || []).map(f => normComp(f.competencia)),
      ])
    ].filter(Boolean).sort().reverse()
    setComps(todasComps)

    // Monta mapa de saldos por obra
    const mapa = {}
    ;(obras || []).forEach(o => {
      mapa[o.nome] = { ...o, saldo_inicial: Number(o.saldo_inicial || 0), ds: [], fat: [], transferencias_in: [], transferencias_out: [], trDs_in: [], trDs_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
    })

    // Garante que obras que aparecem nas DS mas não estão cadastradas também apareçam
    ;(dsData || []).forEach(d => {
      if (!mapa[d.obra]) mapa[d.obra] = { nome: d.obra, tipo: 'direto', ds: [], fat: [], transferencias_in: [], transferencias_out: [], trDs_in: [], trDs_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
      mapa[d.obra].ds.push(d)
      mapa[d.obra].totalDs += Number(d.valor)
    })

    ;(fatData || []).forEach(f => {
      if (!mapa[f.obra]) mapa[f.obra] = { nome: f.obra, tipo: 'direto', ds: [], fat: [], transferencias_in: [], transferencias_out: [], trDs_in: [], trDs_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
      mapa[f.obra].fat.push(f)
      mapa[f.obra].totalFat += Number(f.valor)
    })

    ;(trData || []).forEach(t => {
      if (mapa[t.obra_destino]) { mapa[t.obra_destino].transferencias_in.push(t); mapa[t.obra_destino].totalTr += Number(t.valor) }
      if (mapa[t.obra_origem])  { mapa[t.obra_origem].transferencias_out.push(t); mapa[t.obra_origem].totalTr  -= Number(t.valor) }
    })

    ;(trDsData || []).forEach(t => {
      if (mapa[t.obra_destino]) { mapa[t.obra_destino].trDs_in.push(t) }
      if (mapa[t.obra_origem])  { mapa[t.obra_origem].trDs_out.push(t) }
    })

    setDados(Object.values(mapa))
    setLoading(false)
  }

  function getSaldo(d) {
    const trDsIn  = (d.trDs_in  || []).reduce((a, t) => a + Number(t.valor), 0)
    const trDsOut = (d.trDs_out || []).reduce((a, t) => a + Number(t.valor), 0)
    return Number(d.saldo_inicial || 0) + d.totalDs + trDsIn - trDsOut - d.totalFat - d.totalTr
  }

  // Aplica filtro de competência nas DS e NF
  function getDadosComp(d, comp) {
    const saldoInicial = comp === 'todos' ? Number(d.saldo_inicial || 0) : 0
    const trDsIn  = comp === 'todos' ? (d.trDs_in  || []) : (d.trDs_in  || []).filter(x => normComp(x.competencia) === comp)
    const trDsOut = comp === 'todos' ? (d.trDs_out || []) : (d.trDs_out || []).filter(x => normComp(x.competencia) === comp)
    const totalTrDs = trDsIn.reduce((a,x) => a + Number(x.valor), 0) - trDsOut.reduce((a,x) => a + Number(x.valor), 0)
    if (comp === 'todos') return {
      ds: d.ds, fat: d.fat,
      totalDs: saldoInicial + d.totalDs + totalTrDs,
      totalFat: d.totalFat + d.totalTr
    }
    const ds  = d.ds.filter(x => normComp(x.competencia) === comp)
    const fat = d.fat.filter(x => normComp(x.competencia) === comp)
    const trsIn  = (d.transferencias_in  || []).filter(x => normComp(x.competencia) === comp)
    const trsOut = (d.transferencias_out || []).filter(x => normComp(x.competencia) === comp)
    const totalTr = trsIn.reduce((a,x) => a + Number(x.valor), 0) - trsOut.reduce((a,x) => a + Number(x.valor), 0)
    return {
      ds, fat,
      totalDs: ds.reduce((a,x) => a + Number(x.valor), 0) + totalTrDs,
      totalFat: fat.reduce((a,x) => a + Number(x.valor), 0) + totalTr,
    }
  }

  const filtrados = dados.filter(d => {
    if (busca && !d.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo !== 'todos' && d.tipo !== filtroTipo) return false
    const { totalDs, totalFat } = getDadosComp(d, filtroComp)
    const saldo = filtroComp === 'todos' ? getSaldo(d) : totalDs - totalFat
    if (filtroStatus === 'pendente' && saldo <= 0.01) return false
    if (filtroStatus === 'quitado'  && Math.abs(saldo) > 0.01) return false
    if (filtroStatus === 'negativo' && saldo >= 0) return false
    // Esconde obras sem nenhum dado no filtro de comp
    if (filtroComp !== 'todos' && totalDs === 0 && totalFat === 0) return false
    return true
  })

  const totalGeralDs    = filtrados.reduce((a, d) => { const { totalDs } = getDadosComp(d, filtroComp); return a + totalDs }, 0)
  const totalGeralFat   = filtrados.reduce((a, d) => { const { totalFat } = getDadosComp(d, filtroComp); return a + totalFat }, 0)
  const totalGeralSaldo = totalGeralDs - totalGeralFat
  const countPendentes  = filtrados.filter(d => { const { totalDs, totalFat } = getDadosComp(d, filtroComp); return (totalDs - totalFat) > 0.01 }).length

  const diretos  = filtrados.filter(d => d.tipo === 'direto')
  const geosonda = filtrados.filter(d => d.tipo === 'geosonda')

  function renderTabela(lista, titulo) {
    if (lista.length === 0) return (
      <div>
        <div className="section-header">{titulo}</div>
        <div className="empty" style={{ padding: '20px 24px' }}>Nenhuma obra neste grupo.</div>
      </div>
    )
    return (
      <div>
        <div className="section-header">{titulo}</div>
        <table>
          <thead><tr>
            <th>
              Obra
              <button className="sm" style={{ marginLeft: 8, fontWeight: 400 }} onClick={() => setOrdemAlfabetica(o => !o)}>
                {ordemAlfabetica ? '↕ Saldo' : 'A→Z'}
              </button>
            </th>
            <th className="num">Total DS</th>
            <th className="num">NF Faturada</th>
            <th className="num">Transf.</th>
            <th className="num">Saldo</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {lista.sort((a, b) => ordemAlfabetica ? a.nome.localeCompare(b.nome) : getSaldo(b) - getSaldo(a)).map(d => {
              const { totalDs, totalFat } = getDadosComp(d, filtroComp)
              const trTotal = filtroComp === 'todos' ? d.totalTr : 0
              const saldo = filtroComp === 'todos' ? getSaldo(d) : totalDs - totalFat
              const pct = totalDs > 0 ? Math.min(100, Math.max(0, (totalFat / totalDs) * 100)) : 0
              const isExp = expandida === d.nome

              let badge, saldoCls
              if (saldo > 0.01)         { badge = <span className="badge badge-amber">Pendente</span>;  saldoCls = 'saldo-pos' }
              else if (saldo < -0.01)   { badge = <span className="badge badge-red">Excedente</span>;   saldoCls = 'saldo-neg' }
              else                      { badge = <span className="badge badge-green">Quitado</span>;    saldoCls = 'saldo-zero' }

              return (
                <React.Fragment key={d.nome}>
                  <tr>
                    <td><strong>{d.nome}</strong>{d.cliente ? <><br/><span style={{fontSize:11,color:'var(--text3)'}}>{d.cliente}</span></> : ''}</td>
                    <td className="num">R$ {R(totalDs)}</td>
                    <td className="num">R$ {R(totalFat)}</td>
                    <td className="num" style={{ color: trTotal !== 0 ? 'var(--accent)' : 'var(--text3)', fontSize: 12 }}>
                      {trTotal !== 0 ? `R$ ${R(trTotal)}` : '—'}
                    </td>
                    <td className="num">
                      <span className={saldoCls}>R$ {R(Math.abs(saldo))}</span>
                      <div className="progress-wrap">
                        <div className={`progress-bar ${saldo > 0.01 ? 'amber' : saldo < -0.01 ? 'red' : 'green'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td>{badge}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="sm" onClick={() => setExpandida(isExp ? null : d.nome)}>
                          {isExp ? '▲ Fechar' : '▼ Detalhe'}
                        </button>
                        <button className="sm" style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: '#F7C1C1' }} onClick={() => exportarPDFDetalhado(d, filtroComp)}>
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0, background: 'var(--surface2)' }}>
                        <div style={{ padding: '12px 20px' }}>
                          <DetalheObra d={d} filtroComp={filtroComp} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  async function salvarTrDs() {
    const { obra_origem, obra_destino, valor, motivo, competencia } = formTrDs
    if (!obra_origem || !obra_destino || !valor || !competencia) { setErroTrDs('Preencha todos os campos obrigatórios.'); return }
    if (obra_origem === obra_destino) { setErroTrDs('Origem e destino não podem ser iguais.'); return }
    setSavingTrDs(true); setErroTrDs('')
    const { error } = await supabase.schema('geosonda').from('transferencias_ds').insert({
      competencia, obra_origem, obra_destino, valor: parseFloat(valor), motivo: motivo || null
    })
    if (error) { setErroTrDs(error.message); setSavingTrDs(false); return }
    setSavingTrDs(false); setModalTrDs(false); carregar()
  }

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Total DS lançado</div><div className="stat-value amber">R$ {R(totalGeralDs)}</div></div>
        <div className="stat-card"><div className="stat-label">Total faturado</div><div className="stat-value green">R$ {R(totalGeralFat)}</div></div>
        <div className="stat-card"><div className="stat-label">Saldo a faturar</div><div className={`stat-value ${totalGeralSaldo > 0 ? 'amber' : totalGeralSaldo < 0 ? 'red' : 'green'}`}>R$ {R(totalGeralSaldo)}</div></div>
        <div className="stat-card"><div className="stat-label">Obras c/ pendência</div><div className={`stat-value ${countPendentes > 0 ? 'red' : 'green'}`}>{countPendentes}</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2>Posição por obra</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ width: 200 }} placeholder="Buscar obra..." value={busca} onChange={e => setBusca(e.target.value)} />
            <button className="success" onClick={() => { setErroTrDs(''); setFormTrDs({ competencia: '', obra_origem: '', obra_destino: '', valor: '', motivo: '' }); setModalTrDs(true) }}>↔ Transferir DS</button>
            <button className="success" onClick={() => exportarCSV(dados)}>↓ Exportar CSV</button>
            <button onClick={() => exportarPDF(filtrados, filtroComp, filtroTipo, getDadosComp)} style={{ background: 'var(--red-bg)', color: 'var(--red)', borderColor: '#F7C1C1' }}>↓ Relatório PDF</button>
          </div>
        </div>

        <div className="filter-row" style={{ paddingBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Competência:</span>
          <span className={`chip ${filtroComp === 'todos' ? 'active' : ''}`} onClick={() => setFiltroComp('todos')}>Todas</span>
          {comps.map(c => (
            <span key={c} className={`chip ${filtroComp === c ? 'active' : ''}`} onClick={() => setFiltroComp(c)}>{c}</span>
          ))}
        </div>
        <div className="filter-row" style={{ paddingBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Tipo:</span>
          {[['todos','Todos'],['direto','Direto'],['geosonda','Geosonda']].map(([v,l]) => (
            <span key={v} className={`chip ${filtroTipo === v ? 'active' : ''}`} onClick={() => setFiltroTipo(v)}>{l}</span>
          ))}
          <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>Status:</span>
          {[['todos','Todos'],['pendente','Pendente'],['quitado','Quitado'],['negativo','Excedente']].map(([v,l]) => (
            <span key={v} className={`chip ${filtroStatus === v ? 'active' : ''}`} onClick={() => setFiltroStatus(v)}>{l}</span>
          ))}
        </div>

        {loading ? <div className="empty">Carregando...</div> : (
          <>
            {renderTabela(diretos, 'Obras — Fatura direto ao cliente')}
            {renderTabela(geosonda, 'Centros de custo — Geosonda')}
          </>
        )}
      </div>

      {modalTrDs && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalTrDs(false)}>
          <div className="modal">
            <h2>Transferir DS entre obras</h2>
            <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #FAC775', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
              Use quando o valor devido de uma obra vai ser cobrado de outra. O saldo sai da origem e entra no destino.
            </div>
            <div className="field"><label>Competência * (MM/AAAA)</label>
              <input value={formTrDs.competencia} onChange={e => setFormTrDs(f => ({ ...f, competencia: e.target.value }))} placeholder="05/2026" />
            </div>
            <div className="field"><label>Obra de origem (que transfere o débito) *</label>
              <select value={formTrDs.obra_origem} onChange={e => setFormTrDs(f => ({ ...f, obra_origem: e.target.value }))}>
                <option value="">Selecione...</option>
                {obras.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
              </select>
              {formTrDs.obra_origem && (() => {
                const d = dados.find(x => x.nome === formTrDs.obra_origem)
                if (!d) return null
                const s = getSaldo(d)
                return <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Saldo atual: <strong style={{ color: s > 0 ? 'var(--amber)' : 'var(--red)' }}>R$ {R(Math.abs(s))}</strong></div>
              })()}
            </div>
            <div className="field"><label>Obra de destino (que assume o débito) *</label>
              <select value={formTrDs.obra_destino} onChange={e => setFormTrDs(f => ({ ...f, obra_destino: e.target.value }))}>
                <option value="">Selecione...</option>
                {obras.filter(o => o.nome !== formTrDs.obra_origem).map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
              </select>
            </div>
            <div className="field"><label>Valor a transferir (R$) *</label>
              <input type="number" step="0.01" value={formTrDs.valor} onChange={e => setFormTrDs(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="field"><label>Motivo</label>
              <input value={formTrDs.motivo} onChange={e => setFormTrDs(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: DS 16521 DIAVISTA → TIRAVISTA" />
            </div>
            {erroTrDs && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erroTrDs}</p>}
            <div className="modal-footer">
              <button onClick={() => setModalTrDs(false)}>Cancelar</button>
              <button className="primary" onClick={salvarTrDs} disabled={savingTrDs}>{savingTrDs ? 'Salvando...' : 'Confirmar transferência'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetalheObra({ d, filtroComp }) {
  const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const ds  = filtroComp === 'todos' ? d.ds  : d.ds.filter(x => x.competencia === filtroComp)
  const fat = filtroComp === 'todos' ? d.fat : d.fat.filter(x => x.competencia === filtroComp)
  const trsIn  = filtroComp === 'todos' ? d.transferencias_in  : d.transferencias_in.filter(x => x.competencia === filtroComp)
  const trsOut = filtroComp === 'todos' ? d.transferencias_out : d.transferencias_out.filter(x => x.competencia === filtroComp)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>DS Lançadas</div>
        {d.saldo_inicial > 0 && (
          <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #FAC775', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10, fontSize: 12, color: 'var(--amber)' }}>
            <strong>Saldo anterior (até 31/03/2026):</strong> R$ {R(d.saldo_inicial)}
          </div>
        )}
        {ds.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma DS neste filtro.</p> : (
          <table>
            <thead><tr><th>Comp.</th><th>Nº DS</th><th>Tipo</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {ds.map(x => (
                <tr key={x.id}>
                  <td>{x.competencia}</td>
                  <td>{x.numero_ds}</td>
                  <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{x.tipo_ds}</span></td>
                  <td className="num">R$ {R(x.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={3} style={{ fontSize: 11 }}>Total DS{d.saldo_inicial > 0 ? ' + Saldo anterior' : ''}</td>
              <td className="num">R$ {R(ds.reduce((a,x) => a + Number(x.valor), 0) + Number(d.saldo_inicial || 0))}</td>
            </tr></tfoot>
          </table>
        )}
        {(d.trDs_out || []).length > 0 && (
          <div style={{ marginTop: 8, background: 'var(--red-bg)', border: '0.5px solid #F7C1C1', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, color: 'var(--red)' }}>
            {(d.trDs_out || []).map(t => (
              <div key={t.id}>↗ <strong>Transferido para {t.obra_destino}:</strong> R$ {R(t.valor)} {t.motivo ? `— ${t.motivo}` : ''}</div>
            ))}
          </div>
        )}
        {(d.trDs_in || []).length > 0 && (
          <div style={{ marginTop: 8, background: 'var(--green-bg)', border: '0.5px solid #C0DD97', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, color: 'var(--green)' }}>
            {(d.trDs_in || []).map(t => (
              <div key={t.id}>↙ <strong>Recebido de {t.obra_origem}:</strong> R$ {R(t.valor)} {t.motivo ? `— ${t.motivo}` : ''}</div>
            ))}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>NF Faturadas</div>
        {fat.length === 0 && trsIn.length === 0 && trsOut.length === 0
          ? <p style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum faturamento neste filtro.</p>
          : (
          <table>
            <thead><tr><th>Comp.</th><th>NF</th><th className="num">Valor</th><th>Obs.</th></tr></thead>
            <tbody>
              {fat.map(x => (
                <tr key={x.id}>
                  <td>{x.competencia}</td>
                  <td>{x.numero_nf ? <span className="badge badge-blue" style={{ fontSize: 10 }}>NF {x.numero_nf}</span> : '—'}</td>
                  <td className="num" style={{ color: 'var(--green)' }}>R$ {R(x.valor)}</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={x.observacao || ''}>{x.observacao || ''}</td>
                </tr>
              ))}
              {trsIn.map(x => (
                <tr key={x.id} style={{ background: 'var(--green-bg)' }}>
                  <td>{x.competencia}</td>
                  <td><span className="badge badge-green" style={{ fontSize: 10 }}>↙ de {x.obra_origem}</span></td>
                  <td className="num" style={{ color: 'var(--green)' }}>R$ {R(x.valor)}</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{x.motivo || ''}</td>
                </tr>
              ))}
              {trsOut.map(x => (
                <tr key={x.id} style={{ background: 'var(--red-bg)' }}>
                  <td>{x.competencia}</td>
                  <td><span className="badge badge-red" style={{ fontSize: 10 }}>↗ para {x.obra_destino}</span></td>
                  <td className="num" style={{ color: 'var(--red)' }}>- R$ {R(x.valor)}</td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{x.motivo || ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={2} style={{ fontSize: 11 }}>Total faturado</td>
              <td className="num">R$ {R([...fat,...trsIn].reduce((a,x)=>a+Number(x.valor),0) - trsOut.reduce((a,x)=>a+Number(x.valor),0))}</td>
              <td />
            </tr></tfoot>
          </table>
        )}
      </div>
    </div>
  )
}

function exportarPDF(filtrados, filtroComp, filtroTipo, getDadosComp) {
  const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hoje = new Date().toLocaleDateString('pt-BR')
  const compLabel = filtroComp === 'todos' ? 'Todas' : filtroComp
  const tipoLabel = filtroTipo === 'todos' ? 'Todos' : filtroTipo === 'direto' ? 'Direto' : 'Geosonda'

  const totalDs  = filtrados.reduce((a, d) => a + getDadosComp(d, filtroComp).totalDs, 0)
  const totalFat = filtrados.reduce((a, d) => a + getDadosComp(d, filtroComp).totalFat, 0)
  const totalSaldo = totalDs - totalFat

  const diretos  = filtrados.filter(d => d.tipo === 'direto')
  const geosonda = filtrados.filter(d => d.tipo === 'geosonda')

  function renderGrupo(lista, titulo) {
    if (lista.length === 0) return ''
    const rows = lista.sort((a, b) => a.nome.localeCompare(b.nome)).map(d => {
      const { totalDs, totalFat } = getDadosComp(d, filtroComp)
      const saldo = totalDs - totalFat
      const isQuit = Math.abs(saldo) <= 0.01
      return `<tr>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e5e5e0;font-weight:500;">${d.nome}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;">${R(totalDs)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;color:#3B6D11;">${R(totalFat)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;font-weight:500;color:${saldo > 0.01 ? '#854F0B' : saldo < -0.01 ? '#A32D2D' : '#3B6D11'};">${R(saldo)}</td>
        <td style="padding:8px 12px;border-bottom:0.5px solid #e5e5e0;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:500;background:${isQuit ? '#EAF3DE' : '#FAEEDA'};color:${isQuit ? '#3B6D11' : '#854F0B'};">${isQuit ? 'Quitado' : 'Pendente'}</span>
        </td>
      </tr>`
    }).join('')
    return `
      <div style="margin-top:20px;">
        <div style="padding:7px 12px;background:#f0f0ee;font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;border-radius:6px 6px 0 0;border:0.5px solid #e5e5e0;">${titulo}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;border:0.5px solid #e5e5e0;border-top:none;">
          <thead>
            <tr style="background:#f0f0ee;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5px solid #e5e5e0;">Obra</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5px solid #e5e5e0;">Total DS</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5px solid #e5e5e0;">NF Faturada</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5px solid #e5e5e0;">Saldo</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5px solid #e5e5e0;">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="background:#f0f0ee;">
              <td style="padding:8px 12px;font-weight:600;font-size:12px;color:#666;">Total</td>
              <td style="padding:8px 12px;text-align:right;font-weight:600;">${R(lista.reduce((a,d) => a + getDadosComp(d,filtroComp).totalDs, 0))}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:600;color:#3B6D11;">${R(lista.reduce((a,d) => a + getDadosComp(d,filtroComp).totalFat, 0))}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:600;color:#854F0B;">${R(lista.reduce((a,d) => { const {totalDs,totalFat} = getDadosComp(d,filtroComp); return a + totalDs - totalFat }, 0))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Faturamento — Geosonda</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a18; padding: 32px; background: #fff; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:24px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1.5px solid #1a1a18;">
    <div>
      <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">AGOS Serviços</div>
      <div style="font-size:20px;font-weight:600;">Relatório de Faturamento</div>
      <div style="font-size:13px;color:#666;margin-top:2px;">Controle de saldos por obra — Geosonda</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#666;line-height:1.8;">
      <div>Emissão: <strong style="color:#1a1a18;">${hoje}</strong></div>
      <div>Competência: <strong style="color:#1a1a18;">${compLabel}</strong></div>
      <div>Tipo: <strong style="color:#1a1a18;">${tipoLabel}</strong></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Total DS</div>
      <div style="font-size:18px;font-weight:600;color:#854F0B;">R$ ${R(totalDs)}</div>
    </div>
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">NF Faturada</div>
      <div style="font-size:18px;font-weight:600;color:#3B6D11;">R$ ${R(totalFat)}</div>
    </div>
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Saldo a faturar</div>
      <div style="font-size:18px;font-weight:600;color:${totalSaldo > 0 ? '#854F0B' : '#3B6D11'};">R$ ${R(totalSaldo)}</div>
    </div>
  </div>

  ${renderGrupo(diretos, 'Obras — fatura direto ao cliente')}
  ${renderGrupo(geosonda, 'Centros de custo — Geosonda')}

  <div style="margin-top:24px;padding:10px 14px;border:0.5px solid #e5e5e0;border-radius:6px;font-size:11px;color:#999;text-align:center;">
    Documento gerado automaticamente pelo sistema de Controle de Faturamento — AGOS Serviços — ${hoje}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `relatorio_geosonda_${filtroComp === 'todos' ? 'todos' : filtroComp.replace('/', '-')}_${new Date().toISOString().slice(0,10)}.html`
  a.click()
}

function exportarPDFDetalhado(d, filtroComp) {
  const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hoje = new Date().toLocaleDateString('pt-BR')
  const compLabel = filtroComp === 'todos' ? 'Todas' : filtroComp

  const saldoInicial = Number(d.saldo_inicial || 0)
  const ds = filtroComp === 'todos' ? d.ds : d.ds.filter(x => normComp(x.competencia) === filtroComp)
  const fat = filtroComp === 'todos' ? d.fat : d.fat.filter(x => normComp(x.competencia) === filtroComp)
  const trsIn  = filtroComp === 'todos' ? d.transferencias_in  : d.transferencias_in.filter(x => normComp(x.competencia) === filtroComp)
  const trsOut = filtroComp === 'todos' ? d.transferencias_out : d.transferencias_out.filter(x => normComp(x.competencia) === filtroComp)
  const trDsIn  = filtroComp === 'todos' ? (d.trDs_in  || []) : (d.trDs_in  || []).filter(x => normComp(x.competencia) === filtroComp)
  const trDsOut = filtroComp === 'todos' ? (d.trDs_out || []) : (d.trDs_out || []).filter(x => normComp(x.competencia) === filtroComp)

  const totalDs  = saldoInicial + ds.reduce((a, x) => a + Number(x.valor), 0) + trDsIn.reduce((a,x) => a + Number(x.valor), 0) - trDsOut.reduce((a,x) => a + Number(x.valor), 0)
  const totalFat = fat.reduce((a, x) => a + Number(x.valor), 0) + trsIn.reduce((a,x) => a + Number(x.valor), 0) - trsOut.reduce((a,x) => a + Number(x.valor), 0)
  const saldo = totalDs - totalFat

  const rowsDS = ds.map(x => `
    <tr>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.numero_ds}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;"><span style="background:#f0f0ee;padding:2px 8px;border-radius:20px;font-size:11px;">${x.tipo_ds}</span></td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;">R$ ${R(x.valor)}</td>
    </tr>`).join('')

  const rowsTrDsOut = trDsOut.map(x => `
    <tr style="background:#FFF5F5;">
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td colspan="2" style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#A32D2D;">↗ Transferido para ${x.obra_destino}${x.motivo ? ` — ${x.motivo}` : ''}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;color:#A32D2D;">- R$ ${R(x.valor)}</td>
    </tr>`).join('')

  const rowsTrDsIn = trDsIn.map(x => `
    <tr style="background:#F5FBF0;">
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td colspan="2" style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#3B6D11;">↙ Recebido de ${x.obra_origem}${x.motivo ? ` — ${x.motivo}` : ''}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;text-align:right;color:#3B6D11;">R$ ${R(x.valor)}</td>
    </tr>`).join('')

  const rowsFat = fat.map(x => `
    <tr>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.numero_nf ? `<span style="background:#E6F1FB;color:#185FA5;padding:2px 8px;border-radius:20px;font-size:11px;">NF ${x.numero_nf}</span>` : '—'}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#3B6D11;text-align:right;">R$ ${R(x.valor)}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;font-size:11px;color:#999;">${x.observacao || ''}</td>
    </tr>`).join('')

  const rowsTrIn = trsIn.map(x => `
    <tr style="background:#F5FBF0;">
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#3B6D11;">↙ Crédito de ${x.obra_origem}${x.nf_referencia ? ` (${x.nf_referencia})` : ''}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#3B6D11;text-align:right;">R$ ${R(x.valor)}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;font-size:11px;color:#999;">${x.motivo || ''}</td>
    </tr>`).join('')

  const rowsTrOut = trsOut.map(x => `
    <tr style="background:#FFF5F5;">
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;">${x.competencia}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#A32D2D;">↗ Crédito para ${x.obra_destino}${x.nf_referencia ? ` (${x.nf_referencia})` : ''}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;color:#A32D2D;text-align:right;">- R$ ${R(x.valor)}</td>
      <td style="padding:7px 12px;border-bottom:0.5px solid #e5e5e0;font-size:11px;color:#999;">${x.motivo || ''}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Detalhado — ${d.nome}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Arial, sans-serif; color: #1a1a18; padding: 32px; background: #fff; font-size: 13px; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.4px; padding: 8px 12px; text-align: left; background: #f0f0ee; border-bottom: 0.5px solid #e5e5e0; }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:24px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:1.5px solid #1a1a18;">
    <div>
      <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">AGOS Serviços</div>
      <div style="font-size:20px;font-weight:600;">${d.nome}</div>
      <div style="font-size:13px;color:#666;margin-top:2px;">Relatório detalhado de DS × NF Faturadas</div>
    </div>
    <div style="text-align:right;font-size:12px;color:#666;line-height:1.8;">
      <div>Emissão: <strong style="color:#1a1a18;">${hoje}</strong></div>
      <div>Competência: <strong style="color:#1a1a18;">${compLabel}</strong></div>
      <div>Tipo: <strong style="color:#1a1a18;">${d.tipo === 'direto' ? 'Fatura direto' : 'Geosonda'}</strong></div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Total DS</div>
      <div style="font-size:18px;font-weight:600;color:#854F0B;">R$ ${R(totalDs)}</div>
    </div>
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">NF Faturada</div>
      <div style="font-size:18px;font-weight:600;color:#3B6D11;">R$ ${R(totalFat)}</div>
    </div>
    <div style="background:#f0f0ee;border-radius:8px;padding:14px 16px;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:6px;">Saldo</div>
      <div style="font-size:18px;font-weight:600;color:${saldo > 0.01 ? '#854F0B' : saldo < -0.01 ? '#A32D2D' : '#3B6D11'};">R$ ${R(saldo)}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div>
      <div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">DS Lançadas</div>
      ${saldoInicial > 0 ? `<div style="background:#FAEEDA;border:0.5px solid #FAC775;border-radius:6px;padding:8px 12px;margin-bottom:8px;font-size:12px;color:#854F0B;"><strong>Saldo anterior (até 31/03/2026):</strong> R$ ${R(saldoInicial)}</div>` : ''}
      <table style="border:0.5px solid #e5e5e0;border-radius:6px;overflow:hidden;">
        <thead><tr><th>Comp.</th><th>Nº DS</th><th>Tipo</th><th style="text-align:right;">Valor</th></tr></thead>
        <tbody>
          ${rowsDS}
          ${rowsTrDsOut}
          ${rowsTrDsIn}
        </tbody>
        <tfoot>
          <tr style="background:#f0f0ee;">
            <td colspan="3" style="padding:8px 12px;font-weight:600;font-size:12px;">Total DS${saldoInicial > 0 ? ' + Saldo anterior' : ''}</td>
            <td style="padding:8px 12px;text-align:right;font-weight:600;">R$ ${R(totalDs)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div>
      <div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">NF Faturadas</div>
      <table style="border:0.5px solid #e5e5e0;border-radius:6px;overflow:hidden;">
        <thead><tr><th>Comp.</th><th>NF</th><th style="text-align:right;">Valor</th><th>Obs.</th></tr></thead>
        <tbody>
          ${rowsFat || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;">Nenhum faturamento.</td></tr>'}
          ${rowsTrIn}
          ${rowsTrOut}
        </tbody>
        <tfoot>
          <tr style="background:#f0f0ee;">
            <td colspan="2" style="padding:8px 12px;font-weight:600;font-size:12px;">Total faturado</td>
            <td style="padding:8px 12px;text-align:right;font-weight:600;color:#3B6D11;">R$ ${R(totalFat)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div style="margin-top:12px;padding:12px 14px;background:${saldo > 0.01 ? '#FAEEDA' : saldo < -0.01 ? '#FCEBEB' : '#EAF3DE'};border-radius:8px;">
        <div style="font-size:12px;color:#666;margin-bottom:4px;">Saldo final</div>
        <div style="font-size:18px;font-weight:600;color:${saldo > 0.01 ? '#854F0B' : saldo < -0.01 ? '#A32D2D' : '#3B6D11'};">R$ ${R(saldo)}</div>
        <div style="font-size:11px;color:#999;margin-top:2px;">${saldo > 0.01 ? 'Valor pendente a faturar' : saldo < -0.01 ? 'Excedente faturado' : 'Quitado'}</div>
      </div>
    </div>
  </div>

  <div style="margin-top:24px;padding:10px 14px;border:0.5px solid #e5e5e0;border-radius:6px;font-size:11px;color:#999;text-align:center;">
    Documento gerado automaticamente pelo sistema de Controle de Faturamento — AGOS Serviços — ${hoje}
  </div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `relatorio_${d.nome}_${filtroComp === 'todos' ? 'todos' : filtroComp.replace('/', '-')}_${new Date().toISOString().slice(0,10)}.html`
  a.click()
}

function exportarCSV(dados) {
  const R = v => Number(v || 0).toFixed(2).replace('.', ',')
  let csv = 'Obra;Tipo;Total DS;NF Faturada;Transferências;Saldo\n'
  dados.forEach(d => {
    const saldo = d.totalDs - d.totalFat - d.totalTr
    csv += `"${d.nome}";"${d.tipo}";${R(d.totalDs)};${R(d.totalFat)};${R(d.totalTr)};${R(saldo)}\n`
  })
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `geosonda_saldos_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
}
