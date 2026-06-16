import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const navItems = [
  { to: '/saldos',      label: 'Saldos' },
  { to: '/ds',          label: 'DS Importadas' },
  { to: '/faturamento', label: 'Faturamento' },
  { to: '/obras',       label: 'Obras / C. Custo' },
  { to: '/emissao',    label: 'Emissão ND' },
]

export default function Layout({ session }) {
  const navigate = useNavigate()

  async function sair() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border2)',
        padding: '0 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 54, position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Controle Geosonda</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{session?.user?.email}</span>
          <button className="sm" onClick={sair}>Sair</button>
        </div>
      </header>

      <nav style={{
        background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
        padding: '0 24px', display: 'flex', gap: 0
      }}>
        {navItems.map(({ to, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            padding: '11px 16px', fontSize: 13, fontWeight: 500, textDecoration: 'none',
            color: isActive ? 'var(--accent)' : 'var(--text2)',
            borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
            whiteSpace: 'nowrap'
          })}>
            {label}
          </NavLink>
        ))}
      </nav>

      <main style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto', width: '100%', flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}
