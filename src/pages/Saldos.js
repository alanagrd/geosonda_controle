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

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: obras }, { data: dsData }, { data: fatData }, { data: trData }] = await Promise.all([
      supabase.schema('geosonda').from('obras').select('*').order('nome'),
      supabase.schema('geosonda').from('ds').select('*').order('competencia').order('numero_ds'),
      supabase.schema('geosonda').from('faturamento').select('*').order('competencia').order('data_nf'),
      supabase.schema('geosonda').from('transferencias').select('*').order('competencia'),
    ])

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
      mapa[o.nome] = { ...o, ds: [], fat: [], transferencias_in: [], transferencias_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
    })

    // Garante que obras que aparecem nas DS mas não estão cadastradas também apareçam
    ;(dsData || []).forEach(d => {
      if (!mapa[d.obra]) mapa[d.obra] = { nome: d.obra, tipo: 'direto', ds: [], fat: [], transferencias_in: [], transferencias_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
      mapa[d.obra].ds.push(d)
      mapa[d.obra].totalDs += Number(d.valor)
    })

    ;(fatData || []).forEach(f => {
      if (!mapa[f.obra]) mapa[f.obra] = { nome: f.obra, tipo: 'direto', ds: [], fat: [], transferencias_in: [], transferencias_out: [], totalDs: 0, totalFat: 0, totalTr: 0 }
      mapa[f.obra].fat.push(f)
      mapa[f.obra].totalFat += Number(f.valor)
    })

    ;(trData || []).forEach(t => {
      if (mapa[t.obra_destino]) { mapa[t.obra_destino].transferencias_in.push(t); mapa[t.obra_destino].totalTr += Number(t.valor) }
      if (mapa[t.obra_origem])  { mapa[t.obra_origem].transferencias_out.push(t); mapa[t.obra_origem].totalTr  -= Number(t.valor) }
    })

    setDados(Object.values(mapa))
    setLoading(false)
  }

  function getSaldo(d) { return (d.saldo_inicial || 0) + d.totalDs - d.totalFat - d.totalTr }

  // Aplica filtro de competência nas DS e NF
  function getDadosComp(d, comp) {
    const saldoInicial = Number(d.saldo_inicial || 0)
    if (comp === 'todos') return {
      ds: d.ds, fat: d.fat,
      totalDs: saldoInicial + d.totalDs,
      totalFat: d.totalFat + d.totalTr
    }
    const ds  = d.ds.filter(x => normComp(x.competencia) === comp)
    const fat = d.fat.filter(x => normComp(x.competencia) === comp)
    const trsIn  = d.transferencias_in.filter(x => normComp(x.competencia) === comp)
    const trsOut = d.transferencias_out.filter(x => normComp(x.competencia) === comp)
    const totalTr = trsIn.reduce((a,x) => a + Number(x.valor), 0) - trsOut.reduce((a,x) => a + Number(x.valor), 0)
    return {
      ds, fat,
      totalDs: saldoInicial + ds.reduce((a, x) => a + Number(x.valor), 0),
      totalFat: fat.reduce((a, x) => a + Number(x.valor), 0) + totalTr,
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
            <th>Obra</th>
            <th className="num">Total DS</th>
            <th className="num">NF Faturada</th>
            <th className="num">Transf.</th>
            <th className="num">Saldo</th>
            <th>Status</th>
            <th></th>
          </tr></thead>
          <tbody>
            {lista.sort((a, b) => getSaldo(b) - getSaldo(a)).map(d => {
              const { totalDs, totalFat } = getDadosComp(d, filtroComp)
              const trTotal = filtroComp === 'todos' ? d.totalTr : 0
              const saldo = filtroComp === 'todos' ? getSaldo(d) : totalDs - totalFat
              const pct = totalDs > 0 ? Math.min(100, Math.max(0, ((totalFat + (filtroComp === 'todos' ? d.totalTr : 0)) / totalDs) * 100)) : 0
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
                      <button className="sm" onClick={() => setExpandida(isExp ? null : d.nome)}>
                        {isExp ? '▲ Fechar' : '▼ Detalhe'}
                      </button>
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
            <button className="success" onClick={() => exportarCSV(dados)}>↓ Exportar CSV</button>
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
