import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageShell, { PageShellContent } from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useViewMode } from '@/context/ViewModeContext';
import { isClinician, getHeaderCopy, getCardClassName } from '@/lib/viewMode';
import { getSession } from '@/lib/sessionStore';
import { getThreads, addMessage, getThreadById } from '@/lib/messageStore';
import type { MessageThread, Message, MessageSender } from '@/types/messages';
import { MessageSquare, Send, User, Building2 } from 'lucide-react';
import { addMessageSentEvent } from '@/lib/timelineStore';

function MessagesPage() {
  const { viewMode } = useViewMode();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [session, setSession] = useState(getSession());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const previousThreadId = useRef<string | null>(null);

  // Load threads
  useEffect(() => {
    const loadThreads = () => {
      const currentSession = getSession();
      setSession(currentSession);
      const patientThreads = getThreads(currentSession.activePatientId);
      setThreads(patientThreads);
      
      // Select first thread if none selected
      if (!selectedThreadId && patientThreads.length > 0) {
        setSelectedThreadId(patientThreads[0].id);
      }
    };

    loadThreads();

    // Listen for changes
    const handleChange = () => loadThreads();
    window.addEventListener('session-changed', handleChange);
    window.addEventListener('messages-changed', handleChange);

    return () => {
      window.removeEventListener('session-changed', handleChange);
      window.removeEventListener('messages-changed', handleChange);
    };
  }, [selectedThreadId]);

  // Scroll to bottom when messages change (but not on initial page load)
  useEffect(() => {
    // Skip scroll on initial mount to prevent page jumping
    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousThreadId.current = selectedThreadId;
      return;
    }
    
    // Only scroll if user explicitly selected a different thread or sent a message
    if (selectedThreadId !== previousThreadId.current) {
      previousThreadId.current = selectedThreadId;
      // Use a small delay to ensure DOM is updated
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [selectedThreadId, threads]);

  const selectedThread = selectedThreadId ? getThreadById(selectedThreadId) : null;
  const activePatient = session.patients.find((p) => p.id === session.activePatientId);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId || !newMessage.trim()) return;

    const sender: MessageSender = session.user.role as MessageSender;
    const thread = getThreadById(selectedThreadId);
    
    addMessage(selectedThreadId, sender, newMessage.trim());
    
    // Add timeline event
    if (thread) {
      addMessageSentEvent(session.activePatientId, thread.subject, sender);
    }
    
    setNewMessage('');
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getLastMessage = (thread: MessageThread): Message | null => {
    if (thread.messages.length === 0) return null;
    return thread.messages[thread.messages.length - 1];
  };

  const getSenderIcon = (sender: MessageSender) => {
    if (sender === 'VNS') {
      return <Building2 className="h-4 w-4" />;
    }
    return <User className="h-4 w-4" />;
  };

  const getSenderLabel = (sender: MessageSender) => {
    if (sender === 'VNS') return 'VNS Provider Services';
    if (sender === session.user.role) return 'You';
    return sender;
  };

  const patientName = activePatient?.fullName || "patient";
  const isClinicianMode = isClinician(viewMode);
  const headerCopy = getHeaderCopy("messages", patientName, viewMode);
  const cardClass = getCardClassName(viewMode);

  return (
    <PageShell>
      <PageHeader
        title={headerCopy.title}
        eyebrow={headerCopy.eyebrow}
        subtitle={headerCopy.subtitle}
        viewMode={viewMode}
      />

      <PageShellContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 h-[calc(100vh-340px)] min-h-[500px]">
        {/* Thread List */}
        <Card className={`lg:col-span-1 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
          <CardHeader className="p-6 pb-4">
            <div className="mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Message Threads</span>
            </div>
            <CardTitle className="text-xl font-semibold text-gray-900">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <MessageSquare className="h-12 w-12 mb-4 text-gray-300" />
                <p className="text-base font-medium text-gray-900 mb-1">No messages yet</p>
                <p className="text-sm text-gray-500 max-w-xs">
                  Request a document from your Care Plan to start a secure conversation with your care team.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {threads.map((thread) => {
                  const lastMsg = getLastMessage(thread);
                  const isSelected = selectedThreadId === thread.id;
                  
                  return (
                    <button
                      key={thread.id}
                      onClick={() => setSelectedThreadId(thread.id)}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className={`font-medium text-sm truncate ${isSelected ? 'text-blue-900' : ''}`}>
                          {thread.subject}
                        </h3>
                        {lastMsg && (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTime(lastMsg.createdAt)}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-sm text-muted-foreground truncate">
                          {lastMsg.sender === session.user.role ? 'You: ' : `${lastMsg.sender}: `}
                          {lastMsg.body}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            thread.status === 'Open'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {thread.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation View */}
        <Card className={`lg:col-span-2 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-200 ${cardClass}`}>
          {selectedThread ? (
            <>
              <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedThread.participants.join(', ')}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      selectedThread.status === 'Open'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedThread.status}
                  </span>
                </div>
              </CardHeader>
              
              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedThread.messages.map((message) => {
                  const isOwnMessage = message.sender === session.user.role;
                  const isVNS = message.sender === 'VNS';
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          isOwnMessage
                            ? 'bg-blue-600 text-white'
                            : isVNS
                            ? 'bg-gray-100 text-gray-900'
                            : 'bg-green-100 text-green-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getSenderIcon(message.sender)}
                          <span className="text-xs font-medium">
                            {getSenderLabel(message.sender)}
                          </span>
                          <span className={`text-xs ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}`}>
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </CardContent>

              {/* Message Composer */}
              {selectedThread.status === 'Open' && (
                <div className="border-t p-4">
                  {/* Sending As Indicator */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">Sending as:</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      session.user.role === 'Caregiver'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {session.user.role}
                    </span>
                    {session.user.role === 'Caregiver' && activePatient && (
                      <span className="text-xs text-muted-foreground">
                        (on behalf of {activePatient.fullName})
                      </span>
                    )}
                  </div>
                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 min-h-[60px] max-h-[120px] p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                    <Button type="submit" disabled={!newMessage.trim()} className="self-end">
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </form>
                </div>
              )}

              {selectedThread.status === 'Closed' && (
                <div className="border-t p-4 bg-gray-50 text-center text-sm text-muted-foreground">
                  This conversation is closed. Start a new request from your Care Plan if needed.
                </div>
              )}
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center text-center px-6">
                <MessageSquare className="h-16 w-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium text-gray-900 mb-1">Select a conversation</p>
                <p className="text-sm text-gray-500 max-w-sm">
                  Choose a thread from the list to view your secure messages with your care team.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
        </div>
      </PageShellContent>
    </PageShell>
  );
}

export default MessagesPage;
