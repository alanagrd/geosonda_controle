import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const LOGO_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAYABgAAD/4QCMRXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABgAAAAAQAAAGAAAAABAAOgAQADAAAAAQABAACgAgAEAAAAAQAAAfSgAwAEAAAAAQAAAfQAAAAA/+0AOFBob3Rvc2hvcCAzLjAAOEJJTQQEAAAAAAAAOEJJTQQlAAAAAAAQ1B2M2Y8AsgTpgAmY7PhCfv/AABEIAfQB9AMBEQACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/3QAEAD//2gAMAwEAAhEDEQA/AP7+KACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoA//9D+/igAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKAP//R/v4oAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgAoAKACgD//9L+/igAoAKA'

const TIPOS_DS = ['VALE', 'FECHAMENTO', 'COMPLEMENTO', 'DISPENSA', 'PLR']

const AGOS = {
  nome: 'AGOS SERVIÇOS AUXILIARES DA CONSTRUÇÃO',
  cnpj: '04.113.492/0001-82',
  endereco: 'AV. CORAL, 234 SL 5 – JARDIM DO MAR',
  cidade: 'SÃO BERNARDO DO CAMPO - SP',
  telefone: '(0xx11) 4123-0831',
  banco: 'ITAÚ', agencia: '6255', conta: '07434-3'
}

const GEOSONDA = {
  nome: 'GEOSONDA S/A',
  cnpj: '60.681.749/0001-73',
  endereco: 'RUA MARTINIANO LEMOS LEITE, 680 – VILA JOVINA – COTIA-SP – 06705-110'
}

function vencimento(comp) {
  if (!comp) return ''
  const [m, a] = comp.split('/')
  if (!m || !a) return ''
  const mes = parseInt(m)
  const ano = parseInt(a)
  const proximo = mes === 12 ? 1 : mes + 1
  const anoProximo = mes === 12 ? ano + 1 : ano
  return `05/${String(proximo).padStart(2,'0')}/${anoProximo}`
}

function extenso(valor) {
  return `R$ ${R(valor)}`
}

