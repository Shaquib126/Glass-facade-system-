import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MessageCircle, X, Send, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your AI assistant for the Glass Facade system. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Create a chat instance ref so we maintain history
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen && !chatRef.current && !setupError) {
      try {
        const ai = getAIClient();
        chatRef.current = ai.chats.create({
          model: 'gemini-3.1-flash-lite-preview',
          config: {
            systemInstruction: 'You are a helpful, professional AI assistant for the Glass Facade Attendance and Site Management system. Your role is to help admins and workers understand how to use the dashboard, manage site geofences, and review attendance logs. Keep your answers concise and highly relevant.',
          }
        });
      } catch (err: any) {
        console.error('AI Initialization error:', err);
        setSetupError(err.message || 'Failed to initialize AI.');
        setMessages(prev => [...prev, { role: 'model', text: 'Sorry, the AI is currently unavailable due to missing API keys. Please configure GEMINI_API_KEY.' }]);
      }
    }
  }, [isOpen, setupError]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (setupError || !chatRef.current) {
      setMessages(prev => [...prev, { role: 'model', text: 'Chat unavailable. Please check your system configuration.' }]);
      setInput('');
      return;
    }

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const streamResponse = await chatRef.current.sendMessageStream({ message: userText });
      
      let fullResponse = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      for await (const chunk of streamResponse) {
        fullResponse += chunk.text;
        setMessages(prev => {
          const newM = [...prev];
          newM[newM.length - 1].text = fullResponse;
          return newM;
        });
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent text-black rounded-full shadow-xl flex items-center justify-center hover:bg-accent/90 transition-transform hover:scale-105 z-50"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <Card className={`fixed bottom-6 right-6 w-80 md:w-96 shadow-2xl z-50 flex flex-col transition-all duration-300 ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      <CardHeader className="py-3 px-4 border-b border-card-border flex flex-row items-center justify-between bg-card-bg cursor-pointer round-t-xl" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-accent" />
          <CardTitle className="text-sm font-semibold m-0">AI Assistant</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-bg rounded text-text-s hover:text-text-p transition-colors" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button className="p-1 hover:bg-bg rounded text-text-s hover:text-red-400 transition-colors" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      
      {!isMinimized && (
        <>
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/50 flex flex-col scroll-smooth">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-accent text-black rounded-br-sm' : 'bg-card-bg border border-card-border text-text-p rounded-bl-sm'}`}>
                  {msg.text || <Loader2 className="w-4 h-4 animate-spin opacity-50" />}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-3 border-t border-card-border bg-card-bg rounded-b-xl">
            <form onSubmit={handleSend} className="flex w-full gap-2">
              <Input 
                type="text" 
                placeholder="Ask me anything..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 h-9 text-sm"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="h-9 w-9 bg-accent hover:bg-accent/90 text-black flex-shrink-0" disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </Card>
  );
}
