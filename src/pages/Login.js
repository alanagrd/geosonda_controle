import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 20
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--rl)',
        border: '0.5px solid var(--border)', padding: '36px 32px',
        width: '100%', maxWidth: 380
      }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent-bg)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Controle Geosonda</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>AGOS Serviços</p>
        </div>

        <form onSubmit={entrar}>
          <div className="field">
            <label>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoFocus />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
          </div>
          {erro && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>{erro}</p>}
          <button type="submit" className="primary" style={{ width: '100%', padding: '10px 0' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
