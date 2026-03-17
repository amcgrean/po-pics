'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WorkerHeader() {
  const [username, setUsername] = useState('')

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, display_name')
          .eq('id', user.id)
          .single()
        setUsername(profile?.display_name || profile?.username || '')
      }
    }
    loadUser()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 text-white safe-top z-40"
      style={{ backgroundColor: '#006834' }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="text-lg font-bold leading-tight">PO Check-In</h1>
          {username && (
            <p className="text-xs text-white/70 leading-tight">Hi, {username}</p>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="text-white/70 text-sm active:text-white py-1 px-2 -mr-2"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
