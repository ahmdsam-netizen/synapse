import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { PaperAirplaneIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { cn, getInitials } from '../../lib/utils';

interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  senderEmail?: string;
  content: string;
  createdAt: string;
  instanceId?: string;
}

interface GroupChatProps {
  groupId: string;
  isMember: boolean;
  groupName?: string;
}

export function GroupChat({ groupId, isMember, groupName }: GroupChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll to bottom of message list
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Fetch historical messages via REST
  const fetchMessageHistory = useCallback(async () => {
    if (!groupId || !isMember) return;
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.get<{ data: ChatMessage[]; instanceId: string }>(
        `/chat/groups/${groupId}/messages?limit=50`
      );
      if (res.data?.data) {
        setMessages(res.data.data);
        if (res.data.instanceId) {
          setActiveNode(res.data.instanceId);
        }
        setTimeout(() => scrollToBottom('auto'), 50);
      }
    } catch (err: any) {
      console.error('[Chat History Error]:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [groupId, isMember]);

  // 2. Initialize Socket.IO connection
  useEffect(() => {
    if (!isMember || !groupId) return;

    const token = localStorage.getItem('accessToken') || '';
    if (!token) return;

    // Connect to Gateway on /socket.io (forwarded to chat cluster via consistent hashing)
    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      query: { token, userId: user?.id || '' },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log(`[Socket Connected] Connected to chat cluster via socket ID: ${socket.id}`);

      // Join the specific group/community room
      socket.emit('join_group', { groupId }, (res: any) => {
        if (res?.success) {
          if (res.instanceId) {
            setActiveNode(res.instanceId);
          }
        } else if (res?.error) {
          toast.error(res.error);
        }
      });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log(`[Socket Disconnected] ${reason}`);
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      console.warn('[Socket Connect Error]:', err.message);
    });

    // Handle incoming real-time message
    socket.on('new_message', (newMsg: ChatMessage) => {
      if (newMsg.groupId === groupId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => scrollToBottom('smooth'), 50);
      }
    });

    // Handle typing events from other peers
    socket.on('user_typing', (data: { groupId: string; userId: string; userName: string; isTyping: boolean }) => {
      if (data.groupId === groupId && data.userId !== user?.id) {
        if (data.isTyping) {
          setTypingUser(data.userName);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setTypingUser(null);
          }, 3000);
        } else {
          setTypingUser(null);
        }
      }
    });

    fetchMessageHistory();

    return () => {
      socket.emit('leave_group', { groupId });
      socket.disconnect();
      socketRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [groupId, isMember, user?.id, fetchMessageHistory]);

  // 3. Send Message Handler
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !socketRef.current) return;

    const payload = {
      groupId,
      content: trimmed,
    };

    socketRef.current.emit('send_message', payload, (res: any) => {
      if (res?.error) {
        toast.error(res.error);
      }
    });

    setInputText('');
    socketRef.current.emit('typing', { groupId, isTyping: false });
  };

  // 4. Handle Typing with Debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (socketRef.current) {
      socketRef.current.emit('typing', { groupId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('typing', { groupId, isTyping: false });
      }, 1500);
    }
  };

  // If user is not an active member, restrict access
  if (!isMember) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-12 text-center my-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white border border-gray-200 shadow-2xs">
          <LockClosedIcon className="h-6 w-6 text-gray-500" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Discussion Restricted</h3>
        <p className="mt-1 max-w-sm text-xs text-gray-500">
          You must be an active member of this {groupName ? `"${groupName}"` : 'team'} to view and participate in real-time discussion.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[520px] flex-col rounded-xl border border-gray-200 bg-white">
      {/* Chat Header Bar */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2.5 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-900">
            {groupName ? `${groupName} Chat` : 'Team Discussion'}
          </span>
          {activeNode && (
            <span className="rounded bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">
              node: {activeNode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'
            )}
          />
          <span className="text-[11px] font-medium text-gray-500">
            {isConnected ? 'Real-Time Connected' : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F6F3]">
        {isLoadingHistory ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-gray-500">
            <p className="font-medium text-gray-700">No messages yet</p>
            <p className="mt-0.5">Start the conversation with your team members.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={msg.id}
                className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
              >
                {!isMe && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[11px] font-medium text-gray-600">
                      {msg.senderName}
                    </span>
                    {msg.instanceId && (
                      <span className="text-[9px] font-mono text-gray-400">
                        ({msg.instanceId})
                      </span>
                    )}
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[78%] rounded-lg px-3.5 py-2 text-xs shadow-2xs break-words',
                    isMe
                      ? 'bg-primary-600 text-white rounded-br-xs'
                      : 'bg-white border border-gray-200 text-gray-900 rounded-bl-xs'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  <div
                    className={cn(
                      'mt-1 text-[10px] text-right',
                      isMe ? 'text-primary-100/80' : 'text-gray-400'
                    )}
                  >
                    {timeStr}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Status */}
      {typingUser && (
        <div className="px-4 py-1 text-[11px] text-gray-500 bg-gray-50 border-t border-gray-100 italic">
          {typingUser} is typing...
        </div>
      )}

      {/* Message Input Footer */}
      <form
        onSubmit={handleSendMessage}
        className="flex items-center gap-2 border-t border-gray-200 p-3 bg-white"
      >
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Write a message..."
          maxLength={2000}
          disabled={!isConnected}
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50/50 px-3.5 py-2 text-xs text-gray-900 placeholder-gray-400 focus:border-primary-600 focus:bg-white focus:outline-none transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isConnected || !inputText.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <PaperAirplaneIcon className="h-3.5 w-3.5 mr-1" />
          Send
        </button>
      </form>
    </div>
  );
}
