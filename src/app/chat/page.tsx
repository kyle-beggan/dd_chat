'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'

type Message = {
  id: string
  created_at: string
  user_name: string
  content: string
}

export default function ChatPage() {
  const [userName, setUserName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Check authentication
    const user = localStorage.getItem('dd_chat_user')
    if (!user) {
      router.push('/')
      return
    }
    setUserName(user)

    // Fetch initial messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('dd_messages')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error fetching messages:', error)
      } else {
        setMessages(data || [])
      }
      setLoading(false)
    }

    fetchMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel('public:dd_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'dd_messages' },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !userName) return

    const messageContent = newMessage.trim()
    setNewMessage('') // optimistically clear input

    const { error } = await supabase
      .from('dd_messages')
      .insert([
        { user_name: userName, content: messageContent }
      ])

    if (error) {
      console.error('Error sending message:', error)
      // Optionally put the message back in the input on error
      setNewMessage(messageContent)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('dd_chat_user')
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-zinc-400">Loading chat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-bold text-xl">D</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">Dynamic Duo Chat</h1>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs text-zinc-400">Online as {userName}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full flex flex-col space-y-6">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center flex-col space-y-4">
            <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center">
              <span className="text-2xl">👋</span>
            </div>
            <p className="text-zinc-500 text-center">No messages yet.<br />Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_name === userName
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <span className="text-xs text-zinc-500 mb-1 ml-1">{msg.user_name}</span>
                )}
                <div
                  className={`max-w-[80%] px-5 py-3 rounded-2xl shadow-sm ${isMe
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/50'
                    }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <span className="text-[10px] text-zinc-600 mt-1 mx-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-zinc-900 border-t border-zinc-800 p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-indigo-600/20"
            >
              Send
            </button>
          </form>
        </div>
      </footer>
    </div>
  )
}
