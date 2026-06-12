import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Layout from './components/Layout'
import Obras from './pages/Obras'
import DS from './pages/DS'
import Faturamento from './pages/Faturamento'
import Saldos from './pages/Saldos'

function PrivateRoute({ session, children }) {
  if (!session) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)' }}>
        Carregando...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={
          <PrivateRoute session={session}>
            <Layout session={session} />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/saldos" replace />} />
          <Route path="obras"       element={<Obras />} />
          <Route path="ds"          element={<DS />} />
          <Route path="faturamento" element={<Faturamento />} />
          <Route path="saldos"      element={<Saldos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
