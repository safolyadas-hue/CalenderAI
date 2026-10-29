import { useState } from 'react';
import { Bot, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { CoPilotMessage, EventContext } from '../types/event';
import { askAICoPilot, type EngineSource } from '../services/aiClient';

interface AICoPilotPanelProps {
  context: EventContext;
  efficiencyScore: number;
  daysUntilEvent: number;
  onSourceUpdate?: (source: EngineSource) => void;
}

const QUICK_PROMPTS = [
  'Cut budget by 15% safely',
  'Outdoor weather & logistics plan',
  'Urgent critical path tasks',
  'Suggest menu for dietary tags',
];

export const AICoPilotPanel: React.FC<AICoPilotPanelProps> = ({
  context,
  efficiencyScore,
  daysUntilEvent,
  onSourceUpdate,
}) => {
  const [messages, setMessages] = useState<CoPilotMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I'm your CalenderAI Co-Pilot. I'm actively analyzing "${context.title}" (${context.eventType}) with an efficiency score of ${efficiencyScore}/100 and ${daysUntilEvent} days to event day. How can I assist you with budgets, timelines, vendors, or ideas?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPrompt = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isLoading) return;

    const userMsg: CoPilotMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: cleanText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const response = await askAICoPilot(context, cleanText, { efficiencyScore, daysUntilEvent });
      if (response.source) {
        onSourceUpdate?.(response.source);
      }
      const assistantMsg: CoPilotMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        suggestedActions: response.suggestedActions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: CoPilotMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Unable to process query at this time. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendPrompt(inputPrompt);
  };

  return (
    <section aria-labelledby="copilot-heading" className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header & Security Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 id="copilot-heading" className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            AI Event Co-Pilot
          </h2>
          <p className="text-xs text-slate-500">
            Real-time planning advisor with contextual awareness of your current live event parameters.
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold self-start sm:self-auto">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          <span>Protected by XSS & Prompt-Injection Guard</span>
        </div>
      </div>

      {/* Quick Prompt Chips */}
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
          Quick Planning Prompts:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendPrompt(prompt)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200 transition-colors disabled:opacity-50"
            >
              {prompt} →
            </button>
          ))}
        </div>
      </div>

      {/* Chat Messages Log */}
      <div
        role="log"
        aria-live="polite"
        className="h-80 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-sm">
                AI
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200 shadow-sm'
              }`}
            >
              <div className="whitespace-pre-line">{msg.content}</div>

              {/* Suggested Actions if any */}
              {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Suggested Actions:</span>
                  <div className="flex flex-wrap gap-1">
                    {msg.suggestedActions.map((act, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendPrompt(act)}
                        className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className={`text-[10px] block mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {msg.timestamp}
              </span>
            </div>

            {msg.role === 'user' && (
              <div className="h-7 w-7 rounded-lg bg-slate-700 text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-sm">
                You
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium pl-2">
            <Sparkles className="h-3.5 w-3.5 animate-spin text-indigo-600" />
            <span>Co-Pilot is formulating recommendation...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="copilot-input" className="sr-only">
          Ask AI Co-Pilot
        </label>
        <input
          id="copilot-input"
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask anything: 'Optimize venue budget', 'What permits do I need?', 'Rain contingency'..."
          disabled={isLoading}
          className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputPrompt.trim()}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <span>Send</span>
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
};
