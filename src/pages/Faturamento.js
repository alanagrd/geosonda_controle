import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().split('T')[0]
const mesAtual = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2,'0')}/${d.getFullYear()}` }

const EMPTY_FAT = { competencia: mesAtual(), data_nf: today(), numero_nf: '', obra: '', valor: '', observacao: '' }
const EMPTY_TR  = { competencia: mesAtual(), obra_origem: '', obra_destino: '', valor: '', motivo: '', nf_referencia: '' }

export default function Faturamento() {
  const [fat, setFat]       = useState([])
  const [obras, setObras]   = useState([])
  const [saldos, setSaldos] = useState({})
  const [loading, setLoading] = useState(true)
  const [busca, setBusca]   = useState('')
  const [filtroComp, setFiltroComp] = useState('todos')
  const [modalFat, setModalFat]     = useState(false)
  const [modalTr, setModalTr]       = useState(false)
  const [formFat, setFormFat]       = useState(EMPTY_FAT)
  const [formTr, setFormTr]         = useState(EMPTY_TR)
  const [saving, setSaving] = useState(false)
  const [erro, setErro]     = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: fatData }, { data: obrasData }, { data: dsData }, { data: trData }] = await Promise.all([
      supabase.schema('geosonda').from('faturamento').select('*').order('competencia', { ascending: false }).order('data_nf', { ascending: false }),
      supabase.schema('geosonda').from('obras').select('nome').order('nome'),
      supabase.schema('geosonda').from('ds').select('obra,valor'),
      supabase.schema('geosonda').from('transferencias').select('*'),
    ])
    setFat(fatData || [])
    setObras(obrasData || [])

    // Calcula saldos para mostrar no modal de transferência
    const sMap = {}
    ;(obrasData || []).forEach(o => { sMap[o.nome] = { ds: 0, fat: 0 } })
    ;(dsData || []).forEach(d => { if (sMap[d.obra]) sMap[d.obra].ds += Number(d.valor) })
    ;(fatData || []).forEach(f => { if (sMap[f.obra]) sMap[f.obra].fat += Number(f.valor) })
    ;(trData || []).forEach(t => {
      if (sMap[t.obra_destino]) sMap[t.obra_destino].fat += Number(t.valor)
      if (sMap[t.obra_origem])  sMap[t.obra_origem].fat  -= Number(t.valor)
    })
    setSaldos(sMap)
    setLoading(false)
  }

  async function salvarFat() {
    if (!formFat.obra || !formFat.valor || !formFat.competencia) { setErro('Preencha obra, competência e valor.'); return }
    setSaving(true); setErro('')
    const { error } = await supabase.schema('geosonda').from('faturamento').insert({
      competencia: formFat.competencia, data_nf: formFat.data_nf || null,
      numero_nf: formFat.numero_nf || null, obra: formFat.obra,
      valor: parseFloat(formFat.valor), observacao: formFat.observacao || null
    })
    if (error) { setErro(error.message); setSaving(false); return }
    setSaving(false); setModalFat(false); setFormFat(EMPTY_FAT); carregar()
  }

  async function salvarTransferencia() {
    const { obra_origem, obra_destino, valor, motivo, nf_referencia, competencia } = formTr
    if (!obra_origem || !obra_destino || !valor || !competencia) { setErro('Preencha todos os campos obrigatórios.'); return }
    if (obra_origem === obra_destino) { setErro('Origem e destino não podem ser iguais.'); return }
    setSaving(true); setErro('')
    const { error } = await supabase.schema('geosonda').from('transferencias').insert({
      competencia, obra_origem, obra_destino,
      valor: parseFloat(valor), motivo: motivo || null, nf_referencia: nf_referencia || null
    })
    if (error) { setErro(error.message); setSaving(false); return }
    setSaving(false); setModalTr(false); setFormTr(EMPTY_TR); carregar()
  }

  async function excluir(id) {
    if (!window.confirm('Remover este lançamento?')) return
    await supabase.schema('geosonda').from('faturamento').delete().eq('id', id)
    carregar()
  }

  const comps = [...new Set(fat.map(f => f.competencia))].sort().reverse()
  const filtradas = fat.filter(f => {
    if (busca && !f.obra.toLowerCase().includes(busca.toLowerCase()) && !(f.numero_nf || '').includes(busca)) return false
    if (filtroComp !== 'todos' && f.competencia !== filtroComp) return false
    return true
  })
  const totalFiltrado = filtradas.reduce((a, f) => a + Number(f.valor), 0)

  const saldoOrigem = saldos[formTr.obra_origem] || null

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Lançamentos</div><div className="stat-value blue">{fat.length}</div></div>
        <div className="stat-card"><div className="stat-label">No filtro</div><div className="stat-value">{filtradas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total filtrado</div><div className="stat-value green">R$ {R(totalFiltrado)}</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2>NF Faturadas</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ width: 200 }} placeholder="Buscar obra, nº NF..." value={busca} onChange={e => setBusca(e.target.value)} />
            <button className="success" onClick={() => { setErro(''); setFormTr(EMPTY_TR); setModalTr(true) }}>↔ Transferir saldo</button>
            <button className="primary" onClick={() => { setErro(''); setFormFat(EMPTY_FAT); setModalFat(true) }}>+ Lançar NF</button>
          </div>
        </div>

        <div className="filter-row" style={{ paddingBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Competência:</span>
          <span className={`chip ${filtroComp === 'todos' ? 'active' : ''}`} onClick={() => setFiltroComp('todos')}>Todas</span>
          {comps.map(c => (
            <span key={c} className={`chip ${filtroComp === c ? 'active' : ''}`} onClick={() => setFiltroComp(c)}>{c}</span>
          ))}
        </div>

        {loading ? <div className="empty">Carregando...</div> : filtradas.length === 0 ? (
          <div className="empty">Nenhum lançamento encontrado. Clique em "+ Lançar NF" para começar.</div>
        ) : (
          <table>
            <thead><tr>
              <th>Comp.</th><th>Data</th><th>Nº NF</th><th>Obra</th><th className="num">Valor</th><th>Observação</th><th></th>
            </tr></thead>
            <tbody>
              {filtradas.map(f => (
                <tr key={f.id}>
                  <td>{f.competencia}</td>
                  <td>{f.data_nf || '—'}</td>
                  <td>{f.numero_nf ? <span className="badge badge-blue">NF {f.numero_nf}</span> : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td><strong>{f.obra}</strong></td>
                  <td className="num" style={{ color: 'var(--green)', fontWeight: 500 }}>R$ {R(f.valor)}</td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text3)' }} title={f.observacao || ''}>{f.observacao || '—'}</td>
                  <td><button className="sm danger" onClick={() => excluir(f.id)}>Remover</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={4} style={{ fontSize: 12, color: 'var(--text2)' }}>{filtradas.length} registros</td>
              <td className="num">R$ {R(totalFiltrado)}</td>
              <td colSpan={2} />
            </tr></tfoot>
          </table>
        )}
      </div>

      {/* MODAL LANÇAR NF */}
      {modalFat && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalFat(false)}>
          <div className="modal">
            <h2>Lançar NF faturada</h2>
            <div className="form-row">
              <div className="field"><label>Competência * (MM/AAAA)</label>
                <input value={formFat.competencia} onChange={e => setFormFat(f => ({ ...f, competencia: e.target.value }))} placeholder="05/2026" />
              </div>
              <div className="field"><label>Data da NF</label>
                <input type="date" value={formFat.data_nf} onChange={e => setFormFat(f => ({ ...f, data_nf: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Nº NF</label>
                <input value={formFat.numero_nf} onChange={e => setFormFat(f => ({ ...f, numero_nf: e.target.value }))} placeholder="Ex: 8274" />
              </div>
              <div className="field"><label>Obra *</label>
                <select value={formFat.obra} onChange={e => setFormFat(f => ({ ...f, obra: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {obras.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Valor (R$) *</label>
              <input type="number" step="0.01" value={formFat.valor} onChange={e => setFormFat(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="field"><label>Observação</label>
              <textarea rows={2} value={formFat.observacao} onChange={e => setFormFat(f => ({ ...f, observacao: e.target.value }))} placeholder="Ex: NF 8106 (174.689,09) — diferença para DIAVISTA" />
            </div>
            {erro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</p>}
            <div className="modal-footer">
              <button onClick={() => setModalFat(false)}>Cancelar</button>
              <button className="primary" onClick={salvarFat} disabled={saving}>{saving ? 'Salvando...' : 'Lançar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TRANSFERÊNCIA */}
      {modalTr && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalTr(false)}>
          <div className="modal">
            <h2>Transferir saldo entre obras</h2>
            <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #FAC775', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
              Use quando o valor faturado de uma obra cobrir o saldo devedor de outra. O sistema registra o débito na origem e o crédito no destino.
            </div>
            <div className="field"><label>Competência * (MM/AAAA)</label>
              <input value={formTr.competencia} onChange={e => setFormTr(f => ({ ...f, competencia: e.target.value }))} placeholder="05/2026" />
            </div>
            <div className="field"><label>Obra de origem (que tem o crédito) *</label>
              <select value={formTr.obra_origem} onChange={e => setFormTr(f => ({ ...f, obra_origem: e.target.value }))}>
                <option value="">Selecione...</option>
                {obras.map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
              </select>
              {saldoOrigem && formTr.obra_origem && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                  Saldo atual: <strong style={{ color: (saldoOrigem.ds - saldoOrigem.fat) > 0 ? 'var(--amber)' : 'var(--red)' }}>
                    R$ {R(saldoOrigem.ds - saldoOrigem.fat)}
                  </strong>
                </div>
              )}
            </div>
            <div className="field"><label>Obra de destino (que recebe o valor) *</label>
              <select value={formTr.obra_destino} onChange={e => setFormTr(f => ({ ...f, obra_destino: e.target.value }))}>
                <option value="">Selecione...</option>
                {obras.filter(o => o.nome !== formTr.obra_origem).map(o => <option key={o.nome} value={o.nome}>{o.nome}</option>)}
              </select>
            </div>
            <div className="field"><label>Valor a transferir (R$) *</label>
              <input type="number" step="0.01" value={formTr.valor} onChange={e => setFormTr(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
            </div>
            <div className="field"><label>NF de referência</label>
              <input value={formTr.nf_referencia} onChange={e => setFormTr(f => ({ ...f, nf_referencia: e.target.value }))} placeholder="Ex: NF 8127" />
            </div>
            <div className="field"><label>Motivo</label>
              <input value={formTr.motivo} onChange={e => setFormTr(f => ({ ...f, motivo: e.target.value }))} placeholder="Ex: Saldo da ESCASKY → TIRASAIOA" />
            </div>
            {erro && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erro}</p>}
            <div className="modal-footer">
              <button onClick={() => setModalTr(false)}>Cancelar</button>
              <button className="primary" onClick={salvarTransferencia} disabled={saving}>{saving ? 'Salvando...' : 'Confirmar transferência'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
