import React, { useEffect, useState, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Corrige caracteres corrompidos vindos do Excel (encoding Windows-1252)
function limparTexto(str) {
  if (!str) return ''
  let s = str.trim().toUpperCase()
  s = s.replace(/MANUTEN[ÇC][ÃA]O+/g, 'MANUTENÇÃO')
  s = s.replace(/CONSOLIDA[ÇC][ÃA]O+/g, 'CONSOLIDAÇÃO')
  s = s.replace(/PRODU[ÇC][ÃA]O+/g, 'PRODUÇÃO')
  s = s.replace(/[^\x20-\x7EÀ-ÿ]/g, '')
  return s.trim()
}

// COMP da planilha vem como número serial Excel (ex: 46143) ou data DD/MM/YYYY — converte para MM/AAAA
function serialParaComp(val) {
  if (!val) return ''
  const s = String(val).trim()
  // Se já é string no formato MM/AAAA
  if (/^\d{2}\/\d{4}$/.test(s)) return s
  // Se é data no formato DD/MM/YYYY (Excel com formatação de data personalizada)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return `${s.slice(3, 5)}/${s.slice(6)}`
  // Se é número serial Excel (dias desde 1900-01-01)
  const num = Number(val)
  if (!isNaN(num) && num > 40000) {
    const date = new Date((num - 25569) * 86400 * 1000)
    const m = String(date.getUTCMonth() + 1).padStart(2, '0')
    const a = date.getUTCFullYear()
    return `${m}/${a}`
  }
  return s
}

export default function DS() {
  const [ds, setDs] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroComp, setFiltroComp] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [importando, setImportando] = useState(false)
  const [preview, setPreview] = useState(null) // { rows, comp }
  const [erro, setErro] = useState('')
  const [confirmImport, setConfirmImport] = useState(false)
  const [obrasNaocadastradas, setObrasNaocastradas] = useState([])
  const [modalNovas, setModalNovas] = useState(false)
  const [tiposNovas, setTiposNovas] = useState({})
  const [salvandoNovas, setSalvandoNovas] = useState(false)
  const [modalEdit, setModalEdit] = useState(false)
  const [formEdit, setFormEdit] = useState(null)
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [erroEdit, setErroEdit] = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.schema('geosonda').from('ds')
      .select('*').order('competencia', { ascending: false }).order('numero_ds')
    setDs(data || [])
    setLoading(false)
  }

  // Lê o arquivo Excel e gera preview
  function lerArquivo(file) {
    setErro('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', codepage: 65001 })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        // Mapeia colunas (case-insensitive, trim)
        const mapped = rows.map(row => {
          const get = (...keys) => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.trim().toUpperCase() === k.toUpperCase())
              if (found !== undefined) return row[found]
            }
            return ''
          }
          const comp = serialParaComp(get('COMP', 'COMPETENCIA', 'COMPETÊNCIA'))
          const nds = get('Nº DA DS', 'N∫ DA DS', 'NUM DS', 'NUMERO DS', 'NR DS', 'DS')
          const obra = limparTexto((get('NOME C.CUSTO COMP', 'NOME C.CUSTO', 'OBRA', 'C.CUSTO NOME', 'NOME C CUSTO') || '').toString())
          const valor = parseFloat(get('VALOR DA DS', 'VALOR') || 0)
          const tipo_ds = (get('TIPO') || '').toString().trim().toUpperCase()
          const filial = parseInt(get('FILIAL') || 0)
          const cod_cliente = parseInt(get('COD CLIENTE', 'COD. CLIENTE') || 0)
          const nome_cliente = (get('NOME') || '').toString().trim()
          const cod_ccusto = parseInt(get('C.CUSTO', 'COD C.CUSTO') || 0)
          return { comp, numero_ds: parseInt(nds) || 0, obra, valor, tipo_ds, filial, cod_cliente, nome_cliente, cod_ccusto }
        }).filter(r => r.numero_ds && r.obra && r.valor)

        if (mapped.length === 0) { setErro('Nenhuma linha válida encontrada. Verifique o formato da planilha.'); return }

        // Detecta competência predominante
        const comps = mapped.map(r => r.comp).filter(Boolean)
        const compFreq = {}
        comps.forEach(c => { compFreq[c] = (compFreq[c] || 0) + 1 })
        const compPrincipal = Object.entries(compFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || ''

        setPreview({ rows: mapped, comp: compPrincipal })
        setConfirmImport(true)
      } catch (err) {
        setErro('Erro ao ler o arquivo: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function confirmarImportacao() {
    if (!preview) return
    setImportando(true); setErro('')

    // Verifica se já existe DS com esses números nessa competência
    const numeros = preview.rows.map(r => r.numero_ds)
    const { data: existentes } = await supabase.schema('geosonda').from('ds')
      .select('numero_ds').in('numero_ds', numeros)

    const existentesSet = new Set((existentes || []).map(e => e.numero_ds))
    const novas = preview.rows.filter(r => !existentesSet.has(r.numero_ds))
    const duplicadas = preview.rows.length - novas.length

    if (novas.length === 0) {
      setErro(`Todas as ${preview.rows.length} DS já foram importadas anteriormente.`)
      setImportando(false); return
    }

    const payload = novas.map(r => ({
      competencia: r.comp || preview.comp,
      numero_ds: r.numero_ds,
      obra: r.obra,
      valor: r.valor,
      tipo_ds: r.tipo_ds,
      filial: r.filial || null,
      cod_cliente: r.cod_cliente || null,
      nome_cliente: r.nome_cliente || null,
      cod_ccusto: r.cod_ccusto || null,
    }))

    const { error } = await supabase.schema('geosonda').from('ds').insert(payload)
    if (error) { setErro('Erro ao importar: ' + error.message); setImportando(false); return }

    setImportando(false); setConfirmImport(false); setPreview(null)
    alert(`✅ ${novas.length} DS importadas com sucesso!${duplicadas > 0 ? `\n⚠️ ${duplicadas} DS ignoradas (já existiam).` : ''}`)

    // Verifica obras novas não cadastradas
    const { data: obrasExistentes } = await supabase.schema('geosonda').from('obras').select('nome')
    const nomesExistentes = new Set((obrasExistentes || []).map(o => o.nome))
    const nomesImportados = [...new Set(novas.map(r => r.obra))]
    const novasSemCadastro = nomesImportados.filter(n => !nomesExistentes.has(n))
    if (novasSemCadastro.length > 0) {
      const tiposIniciais = {}
      novasSemCadastro.forEach(n => { tiposIniciais[n] = 'direto' })
      setObrasNaocastradas(novasSemCadastro)
      setTiposNovas(tiposIniciais)
      setModalNovas(true)
    }

    carregar()
  }

  function abrirEditar(d) {
    setFormEdit({
      id: d.id,
      competencia: d.competencia || '',
      numero_ds: d.numero_ds || '',
      obra: d.obra || '',
      valor: d.valor || '',
      tipo_ds: d.tipo_ds || '',
      filial: d.filial || '',
      cod_cliente: d.cod_cliente || '',
      nome_cliente: d.nome_cliente || '',
      cod_ccusto: d.cod_ccusto || '',
    })
    setErroEdit('')
    setModalEdit(true)
  }

  async function salvarEdicao() {
    if (!formEdit.obra || !formEdit.valor || !formEdit.competencia) { setErroEdit('Preencha obra, competência e valor.'); return }
    setSalvandoEdit(true); setErroEdit('')
    const { error } = await supabase.schema('geosonda').from('ds').update({
      competencia: formEdit.competencia,
      numero_ds: parseInt(formEdit.numero_ds) || 0,
      obra: formEdit.obra.toUpperCase().trim(),
      valor: parseFloat(formEdit.valor),
      tipo_ds: formEdit.tipo_ds.toUpperCase().trim(),
      filial: parseInt(formEdit.filial) || null,
      cod_cliente: parseInt(formEdit.cod_cliente) || null,
      nome_cliente: formEdit.nome_cliente || null,
      cod_ccusto: parseInt(formEdit.cod_ccusto) || null,
    }).eq('id', formEdit.id)
    if (error) { setErroEdit(error.message); setSalvandoEdit(false); return }
    setSalvandoEdit(false); setModalEdit(false); setFormEdit(null); carregar()
  }

  async function salvarObrasNovas() {
    setSalvandoNovas(true)
    const payload = obrasNaocadastradas.map(nome => ({ nome, tipo: tiposNovas[nome] || 'direto' }))
    await supabase.schema('geosonda').from('obras').insert(payload)
    setSalvandoNovas(false)
    setModalNovas(false)
    setObrasNaocastradas([])
  }

  async function excluirDS(id) {
    if (!window.confirm('Remover esta DS?')) return
    await supabase.schema('geosonda').from('ds').delete().eq('id', id)
    carregar()
  }

  const comps = [...new Set(ds.map(d => d.competencia))].sort().reverse()

  const filtradas = ds.filter(d => {
    if (busca && !d.obra.toLowerCase().includes(busca.toLowerCase()) && !String(d.numero_ds).includes(busca)) return false
    if (filtroComp !== 'todos' && d.competencia !== filtroComp) return false
    if (filtroTipo !== 'todos' && d.tipo_ds !== filtroTipo) return false
    return true
  })

  const tiposDsUnicos = [...new Set(ds.map(d => d.tipo_ds))].filter(Boolean).sort()
  const totalValor = filtradas.reduce((a, d) => a + Number(d.valor), 0)
  const totalDs = ds.length

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Total DS</div><div className="stat-value blue">{totalDs}</div></div>
        <div className="stat-card"><div className="stat-label">No filtro atual</div><div className="stat-value">{filtradas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Valor filtrado</div><div className="stat-value amber">R$ {R(totalValor)}</div></div>
        <div className="stat-card"><div className="stat-label">Competências</div><div className="stat-value">{comps.length}</div></div>
      </div>

      {/* IMPORTAÇÃO */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar"><h2>Importar planilha de DS</h2></div>
        <div style={{ padding: 16 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
            border: '1.5px dashed var(--border2)', borderRadius: 'var(--r)',
            background: 'var(--surface2)', cursor: 'pointer'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>Selecionar arquivo Excel (.xlsx)</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                Colunas: FILIAL · COD CLIENTE · NOME · Nº DA DS · VALOR DA DS · C.CUSTO · NOME C.CUSTO COMP · COMP · TIPO
              </div>
            </div>
            <input type="file" accept=".xlsx,.xlsm,.xls" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) lerArquivo(e.target.files[0]); e.target.value = '' }} />
          </label>
          {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
        </div>
      </div>

      {/* LISTA DS */}
      <div className="card">
        <div className="toolbar">
          <h2>DS lançadas</h2>
          <input style={{ width: 200 }} placeholder="Buscar obra ou nº DS..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div className="filter-row" style={{ paddingBottom: 10, gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Competência:</span>
          <span className={`chip ${filtroComp === 'todos' ? 'active' : ''}`} onClick={() => setFiltroComp('todos')}>Todas</span>
          {comps.map(c => (
            <span key={c} className={`chip ${filtroComp === c ? 'active' : ''}`} onClick={() => setFiltroComp(c)}>{c}</span>
          ))}
          {tiposDsUnicos.length > 1 && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 8 }}>Tipo:</span>
              <span className={`chip ${filtroTipo === 'todos' ? 'active' : ''}`} onClick={() => setFiltroTipo('todos')}>Todos</span>
              {tiposDsUnicos.map(t => (
                <span key={t} className={`chip ${filtroTipo === t ? 'active' : ''}`} onClick={() => setFiltroTipo(t)}>{t}</span>
              ))}
            </>
          )}
        </div>

        {loading ? <div className="empty">Carregando...</div> : filtradas.length === 0 ? (
          <div className="empty">Nenhuma DS encontrada. Importe uma planilha para começar.</div>
        ) : (
          <table>
            <thead><tr>
              <th>Comp.</th><th>Nº DS</th><th>Obra / C. Custo</th><th>Cliente</th><th>Tipo DS</th><th className="num">Valor</th><th></th>
            </tr></thead>
            <tbody>
              {filtradas.map(d => (
                <tr key={d.id}>
                  <td>{d.competencia}</td>
                  <td><strong>{d.numero_ds}</strong></td>
                  <td>{d.obra}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{d.nome_cliente || '—'}</td>
                  <td><span className="badge badge-gray">{d.tipo_ds}</span></td>
                  <td className="num">R$ {R(d.valor)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="sm" onClick={() => abrirEditar(d)}>Editar</button>
                      <button className="sm danger" onClick={() => excluirDS(d.id)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={5} style={{ fontSize: 12, color: 'var(--text2)' }}>{filtradas.length} registros</td>
              <td className="num">R$ {R(totalValor)}</td>
              <td />
            </tr></tfoot>
          </table>
        )}
      </div>

      {/* MODAL CONFIRMAÇÃO IMPORTAÇÃO */}
      {confirmImport && preview && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setConfirmImport(false)}>
          <div className="modal">
            <h2>Confirmar importação</h2>
            <div style={{ background: 'var(--accent-bg)', borderRadius: 'var(--r)', padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              <strong>{preview.rows.length} DS encontradas</strong> — Competência detectada: <strong>{preview.comp}</strong>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              DS já importadas anteriormente serão ignoradas automaticamente.
            </p>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '0.5px solid var(--border)', borderRadius: 'var(--r)' }}>
              <table>
                <thead><tr><th>Nº DS</th><th>Obra</th><th>Tipo</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {preview.rows.slice(0, 50).map((r, i) => (
                    <tr key={i}>
                      <td>{r.numero_ds}</td>
                      <td>{r.obra}</td>
                      <td><span className="badge badge-gray">{r.tipo_ds}</span></td>
                      <td className="num">R$ {R(r.valor)}</td>
                    </tr>
                  ))}
                  {preview.rows.length > 50 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>... e mais {preview.rows.length - 50} registros</td></tr>}
                </tbody>
              </table>
            </div>
            {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{erro}</p>}
            <div className="modal-footer">
              <button onClick={() => { setConfirmImport(false); setPreview(null) }}>Cancelar</button>
              <button className="primary" onClick={confirmarImportacao} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${preview.rows.length} DS`}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalEdit && formEdit && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalEdit(false)}>
          <div className="modal">
            <h2>Editar DS</h2>
            <div className="form-row">
              <div className="field"><label>Competência (MM/AAAA)</label>
                <input value={formEdit.competencia} onChange={e => setFormEdit(f => ({ ...f, competencia: e.target.value }))} placeholder="05/2026" />
              </div>
              <div className="field"><label>Nº DS</label>
                <input type="number" value={formEdit.numero_ds} onChange={e => setFormEdit(f => ({ ...f, numero_ds: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Obra / C. Custo</label>
                <input value={formEdit.obra} onChange={e => setFormEdit(f => ({ ...f, obra: e.target.value }))} />
              </div>
              <div className="field"><label>Tipo DS</label>
                <select value={formEdit.tipo_ds} onChange={e => setFormEdit(f => ({ ...f, tipo_ds: e.target.value }))}>
                  <option value="VALE">VALE</option>
                  <option value="FECHAMENTO">FECHAMENTO</option>
                  <option value="COMPLEMENTO">COMPLEMENTO</option>
                  <option value="DISPENSA">DISPENSA</option>
                  <option value="PLR">PLR</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Valor (R$)</label>
              <input type="number" step="0.01" value={formEdit.valor} onChange={e => setFormEdit(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="field"><label>Nome Cliente</label>
                <input value={formEdit.nome_cliente || ''} onChange={e => setFormEdit(f => ({ ...f, nome_cliente: e.target.value }))} />
              </div>
              <div className="field"><label>Filial</label>
                <input type="number" value={formEdit.filial || ''} onChange={e => setFormEdit(f => ({ ...f, filial: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="field"><label>Cód. Cliente</label>
                <input type="number" value={formEdit.cod_cliente || ''} onChange={e => setFormEdit(f => ({ ...f, cod_cliente: e.target.value }))} />
              </div>
              <div className="field"><label>Cód. C. Custo</label>
                <input type="number" value={formEdit.cod_ccusto || ''} onChange={e => setFormEdit(f => ({ ...f, cod_ccusto: e.target.value }))} />
              </div>
            </div>
            {erroEdit && <p style={{ color: 'var(--red)', fontSize: 13 }}>{erroEdit}</p>}
            <div className="modal-footer">
              <button onClick={() => setModalEdit(false)}>Cancelar</button>
              <button className="primary" onClick={salvarEdicao} disabled={salvandoEdit}>
                {salvandoEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalNovas && (
        <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setModalNovas(false)}>
          <div className="modal">
            <h2>Obras novas detectadas</h2>
            <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #FAC775', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--amber)' }}>
              {obrasNaocadastradas.length} obra(s) importadas ainda não estão cadastradas. Defina o tipo de cada uma:
            </div>
            {obrasNaocadastradas.map(nome => (
              <div key={nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                <strong style={{ fontSize: 13 }}>{nome}</strong>
                <select value={tiposNovas[nome] || 'direto'} onChange={e => setTiposNovas(t => ({ ...t, [nome]: e.target.value }))} style={{ width: 200 }}>
                  <option value="direto">Fatura direto ao cliente</option>
                  <option value="geosonda">Geosonda (C. Custo interno)</option>
                </select>
              </div>
            ))}
            <div className="modal-footer">
              <button onClick={() => setModalNovas(false)}>Cadastrar depois</button>
              <button className="primary" onClick={salvarObrasNovas} disabled={salvandoNovas}>
                {salvandoNovas ? 'Salvando...' : 'Cadastrar obras'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
