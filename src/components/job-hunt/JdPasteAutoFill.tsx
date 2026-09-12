// ============================================================================
// PERSONAL OS — Job Description (JD) Auto-Fill Component
// Hybrid Parser UI: Instant local regex extraction + On-Demand Gemini 3.7 Flash
// ============================================================================

import { useState } from 'react';
import { Sparkles, FileText, ChevronDown, ChevronUp, RefreshCw, CheckCircle2 } from 'lucide-react';
import { localHeuristicParse, parseJdWithAi, type ParsedJdResult } from '../../services/jdParser';
import { showToast } from '../Toast';

interface JdPasteAutoFillProps {
  onParsed: (result: ParsedJdResult) => void;
  defaultExpanded?: boolean;
}

export function JdPasteAutoFill({ onParsed, defaultExpanded = false }: JdPasteAutoFillProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [jdText, setJdText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [lastExtractionType, setLastExtractionType] = useState<'LOCAL' | 'AI' | null>(null);

  const handleTextChange = (text: string) => {
    setJdText(text);
    if (!text.trim()) {
      setLastExtractionType(null);
      return;
    }

    // Tier 1: Instant local heuristic parsing (0 API calls, 0 tokens)
    const localResult = localHeuristicParse(text);
    if (localResult.company || localResult.role || localResult.workMode || localResult.minSalary) {
      setLastExtractionType('LOCAL');
      onParsed(localResult);
    }
  };

  const handleAiDeepExtract = async () => {
    if (!jdText.trim()) {
      showToast('Please paste a Job Description first', 'warning');
      return;
    }

    setIsAiLoading(true);
    try {
      const aiResult = await parseJdWithAi(jdText);
      setLastExtractionType('AI');
      onParsed(aiResult);
      showToast('Job details extracted via Gemini AI!', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI parsing failed';
      showToast(message, 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleClear = () => {
    setJdText('');
    setLastExtractionType(null);
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md)',
        background: 'rgba(99, 102, 241, 0.04)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        overflow: 'hidden',
        marginBottom: 8,
      }}
    >
      {/* Header Toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
          background: expanded ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} style={{ color: '#818cf8' }} />
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
            Smart Auto-Fill from Job Description (JD)
          </span>
          {lastExtractionType === 'LOCAL' && (
            <span
              className="badge"
              style={{
                fontSize: 9,
                padding: '2px 6px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.3)',
              }}
            >
              Local Regex Auto-Filled
            </span>
          )}
          {lastExtractionType === 'AI' && (
            <span
              className="badge"
              style={{
                fontSize: 9,
                padding: '2px 6px',
                background: 'rgba(139, 92, 246, 0.15)',
                color: '#c084fc',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CheckCircle2 size={10} /> Gemini AI Parsed
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 11 }}>{expanded ? 'Hide' : 'Paste JD'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expandable Body */}
      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(99, 102, 241, 0.15)' }}>
          <textarea
            className="form-input"
            rows={4}
            value={jdText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Paste raw JD text from LinkedIn, Wellfound, Indeed, or career portal... Instant regex fills basic fields, or tap 'AI Deep Extract' for complete parsing."
            style={{
              width: '100%',
              fontSize: 'var(--text-xs)',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              resize: 'vertical',
              marginBottom: 8,
              background: 'var(--surface-sunken)',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
              <FileText size={12} />
              <span>{jdText.length} chars</span>
              {jdText.length > 0 && <span>• Local parser runs automatically</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {jdText.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={handleClear}
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  Clear
                </button>
              )}

              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={handleAiDeepExtract}
                disabled={isAiLoading || !jdText.trim()}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  gap: 5,
                }}
                title="Use Gemini 3.7 Flash to extract company, role title, normalized salary, and required tech stack"
              >
                {isAiLoading ? (
                  <>
                    <RefreshCw size={11} className="spin" />
                    <span>Extracting...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} />
                    <span>✨ AI Deep Extract</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
