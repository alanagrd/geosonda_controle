import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const R = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const mes = parseInt(m), ano = parseInt(a)
  const proximo = mes === 12 ? 1 : mes + 1
  const anoProximo = mes === 12 ? ano + 1 : ano
  return `05/${String(proximo).padStart(2,'0')}/${anoProximo}`
}

async function logoBase64() {
  const url = '/logo_agos.jpg'
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  } catch { return '' }
}

export default function Emissao() {
  const [ds, setDs] = useState([])
  const [obras, setObras] = useState([])
  const [registros, setRegistros] = useState([])
  const [loading, setLoading] = useState(true)
  const [comp, setComp] = useState('')
  const [comps, setComps] = useState([])
  const [proximoNd, setProximoNd] = useState(92)
  const [gerando, setGerando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const [{ data: dsData }, { data: obrasData }, { data: regs }] = await Promise.all([
      supabase.schema('geosonda').from('ds').select('*').order('competencia').order('obra'),
      supabase.schema('geosonda').from('obras').select('nome,tipo').order('nome'),
      supabase.schema('geosonda').from('notas_debito').select('*').order('criado_em', { ascending: false }),
    ])
    setDs(dsData || [])
    setObras(obrasData || [])
    setRegistros(regs || [])
    const cs = [...new Set((dsData || []).map(d => d.competencia))].filter(Boolean).sort().reverse()
    setComps(cs)
    if (cs.length > 0 && !comp) setComp(cs[0])
    const ultimo = (regs || []).filter(r => r.tipo === 'ND').length > 0
      ? Math.max(...(regs || []).filter(r => r.tipo === 'ND').map(n => n.numero || 0))
      : 91
    setProximoNd(ultimo + 1)
    setLoading(false)
  }

  const tipoObra = {}
  obras.forEach(o => { tipoObra[o.nome] = o.tipo })

  const dsFiltradas = ds.filter(d => d.competencia === comp)

  const porObra = {}
  dsFiltradas.forEach(d => {
    if (!porObra[d.obra]) porObra[d.obra] = { nome: d.obra, tipo: tipoObra[d.obra] || 'direto', numeros: [], totalVale: 0, totalOutros: 0, total: 0 }
    porObra[d.obra].numeros.push(d.numero_ds)
    if (d.tipo_ds === 'VALE') porObra[d.obra].totalVale += Number(d.valor)
    else porObra[d.obra].totalOutros += Number(d.valor)
    porObra[d.obra].total += Number(d.valor)
  })

  const todasObras = Object.values(porObra).sort((x, y) => x.nome.localeCompare(y.nome))
  const diretas = todasObras.filter(o => o.tipo === 'direto')
  const geosondas = todasObras.filter(o => o.tipo === 'geosonda')

  const totalDireto = diretas.reduce((s, o) => s + o.total, 0)
  const totalGeosonda = geosondas.reduce((s, o) => s + o.total, 0)
  const totalValeGeosonda = geosondas.reduce((s, o) => s + o.totalVale, 0)
  const totalOutrosGeosonda = geosondas.reduce((s, o) => s + o.totalOutros, 0)
  const totalValeDireto = diretas.reduce((s, o) => s + o.totalVale, 0)
  const totalOutrosDireto = diretas.reduce((s, o) => s + o.totalOutros, 0)
  const totalGeral = totalDireto + totalGeosonda

  async function salvarRegistro(tipo, numero, htmlContent) {
    const { data: existe } = await supabase.schema('geosonda').from('notas_debito')
      .select('id').eq('competencia', comp).eq('tipo', tipo).single()
    if (existe) {
      await supabase.schema('geosonda').from('notas_debito')
        .update({ numero, html_content: htmlContent, valor_total: tipo === 'ND' ? totalGeosonda : totalGeral, criado_em: new Date().toISOString() })
        .eq('id', existe.id)
    } else {
      await supabase.schema('geosonda').from('notas_debito').insert({
        numero, competencia: comp, tipo,
        valor_total: tipo === 'ND' ? totalGeosonda : totalGeral,
        vencimento: vencimento(comp),
        html_content: htmlContent,
        tipos_ds: [],
      })
    }
    carregar()
  }

  async function gerarRelacao() {
    setGerando(true)
    const logo = await logoBase64()
    const [m, anoStr] = (comp || '').split('/')
    const periodo = comp ? `${m}/${String(anoStr).slice(-2)}` : ''
    const hoje = new Date().toLocaleDateString('pt-BR')

    const rowsDireto = diretas.map(o => `
      <tr>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;font-size:10px;color:#666;">${o.numeros.sort((x,y)=>x-y).join(';')}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;font-size:12px;font-weight:600;">${o.nome}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;">${o.totalVale > 0 ? R(o.totalVale) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;">${o.totalOutros !== 0 ? R(o.totalOutros) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;font-weight:700;">${R(o.total)}</td>
      </tr>`).join('')

    const rowsGeo = geosondas.map(o => `
      <tr>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;font-size:10px;color:#666;">${o.numeros.sort((x,y)=>x-y).join(';')}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;font-size:12px;font-weight:600;">${o.nome}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;">${o.totalVale > 0 ? R(o.totalVale) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;">${o.totalOutros !== 0 ? R(o.totalOutros) : '-'}</td>
        <td style="padding:6px 10px;border-bottom:0.5px solid #e0e0dc;text-align:right;font-size:12px;font-weight:700;">${R(o.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relação DS — ${comp}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,Arial,sans-serif;color:#1a1a18;padding:32px;background:#fff;font-size:13px}
  @media print{body{padding:16px}.no-print{display:none}}
  table{width:100%;border-collapse:collapse}
  th{background:#2a2a28;color:#fff;font-size:11px;font-weight:500;padding:8px 10px;text-align:left;text-transform:uppercase;letter-spacing:0.4px}
  th.r{text-align:right}
</style></head>
<body>
<button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
  ${logo ? `<img src="${logo}" style="height:70px;object-fit:contain;" alt="AGOS">` : '<div style="font-size:22px;font-weight:700;letter-spacing:2px;">AGOS</div>'}
  <div style="text-align:right;font-size:11px;color:#666;line-height:1.8;">
    <div style="font-size:12px;color:#1a1a18;">(11) 4123-0831</div>
    <div>www.agosservicos.com.br</div>
    <div>info@agosservicos.com.br</div>
  </div>
</div>

<div style="text-align:center;margin-bottom:20px;">
  <div style="font-size:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Pagamento Salarial</div>
  <div style="width:60px;height:2px;background:#C8B400;margin:0 auto 4px;"></div>
  <div style="width:40px;height:1px;background:#C8B400;margin:0 auto;"></div>
</div>

<div style="font-size:12px;margin-bottom:20px;line-height:2;">
  <div><strong>Referente:</strong> Fornecimento de Mão de Obra</div>
  <div><strong>Período:</strong> ${periodo}</div>
  <div><strong>Empresa:</strong> ${AGOS.nome}</div>
  <div><strong>Vencimento:</strong> ${vencimento(comp)}</div>
</div>

<div style="background:#2a2a28;color:#fff;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0;">
  Valores Faturamento Direto — Cliente
</div>
<table style="border:0.5px solid #e0e0dc;border-top:none;margin-bottom:20px;">
  <thead><tr>
    <th style="width:22%;">DS Nº</th><th>Obra</th>
    <th class="r">Valor Direto</th><th class="r">Valor Direto 2</th><th class="r">Valor Direto 3</th>
  </tr></thead>
  <tbody>${rowsDireto}</tbody>
  <tfoot><tr style="background:#f0f0ee;">
    <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;">Total</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalValeDireto)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalOutrosDireto)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalDireto)}</td>
  </tr></tfoot>
</table>

<div style="background:#2a2a28;color:#fff;padding:8px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:0;">
  Valores Nota de Débito — Faturamento para Geosonda
</div>
<table style="border:0.5px solid #e0e0dc;border-top:none;margin-bottom:20px;">
  <thead><tr>
    <th style="width:22%;">DS</th><th>Obra</th>
    <th class="r">Vale</th><th class="r">Fechamento</th><th class="r">Saldo</th>
  </tr></thead>
  <tbody>${rowsGeo}</tbody>
  <tfoot><tr style="background:#f0f0ee;">
    <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:12px;text-transform:uppercase;">Total</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalValeGeosonda)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalOutrosGeosonda)}</td>
    <td style="padding:8px 10px;text-align:right;font-weight:700;">${R(totalGeosonda)}</td>
  </tr></tfoot>
</table>

<div style="border:1.5px solid #2a2a28;border-radius:6px;padding:14px 16px;">
  <div style="font-size:12px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">Resumo</div>
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
    <span>Faturamento Direto Total:</span><strong>R$ ${R(totalDireto)}</strong>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px;">
    <span>Faturamento Geosonda Total:</span><strong>R$ ${R(totalGeosonda)}</strong>
  </div>
  <div style="border-top:0.5px solid #ccc;padding-top:8px;display:flex;justify-content:space-between;font-size:14px;font-weight:700;">
    <span>Total</span><span>R$ ${R(totalGeral)}</span>
  </div>
</div>

<div style="margin-top:20px;font-size:10px;color:#999;text-align:center;">Documento gerado em ${hoje} — AGOS Serviços</div>
</body></html>`

    await salvarRegistro('RELACAO', 0, html)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relacao_ds_${comp.replace('/','-')}.html`
    link.click()
    setGerando(false)
  }

  async function gerarND() {
    setGerando(true)
    const logo = await logoBase64()
    const [m, anoStr] = (comp || '').split('/')
    const meses = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    const mesNome = meses[parseInt(m)] || ''
    const hoje = new Date().toLocaleDateString('pt-BR')

    const rows = geosondas.map(o => `
      <tr>
        <td style="padding:5px 10px;border:0.5px solid #ccc;font-size:11px;font-weight:600;">${o.nome}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;">R$ ${o.totalVale > 0 ? R(o.totalVale) : '-'}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;">${o.totalOutros !== 0 ? `R$ ${R(o.totalOutros)}` : '-'}</td>
        <td style="padding:5px 10px;border:0.5px solid #ccc;text-align:right;font-size:11px;font-weight:700;">R$ ${R(o.total)}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Nota de Débito Nº ${proximoNd} — ${mesNome}/${anoStr}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#1a1a18;padding:28px;background:#fff;font-size:12px}
  @media print{body{padding:14px}.no-print{display:none}}
  table{width:100%;border-collapse:collapse}
</style></head>
<body>
<button class="no-print" onclick="window.print()" style="margin-bottom:20px;padding:8px 20px;background:#185FA5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
  ${logo ? `<img src="${logo}" style="height:65px;object-fit:contain;" alt="AGOS">` : '<div style="font-size:22px;font-weight:700;letter-spacing:2px;">AGOS</div>'}
  <div style="text-align:right;font-size:11px;line-height:1.7;">
    <div style="font-weight:600;">${AGOS.nome}</div>
    <div>CNPJ: ${AGOS.cnpj}</div>
    <div>${AGOS.endereco}</div>
    <div>${AGOS.cidade}</div>
    <div>TELEFONE: ${AGOS.telefone}</div>
  </div>
</div>

<table style="margin-bottom:14px;border:1.5px solid #1a1a18;">
  <tr>
    <td style="padding:10px 14px;border-right:1px solid #1a1a18;width:35%;">
      <div style="font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Nota de Débito</div>
    </td>
    <td style="padding:10px 14px;border-right:1px solid #1a1a18;text-align:center;width:20%;">
      <div style="font-size:14px;font-weight:700;">${mesNome}-${String(anoStr).slice(-2)}</div>
    </td>
    <td style="padding:6px 12px;border-right:1px solid #1a1a18;width:22%;text-align:center;">
      <div style="font-size:10px;color:#666;margin-bottom:2px;">VALOR R$</div>
      <div style="font-size:13px;font-weight:700;">R$ ${R(totalGeosonda)}</div>
    </td>
    <td style="padding:6px 12px;width:23%;text-align:center;">
      <div style="font-size:10px;color:#666;margin-bottom:2px;">VENCIMENTO</div>
      <div style="font-size:13px;font-weight:700;">${vencimento(comp)}</div>
    </td>
  </tr>
  <tr style="border-top:1px solid #1a1a18;">
    <td style="padding:6px 14px;border-right:1px solid #1a1a18;font-size:10px;color:#666;text-transform:uppercase;">ND Nº</td>
    <td colspan="3" style="padding:6px 14px;font-size:22px;font-weight:700;text-align:center;">${proximoNd}</td>
  </tr>
</table>

<table style="margin-bottom:12px;border:0.5px solid #ccc;">
  <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;width:130px;color:#666;font-weight:500;">Valor por extenso</td><td colspan="3" style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;">R$ ${R(totalGeosonda)}</td></tr>
  <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;font-weight:500;">Forma de pagamento</td><td colspan="3" style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;font-weight:700;">CRÉDITO NA C/C .....</td></tr>
  <tr><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;font-weight:500;">Nome do sacado</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;font-weight:700;">${GEOSONDA.nome}</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;color:#666;font-weight:500;">CNPJ Nº:</td><td style="padding:5px 10px;font-size:11px;border-bottom:0.5px solid #ccc;">${GEOSONDA.cnpj}</td></tr>
  <tr><td style="padding:5px 10px;font-size:11px;color:#666;font-weight:500;">Endereço</td><td colspan="3" style="padding:5px 10px;font-size:11px;">${GEOSONDA.endereco}</td></tr>
</table>

<div style="font-size:11px;margin-bottom:10px;font-weight:500;line-height:1.5;">
  NOTA DE DÉBITO REFERENTE REEMBOLSO DA TAXA DE SERVIÇO CONFORME LISTAGEM ABAIXO, NO PERÍODO DO MÊS EM REFERÊNCIA.
</div>

<table style="margin-bottom:16px;border:0.5px solid #ccc;">
  <thead><tr style="background:#f0f0ee;">
    <th style="padding:7px 10px;text-align:left;font-size:11px;border:0.5px solid #ccc;font-weight:600;">Obra</th>
    <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;font-weight:600;">1ª Quinzena</th>
    <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;font-weight:600;">2ª Quinzena</th>
    <th style="padding:7px 10px;text-align:right;font-size:11px;border:0.5px solid #ccc;font-weight:600;">Saldo</th>
  </tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr style="background:#f0f0ee;">
    <td style="padding:7px 10px;border:0.5px solid #ccc;font-weight:700;font-size:12px;">Total</td>
    <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;">R$ ${R(totalValeGeosonda)}</td>
    <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;">R$ ${R(totalOutrosGeosonda)}</td>
    <td style="padding:7px 10px;border:0.5px solid #ccc;text-align:right;font-weight:700;">R$ ${R(totalGeosonda)}</td>
  </tr></tfoot>
</table>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px;">
  <div style="font-size:11px;line-height:1.9;border:0.5px solid #ccc;padding:10px 12px;">
    <div style="font-weight:700;margin-bottom:6px;text-transform:uppercase;font-size:10px;color:#666;">Dados para depósito:</div>
    <div>${AGOS.banco} SÃO BERNARDO, ${hoje}</div>
    <div>AG: ${AGOS.agencia}</div>
    <div>C/C: ${AGOS.conta}</div>
    <div style="margin-top:4px;">${AGOS.nome}</div>
    <div>${AGOS.cnpj}</div>
  </div>
  <div style="display:flex;flex-direction:column;justify-content:space-between;">
    <p style="font-size:10px;color:#666;line-height:1.6;">Ficando convencionado que a quitação somente ocasionará após a constatação do crédito em nossa conta corrente conforme descrito acima.</p>
    <div style="border-top:0.5px solid #1a1a18;padding-top:8px;text-align:center;font-weight:700;font-size:12px;">${GEOSONDA.nome}</div>
  </div>
</div>

<div style="margin-top:20px;font-size:10px;color:#999;text-align:center;">Documento gerado em ${hoje} — AGOS Serviços</div>
</body></html>`

    await salvarRegistro('ND', proximoNd, html)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `nota_debito_${proximoNd}_${comp.replace('/','-')}.html`
    link.click()
    setGerando(false)
  }

  async function visualizar(reg) {
    const blob = new Blob([reg.html_content], { type: 'text/html;charset=utf-8' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  async function excluirRegistro(id) {
    if (!window.confirm('Excluir este registro? Você poderá reemitir novamente.')) return
    await supabase.schema('geosonda').from('notas_debito').delete().eq('id', id)
    carregar()
  }

  const regComp = registros.filter(r => r.competencia === comp)

  return (
    <>
      <div className="summary-grid">
        <div className="stat-card"><div className="stat-label">Obras Direto</div><div className="stat-value blue">{diretas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Direto</div><div className="stat-value">{R(totalDireto)}</div></div>
        <div className="stat-card"><div className="stat-label">Obras Geosonda</div><div className="stat-value blue">{geosondas.length}</div></div>
        <div className="stat-card"><div className="stat-label">Total Geosonda (ND)</div><div className="stat-value amber">R$ {R(totalGeosonda)}</div></div>
        <div className="stat-card"><div className="stat-label">Total Geral</div><div className="stat-value green">R$ {R(totalGeral)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar"><h2>Emissão de Relação e Nota de Débito</h2></div>
        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Competência</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {comps.map(c => (
                <span key={c} className={`chip ${comp === c ? 'active' : ''}`} onClick={() => setComp(c)}>{c}</span>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)', marginBottom: 8 }}>Próximo Nº ND</div>
            <input type="number" value={proximoNd} onChange={e => setProximoNd(parseInt(e.target.value))} style={{ width: 90 }} />
          </div>
          {regComp.length > 0 && (
            <div style={{ background: 'var(--amber-bg)', border: '0.5px solid #FAC775', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--amber)' }}>
              ⚠️ Já existe registro para {comp}. Gerar novamente irá substituir o anterior.
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={gerarRelacao} className="success" disabled={gerando || !comp}>
              {gerando ? 'Gerando...' : '↓ Gerar Relação de DS'}
            </button>
            <button onClick={gerarND} className="primary" disabled={gerando || !comp}>
              {gerando ? 'Gerando...' : `↓ Gerar Nota de Débito Nº ${proximoNd}`}
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar"><h2>Preview — {comp}</h2></div>
        {loading ? <div className="empty">Carregando...</div> : todasObras.length === 0 ? (
          <div className="empty">Nenhuma DS encontrada para esta competência.</div>
        ) : (
          <table>
            <thead><tr>
              <th>Nº DS</th><th>Obra</th><th>Tipo</th>
              <th className="num">Vale (1ª Q.)</th><th className="num">Fechamento/Outros</th><th className="num">Total</th>
            </tr></thead>
            <tbody>
              {todasObras.map(o => (
                <tr key={o.nome}>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{o.numeros.sort((x,y)=>x-y).join(';')}</td>
                  <td><strong>{o.nome}</strong></td>
                  <td>{o.tipo === 'direto'
                    ? <span className="badge badge-amber">Direto</span>
                    : <span className="badge badge-blue">Geosonda</span>}
                  </td>
                  <td className="num">{o.totalVale > 0 ? `R$ ${R(o.totalVale)}` : <span style={{color:'var(--text3)'}}>—</span>}</td>
                  <td className="num">{o.totalOutros !== 0 ? `R$ ${R(o.totalOutros)}` : <span style={{color:'var(--text3)'}}>—</span>}</td>
                  <td className="num" style={{ fontWeight: 600 }}>R$ {R(o.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td colSpan={3} style={{ fontSize: 12, color: 'var(--text2)' }}>Total</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(diretas.reduce((s,o)=>s+o.totalVale,0) + geosondas.reduce((s,o)=>s+o.totalVale,0))}</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(diretas.reduce((s,o)=>s+o.totalOutros,0) + geosondas.reduce((s,o)=>s+o.totalOutros,0))}</td>
              <td className="num" style={{ fontWeight: 600 }}>R$ {R(totalGeral)}</td>
            </tr></tfoot>
          </table>
        )}
      </div>

      {registros.length > 0 && (
        <div className="card">
          <div className="toolbar"><h2>Documentos Emitidos</h2></div>
          <table>
            <thead><tr>
              <th>Tipo</th><th>Nº</th><th>Competência</th><th>Vencimento</th><th className="num">Valor</th><th>Emitido em</th><th></th>
            </tr></thead>
            <tbody>
              {registros.map(r => (
                <tr key={r.id}>
                  <td><span className={`badge ${r.tipo === 'ND' ? 'badge-blue' : 'badge-green'}`}>{r.tipo === 'ND' ? 'Nota de Débito' : 'Relação DS'}</span></td>
                  <td>{r.numero > 0 ? <strong>Nº {r.numero}</strong> : '—'}</td>
                  <td>{r.competencia}</td>
                  <td>{r.vencimento || '—'}</td>
                  <td className="num" style={{ color: 'var(--green)', fontWeight: 500 }}>R$ {R(r.valor_total)}</td>
                  <td style={{ fontSize: 12, color: 'var(--text3)' }}>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="sm" onClick={() => visualizar(r)}>Visualizar</button>
                      <button className="sm danger" onClick={() => excluirRegistro(r.id)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
