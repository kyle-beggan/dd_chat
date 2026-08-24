'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/utils/supabase/client'

type Message = {
  id: string
  created_at: string
  user_name: string
  content: string
  reactions?: Record<string, number>
}

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '😈']

export default function ChatPage() {
  const [userName, setUserName] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
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
        { event: '*', schema: 'public', table: 'dd_messages' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Message
            setMessages((prev) => [...prev, newMsg])
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Message
            setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m))
          }
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

  const handlePointerDown = (msgId: string) => {
    longPressTimer.current = setTimeout(() => {
      setReactionPickerId(msgId)
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }

  const handleAddReaction = async (msg: Message, emoji: string) => {
    const currentReactions = msg.reactions || {}
    const newCount = (currentReactions[emoji] || 0) + 1
    const newReactions = { ...currentReactions, [emoji]: newCount }

    setReactionPickerId(null)

    // Optimistic update
    setMessages((prev) => prev.map(m => m.id === msg.id ? { ...m, reactions: newReactions } : m))

    const { error } = await supabase
      .from('dd_messages')
      .update({ reactions: newReactions })
      .eq('id', msg.id)

    if (error) {
      console.error('Error adding reaction:', error)
    }
  }

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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-indigo-500/20">
              <img src="/unicorn_logo.jpg" alt="Unicorn Logo" className="w-full h-full object-cover" />
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
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}
              >
                {!isMe && (
                  <span className="text-xs text-zinc-500 mb-1 ml-1">{msg.user_name}</span>
                )}
                <div className="relative group">
                  <div
                    onPointerDown={() => handlePointerDown(msg.id)}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onContextMenu={(e) => { e.preventDefault(); handlePointerUp(); }}
                    className={`max-w-[80%] px-5 py-3 rounded-2xl shadow-sm cursor-pointer select-none transition-transform active:scale-[0.98] ${isMe
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/50'
                      }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  
                  {reactionPickerId === msg.id && (
                    <div className={`absolute ${isMe ? 'right-0' : 'left-0'} -top-14 bg-zinc-800 border border-zinc-700 rounded-full px-4 py-2 flex space-x-3 shadow-xl z-20 items-center`}>
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleAddReaction(msg, emoji)}
                          className="hover:scale-125 transition-transform text-xl cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                      <div className="w-[1px] h-6 bg-zinc-700 mx-1"></div>
                      <button onClick={() => setReactionPickerId(null)} className="text-zinc-500 hover:text-white text-sm">✕</button>
                    </div>
                  )}

                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(msg.reactions).map(([emoji, count]) => (
                        <div key={emoji} className="bg-zinc-800 border border-zinc-700 text-[11px] px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-sm">
                          <span>{emoji}</span>
                          <span className="text-zinc-400 font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-zinc-600 mt-1 mx-1">
                  {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
            <textarea
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (newMessage.trim()) handleSendMessage(e as unknown as React.FormEvent)
                }
              }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner resize-none min-h-[50px]"
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