export default function Emissao() {
  const [ds, setDs] = useState([])
  const [nds, setNds] = useState([])
  const [loading, setLoading] = useState(true)
  const [comp, setComp] = useState('')
  const [comps, setComps] = useState([])
  const [tiposSelecionados, setTiposSelecionados] = useState(['VALE', 'FECHAMENTO'])
  const [proximoNd, setProximoNd] = useState(92)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: dsData }, { data: ndsData }] = await Promise.all([
      supabase.schema('geosonda').from('ds').select('*').order('competencia').order('obra'),
      supabase.schema('geosonda').from('notas_debito').select('*').order('numero', { ascending: false }),
    ])
    setDs(dsData || [])
    setNds(ndsData || [])
    const cs = [...new Set((dsData || []).map(d => d.competencia))].filter(Boolean).sort().reverse()
    setComps(cs)
    if (cs.length > 0) setComp(cs[0])
    const ultimo = (ndsData || []).length > 0 ? Math.max(...(ndsData || []).map(n => n.numero)) : 91
    setProximoNd(ultimo + 1)
    setLoading(false)
  }

  function toggleTipo(tipo) {
    setTiposSelecionados(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    )
  }

  const dsFiltradas = ds.filter(d =>
    d.competencia === comp && tiposSelecionados.includes(d.tipo_ds)
  )

  const porObra = {}
  dsFiltradas.forEach(d => {
    if (!porObra[d.obra]) porObra[d.obra] = { nome: d.obra, ds: [], totalVale: 0, totalOutros: 0, total: 0, numeros: [] }
    porObra[d.obra].ds.push(d)
    porObra[d.obra].numeros.push(d.numero_ds)
    if (d.tipo_ds === 'VALE') porObra[d.obra].totalVale += Number(d.valor)
    else porObra[d.obra].totalOutros += Number(d.valor)
    porObra[d.obra].total += Number(d.valor)
  })

  const obras = Object.values(porObra).sort((a, b) => a.nome.localeCompare(b.nome))

  const totalGeral = obras.reduce((a, o) => a + o.total, 0)
  const totalValeGeral = obras.reduce((a, o) => a + o.totalVale, 0)
  const totalOutrosGeral = obras.reduce((a, o) => a + o.totalOutros, 0)

  async function gerarND() {
    if (!comp) return
    const { error } = await supabase.schema('geosonda').from('notas_debito').insert({
      numero: proximoNd,
      competencia: comp,
      tipos_ds: tiposSelecionados,
      valor_total: totalGeral,
      vencimento: vencimento(comp),
    })
    if (error) { alert('Erro ao salvar: ' + error.message); return }
    gerarHTMLND()
    setProximoNd(n => n + 1)
    carregar()
  }

  function gerarHTMLRelacao() {
    const hoje = new Date().toLocaleDateString('pt-BR')
    const [m, ano] = (comp || '').split('/')
    const periodo = comp ? `${m}/${String(ano).slice(-2)}` : ''

    const rowsDireto = obras.map(o => `
      <tr>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e5e5e0;font-size:11px;">${o.numeros.join(';')}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e5e5e0;font-size:12px;font-weight:500;">${o.nome}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e5e5e0;text-align:right;font-size:12px;">${o.totalVale > 0 ? R(o.totalVale) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e5e5e0;text-align:right;font-size:12px;">${o.totalOutros !== 0 ? R(o.totalOutros) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e5e5e0;text-align:right;font-size:12px;font-weight:600;">${R(o.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relação de DS — ${comp}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,Arial,sans-serif; color:#1a1a18; padding:32px; background:#fff; font-size:13px; }
  @media print { body { padding:16px; } .no-print { display:none; } }
  table { width:100%; border-collapse:collapse; }
  th { background:#2a2a28; color:#fff; font-size:11px; font-weight:500; padding:8px 10px; text-align:left; text-transform:uppercase; letter-spacing:0.4px; }
  th.num { text-align:right; }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:24px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
    <img src="${LOGO_BASE64}" style="height:70px;object-fit:contain;" alt="AGOS">
    <div style="text-align:right;font-size:11px;color:#666;line-height:1.8;">
      <div style="font-size:12px;color:#1a1a18;">(11) 4123-0831</div>
      <div>www.agosservicos.com.br</div>
      <div>info@agosservicos.com.br</div>
    </div>
  </div>

  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">Pagamento Salarial</div>
    <div style="width:60px;height:2px;background:#C8B400;margin:0 auto;"></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:20px;font-size:12px;">
    <div><strong>Referente:</strong> Fornecimento de Mão de Obra</div>
    <div></div>
    <div><strong>Período:</strong> ${periodo}</div>
    <div></div>
    <div><strong>Empresa:</strong> ${AGOS.nome}</div>
    <div></div>
    <div><strong>Vencimento:</strong> ${vencimento(comp).replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$1/$2/$3')}</div>
  </div>

  <div style="margin-bottom:20px;">
    <div style="background:#2a2a28;color:#fff;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;border-radius:4px 4px 0 0;margin-bottom:0;">
      Valores Faturamento Direto — Cliente
    </div>
    <table style="border:0.5px solid #e5e5e0;border-top:none;">
      <thead><tr>
        <th style="width:25%;">DS Nº</th>
        <th>Obra</th>
        <th class="num">Valor Direto</th>
        <th class="num">Valor Direto 2</th>
        <th class="num">Valor Direto 3</th>
      </tr></thead>
      <tbody>${rowsDireto}</tbody>
      <tfoot>
        <tr style="background:#f0f0ee;">
          <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;">Total</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalValeGeral)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalOutrosGeral)}</td>
          <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalGeral)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div style="border:1px solid #2a2a28;border-radius:6px;padding:14px 16px;margin-top:16px;">
    <div style="font-size:13px;font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Resumo</div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
      <span>Faturamento Direto Total:</span>
      <strong>R$ ${R(totalGeral)}</strong>
    </div>
    <div style="border-top:0.5px solid #e5e5e0;margin:8px 0;"></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;">
      <span>Total</span>
      <span>R$ ${R(totalGeral)}</span>
    </div>
  </div>

  <div style="margin-top:24px;font-size:10px;color:#999;text-align:center;">
    Documento gerado em ${hoje} — AGOS Serviços
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `relacao_ds_${comp.replace('/','-')}_${new Date().toISOString().slice(0,10)}.html`
    a.click()
  }

  function gerarHTMLND() {
    const hoje = new Date().toLocaleDateString('pt-BR')
    const [m, ano] = (comp || '').split('/')
    const mesNome = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][parseInt(m)] || ''

    const rows = obras.map(o => `
      <tr>
        <td style="padding:5px 10px;border:0.5px solid #ccc;font-size:11px;font-weight:500;">${o.nome}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;">R$ ${o.totalVale > 0 ? R(o.totalVale) : '-'}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;">R$ ${o.totalOutros !== 0 ? R(o.totalOutros) : '-'}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;font-weight:600;">R$ ${R(o.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Nota de Débito Nº ${proximoNd} — ${mesNome}/${ano}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; color:#1a1a18; padding:28px; background:#fff; font-size:12px; }
  @media print { body { padding:14px; } .no-print { display:none; } }
  table { width:100%; border-collapse:collapse; }
</style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
    <img src="${LOGO_BASE64}" style="height:65px;object-fit:contain;" alt="AGOS">
    <div style="text-align:right;font-size:11px;line-height:1.7;">
      <div style="font-weight:600;">${AGOS.nome}</div>
      <div>CNPJ: ${AGOS.cnpj}</div>
      <div>${AGOS.endereco}</div>
      <div>${AGOS.cidade}</div>
      <div>TELEFONE: ${AGOS.telefone}</div>
    </div>
  </div>

  <table style="margin-bottom:16px;border:1.5px solid #1a1a18;">
    <tr>
      <td style="padding:8px 12px;border-right:1px solid #1a1a18;width:30%;">
        <div style="font-size:18px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Nota de Débito</div>
      </td>
      <td style="padding:8px 12px;border-right:1px solid #1a1a18;text-align:center;width:20%;">
        <div style="font-size:14px;font-weight:700;">${mesNome}-${String(ano).slice(-2)}</div>
      </td>
      <td style="padding:4px 12px;border-right:1px solid #1a1a18;width:15%;text-align:center;">
        <div style="font-size:10px;color:#666;">VALOR R$</div>
        <div style="font-size:13px;font-weight:700;">R$ ${R(totalGeral)}</div>
      </td>
      <td style="padding:4px 12px;width:15%;text-align:center;">
        <div style="font-size:10px;color:#666;">VENCIMENTO</div>
        <div style="font-size:13px;font-weight:700;">${vencimento(comp)}</div>
      </td>
    </tr>
    <tr style="border-top:1px solid #1a1a18;">
      <td style="padding:6px 12px;border-right:1px solid #1a1a18;font-size:10px;color:#666;">ND Nº</td>
      <td colspan="3" style="padding:6px 12px;font-size:18px;font-weight:700;text-align:center;">${proximoNd}</td>
    </tr>
  </table>

  <table style="margin-bottom:12px;border:0.5px solid #ccc;">
    <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;width:120px;color:#666;">Valor por extenso</td><td colspan="3" style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;">${extenso(totalGeral)}</td></tr>
    <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;">Forma de pagamento</td><td colspan="3" style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;font-weight:600;">CRÉDITO NA C/C .....</td></tr>
    <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;">Nome do sacado</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;font-weight:600;">${GEOSONDA.nome}</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;">CNPJ Nº:</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;">${GEOSONDA.cnpj}</td></tr>
    <tr><td style="padding:5px 10px;font-size:11px;color:#666;">Endereço</td><td colspan="3" style="padding:5px 10px;font-size:11px;">${GEOSONDA.endereco}</td></tr>
  </table>

  <div style="font-size:11px;margin-bottom:10px;font-weight:500;">
    NOTA DE DÉBITO REFERENTE REEMBOLSO DA TAXA DE SERVIÇO CONFORME LISTAGEM ABAIXO, NO PERÍODO DO MÊS EM REFERÊNCIA.
  </div>

  <table style="margin-bottom:16px;border:0.5px solid #ccc;">
    <thead>
      <tr style="background:#f0f0ee;">
        <th style="padding:7px 10px;text-align:left;font-size:11px;border:0.5px solid #ccc;">Obra</th>
        <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;">1ª Quinzena</th>
        <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;">2ª Quinzena</th>
        <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;">Saldo</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr style="background:#f0f0ee;">
        <td style="padding:7px 10px;border:0.5px solid #ccc;font-weight:700;font-size:11px;">Total</td>
        <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;font-size:11px;">R$ ${R(totalValeGeral)}</td>
        <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;font-size:11px;">R$ ${R(totalOutrosGeral)}</td>
        <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;font-size:11px;">R$ ${R(totalGeral)}</td>
      </tr>
    </tfoot>
  </table>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;">
    <div style="font-size:11px;line-height:1.8;border:0.5px solid #ccc;padding:10px;">
      <div style="font-weight:600;margin-bottom:6px;">Dados para depósito:</div>
      <div>${AGOS.banco} SÃO BERNARDO</div>
      <div>AG: ${AGOS.agencia}</div>
      <div>C/C: ${AGOS.conta}</div>
      <div>${AGOS.nome}</div>
      <div>${AGOS.cnpj}</div>
    </div>
    <div style="display:flex;flex-direction:column;justify-content:space-between;font-size:11px;">
      <div style="text-align:right;color:#666;">SÃO BERNARDO, ${hoje}</div>
      <div>
        <p style="font-size:10px;color:#666;margin-bottom:20px;">Ficando convencionado que a quitação somente ocasionará após a constatação do crédito em nossa conta corrente conforme descrito acima.</p>
        <div style="border-top:0.5px solid #1a1a18;padding-top:6px;text-align:center;font-weight:600;">${GEOSONDA.nome}</div>
      </div>
    </div>
  </div>

  <div style="margin-top:20px;font-size:10px;color:#999;text-align:center;">
    Documento gerado em ${hoje} — AGOS Serviços
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nota_debito_${proximoNd}_${comp.replace('/','-')}.html`
    a.click()
  }

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Obras no filtro</div><div className="stat-value blue">{obras.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total 1ª Quinzena (Vale)</div><div className="stat-value">{R(totalValeGeral)}</div></div>
        <div className="stat-card"><div className="stat-label">Total 2ª Quinzena e outros</div><div className="stat-value">{R(totalOutrosGeral)}</div></div>
        <div className="stat-card"><div className="stat-label">Total geral</div><div className="stat-value amber">R$ {R(totalGeral)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar">
          <h2>Emissão de Relação e Nota de Débito</h2>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Competência</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {comps.map(c => (
                <span key={c} className={`chip ${comp === c ? 'active' : ''}`} onClick={() => setComp(c)}>{c}</span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Tipos de DS a incluir</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TIPOS_DS.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={tiposSelecionados.includes(t)} onChange={() => toggleTipo(t)} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Próximo Nº ND</div>
            <input type="number" value={proximoNd} onChange={e => setProximoNd(parseInt(e.target.value))} style={{ width: 80 }} />
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
          <button onClick={gerarHTMLRelacao} className="success">↓ Gerar Relação de DS</button>
          <button onClick={gerarND} className="primary">↓ Gerar Nota de Débito Nº {proximoNd}</button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar"><h2>Preview — {comp} · {tiposSelecionados.join(', ')}</h2></div>
        {loading ? <div className="empty">Carregando...</div> : obras.length === 0 ? (
          <div className="empty">Nenhuma DS encontrada para os filtros selecionados.</div>
        ) : (
          <table>
            <thead><tr>
              <th>Nº DS</th><th>Obra</th><th className="num">1ª Quinzena (Vale)</th><th className="num">2ª Quinzena e outros</th><th className="num">Total</th>
            </tr></thead>
            <tbody>
              {obras.map(o => (
                <tr key={o.nome}>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{o.numeros.join(';')}</td>
                  <td><strong>{o.nome}</strong></td>
                  <td className="num">{o.totalVale > 0 ? `R$ ${R(o.totalVale)}` : <span style={{color:'var(--text3)'}}>—</span>}</td>
                  <td className="num">{o.totalOutros !== 0 ? `R$ ${R(o.totalOutros)}` : <span style={{color:'var(--text3)'}}>—</span>}</td>
                  <td className="num" style={{ fontWeight: 600 }}>R$ {R(o.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={2} style={{ fontSize: 12, color: 'var(--text2)' }}>Total</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(totalValeGeral)}</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(totalOutrosGeral)}</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(totalGeral)}</td>
            </tr></tfoot>
          </table>
        )}
      </div>

      {nds.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="toolbar"><h2>Notas de Débito Emitidas</h2></div>
          <table>
            <thead><tr><th>Nº ND</th><th>Competência</th><th>Vencimento</th><th>Tipos DS</th><th className="num">Valor Total</th><th>Emitida em</th></tr></thead>
            <tbody>
              {nds.map(n => (
                <tr key={n.id}>
                  <td><strong>ND {n.numero}</strong></td>
                  <td>{n.competencia}</td>
                  <td>{n.vencimento}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{(n.tipos_ds || []).join(', ')}</td>
                  <td className="num" style={{ color: 'var(--green)', fontWeight: 500 }}>R$ {R(n.valor_total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(n.criado_em).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
