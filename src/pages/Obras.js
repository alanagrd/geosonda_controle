import React, { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY = { nome: '', tipo: 'direto', cliente: '', observacao: '', saldo_inicial: 0 }

export default function Obras() {
  const [obras, setObras] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.schema('geosonda').from('obras').select('*').order('nome')
    setObras(data || [])
    setLoading(false)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Informe o nome da obra.'); return }
    setSaving(true); setErro('')
    const payload = { nome: form.nome.trim().toUpperCase(), tipo: form.tipo, cliente: form.cliente, observacao: form.observacao, saldo_inicial: parseFloat(form.saldo_inicial) || 0 }
    const { error } = editId
      ? await supabase.schema('geosonda').from('obras').update(payload).eq('id', editId)
      : await supabase.schema('geosonda').from('obras').insert(payload)
    if (error) { setErro(error.message); setSaving(false); return }
    setSaving(false); setModal(false); setForm(EMPTY); setEditId(null); carregar()
  }

  async function excluir(id) {
    if (!window.confirm('Remover esta obra?')) return
    await supabase.schema('geosonda').from('obras').delete().eq('id', id)
    carregar()
  }

  function editar(o) {
    setForm({ nome: o.nome, tipo: o.tipo, cliente: o.cliente || '', observacao: o.observacao || '', saldo_inicial: o.saldo_inicial || 0 })
    setEditId(o.id); setErro(''); setModal(true)
  }

  const filtradas = obras.filter(o => {
    if (busca && !o.nome.toLowerCase().includes(busca.toLowerCase())) return false
    if (filtroTipo !== 'todos' && o.tipo !== filtroTipo) return false
    return true
  })

  const totais = { total: obras.length, direto: obras.filter(o => o.tipo === 'direto').length, geosonda: obras.filter(o => o.tipo === 'geosonda').length }

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Total cadastradas</div><div className="stat-value blue">{totais.total}</div></div>
        <div className="stat-card"><div className="stat-label">Fatura direto</div><div className="stat-value amber">{totais.direto}</div></div>
        <div className="stat-card"><div className="stat-label">C. Custo Geosonda</div><div className="stat-value">{totais.geosonda}</div></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <h2>Obras / Centros de Custo</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ width: 200 }} placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} />
            <button className="primary" onClick={() => { setForm(EMPTY); setEditId(null); setErro(''); setModal(true) }}>+ Nova obra</button>
          </div>
        </div>

        <div className="filter-row" style={{ paddingBottom: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Tipo:</span>
          {[['todos','Todos'],['direto','Direto'],['geosonda','Geosonda']].map(([v, l]) => (
            <span key={v} className={`chip ${filtroTipo === v ? 'active' : ''}`} onClick={() => setFiltroTipo(v)}>{l}</span>
          ))}
        </div>

        {loading ? <div className="empty">Carregando...</div> : filtradas.length === 0 ? (
          <div className="empty">Nenhuma obra encontrada. Clique em "+ Nova obra" para começar.</div>
        ) : (
          <table>
            <thead><tr>
              <th>Nome da obra</th><th>Tipo</th><th>Cliente</th><th>Observação</th><th></th>
            </tr></thead>
            <tbody>
              {filtradas.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.nome}</strong></td>
                  <td>{o.tipo === 'direto'
                    ? <span className="badge badge-amber">Direto</span>
                    : <span className="badge badge-blue">Geosonda</span>}
                  </td>
                  <td>{o.cliente || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>{o.observacao || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="sm" onClick={() => editar(o)}>Editar</button>
                      <button className="sm danger" onClick={() => excluir(o.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>{editId ? 'Editar obra' : 'Nova obra / Centro de custo'}</h2>
            <div className="form-row">
              <div className="field">
                <label>Nome da obra *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: TIRAVISTA" />
              </div>
              <div className="field">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="direto">Fatura direto ao cliente</option>
                  <option value="geosonda">Geosonda (C. Custo interno)</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Cliente</label>
              <input value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Ex: GARDENA" />
            </div>
            <div className="field">
              <label>Saldo devedor inicial (R$) — posição em 31/12/2025</label>
              <input type="number" step="0.01" value={form.saldo_inicial}
                onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div className="field">
              <label>Observação</label>
              <input value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" />
            </div>
            {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{erro}</p>}
            <div className="modal-footer">
              <button onClick={() => setModal(false)}>Cancelar</button>
              <button className="primary" onClick={salvar} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
