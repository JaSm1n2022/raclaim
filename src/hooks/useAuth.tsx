import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

interface User {
  id: string
  email: string
  name?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('🔐 Initializing auth...')
    console.log('📍 Current URL:', window.location.href)

    let safetyTimeout: NodeJS.Timeout
    let isMounted = true

    // Check if this is a magic link callback
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hasAuthTokens = hashParams.has('access_token') || hashParams.has('refresh_token')

    if (hasAuthTokens) {
      console.log('🔗 Magic link detected - will be processed by onAuthStateChange')
    }

    // Listen for auth changes
    console.log('👂 Setting up auth listener...')
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return

      console.log('🔄 Auth state changed:', event, {
        session: !!session,
        user: session?.user?.email
      })

      // On page refresh, SIGNED_IN fires first but session isn't ready yet
      // Wait for INITIAL_SESSION which fires when session is fully loaded
      // Only exception: if this is a magic link (hasAuthTokens), process SIGNED_IN
      if (event === 'SIGNED_IN' && !hasAuthTokens) {
        console.log('⏭️ Skipping early SIGNED_IN - waiting for INITIAL_SESSION')
        return
      }

      if (session?.user) {
        console.log('👤 User session established:', session.user.email)
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0]
        })

        console.log('✅ Auth complete')
        if (safetyTimeout) clearTimeout(safetyTimeout)
        setLoading(false)
      } else {
        console.log('👋 No session - user logged out')
        setUser(null)
        if (safetyTimeout) clearTimeout(safetyTimeout)
        setLoading(false)
      }

      if (event === 'SIGNED_IN') {
        console.log('✅ User signed in successfully')
        // Clean up URL hash after successful sign in
        if (window.location.hash) {
          console.log('🧹 Cleaning up URL hash')
          window.history.replaceState(null, '', window.location.pathname)
        }
      }
    })

    console.log('✅ Auth listener set up')

    // If this is a magic link, wait for onAuthStateChange to handle it
    // Otherwise, manually trigger session check to ensure onAuthStateChange fires
    if (!hasAuthTokens) {
      console.log('🔍 No magic link - triggering session check...')
      // Call getSession() to ensure onAuthStateChange fires with INITIAL_SESSION
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('📦 Manual session check result:', !!session, session?.user?.email)
        // Don't set state here - let onAuthStateChange handle it
      }).catch(err => {
        console.error('❌ Error in manual session check:', err)
      })
    } else {
      console.log('⏳ Waiting for magic link to be processed by onAuthStateChange...')
    }

    // Set a safety timeout
    safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Auth timeout after 10 seconds')
      setLoading(false)
    }, 10000)

    return () => {
      console.log('🧹 Cleaning up auth subscription')
      isMounted = false
      if (safetyTimeout) clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`
      console.log('📧 Sending magic link to:', email)
      console.log('🔗 Redirect URL:', redirectUrl)

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      })

      if (error) throw error

      toast.success('Check your email for the magic link!')
    } catch (error: any) {
      console.error('❌ Error signing in:', error)
      toast.error(error.message || 'Failed to send magic link')
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      toast.success('Signed out successfully')
    } catch (error: any) {
      console.error('Error signing out:', error)
      toast.error(error.message || 'Failed to sign out')
      throw error
    }
  }

  const value = {
    user,
    loading,
    signInWithEmail,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
