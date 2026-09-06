import React, { useEffect, useMemo, useState } from 'react';
import type { AssessmentAnswer, AssessmentDeck, InterviewFeedback, InterviewMessage, RehearsalSetup } from '../types';
import { generateAssessmentDeck, evaluateAssessment } from '../services/apiClient';
import { assessmentAnswersToTranscript, assessmentProgress } from '../lib/assessmentSession';
import { useTheme } from '../contexts/ThemeContext';
import { useIsMobile } from './theme/hooks';

interface Props {
  setup: RehearsalSetup;
  onComplete: (feedback: InterviewFeedback, transcript: InterviewMessage[]) => void;
  onCancel: () => void;
}

const AssessmentRunner: React.FC<Props> = ({ setup, onComplete, onCancel }) => {
  const { theme } = useTheme();
  const mobile = useIsMobile();
  const transcriptTheme = theme === 'transcript';
  const [deck, setDeck] = useState<AssessmentDeck | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswer[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmBlanks, setConfirmBlanks] = useState(false);
  const [generationAttempt, setGenerationAttempt] = useState(0);

  const palette = transcriptTheme
    ? { canvas: '#e9e6dc', surface: '#fbfaf6', ink: '#1c1b18', muted: '#6d685c', signal: '#b3402a', rule: '#b9b4a5', soft: '#efe9d5' }
    : { canvas: '#101208', surface: '#171a0d', ink: '#f2f4e4', muted: '#a9ad91', signal: '#d4f222', rule: '#3a3e24', soft: '#252a12' };
  const font = transcriptTheme ? "'IBM Plex Mono', ui-monospace, monospace" : "'Space Grotesk', sans-serif";
  const borderStyle = transcriptTheme ? 'dashed' : 'solid';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDeck(null);
    setAnswers([]);
    setIndex(0);
    generateAssessmentDeck(setup)
      .then(result => {
        if (!cancelled) setDeck(result);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'The practice deck could not be generated.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [setup, generationAttempt]);

  const current = deck?.questions[index];
  const answer = current ? answers.find(item => item.questionId === current.id) : undefined;
  const progress = useMemo(
    () => deck ? assessmentProgress(deck, answers) : { answered: 0, total: setup.targetQuestionCount, percent: 0 },
    [deck, answers, setup.targetQuestionCount],
  );

  const setAnswer = (questionId: string, value: string | string[]) => {
    setConfirmBlanks(false);
    setAnswers(existing => {
      const next = existing.filter(item => item.questionId !== questionId);
      return [...next, { questionId, value }];
    });
  };

  const submit = async () => {
    if (!deck || submitting) return;
    const blanks = progress.total - progress.answered;
    if (blanks > 0 && !confirmBlanks) {
      setConfirmBlanks(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const feedback = await evaluateAssessment(setup, deck, answers);
      onComplete(feedback, assessmentAnswersToTranscript(deck, answers));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The assessment could not be evaluated.');
      setSubmitting(false);
      setConfirmBlanks(false);
    }
  };

  const controlStyle: React.CSSProperties = {
    border: `1px ${borderStyle} ${palette.rule}`,
    background: palette.surface,
    color: palette.ink,
    font: 'inherit',
    minHeight: 46,
  };

  if (loading || !deck || !current) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: palette.canvas, color: palette.ink, fontFamily: font }}>
        <div style={{ width: 'min(620px, 100%)', padding: mobile ? 24 : 42, background: palette.surface, border: `1px ${borderStyle} ${palette.rule}` }}>
          <button type="button" onClick={onCancel} style={{ border: 0, background: 'none', color: palette.muted, font: 'inherit', cursor: 'pointer', padding: '8px 0' }}>Back to rehearsals</button>
          <h1 style={{ margin: '24px 0 12px', fontSize: mobile ? 30 : 42 }}>{setup.title}</h1>
          {loading ? (
            <p style={{ color: palette.muted, lineHeight: 1.6 }}>Building a fresh {setup.targetQuestionCount}-question practice deck…</p>
          ) : (
            <>
              <p role="alert" style={{ color: palette.signal, lineHeight: 1.6 }}>{error || 'The practice deck did not contain usable questions.'}</p>
              <button type="button" onClick={() => setGenerationAttempt(value => value + 1)} style={{ ...controlStyle, padding: '0 20px', cursor: 'pointer' }}>Generate another deck</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const blanks = progress.total - progress.answered;
  return (
    <div style={{ minHeight: '100vh', background: palette.canvas, color: palette.ink, fontFamily: font }}>
      <div style={{ maxWidth: 1180, minHeight: '100vh', margin: '0 auto', background: palette.surface, display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: mobile ? '14px 18px' : '16px 30px', borderBottom: `1px ${borderStyle} ${palette.rule}` }}>
          <button type="button" onClick={onCancel} disabled={submitting} style={{ border: 0, background: 'none', color: palette.ink, font: 'inherit', fontWeight: 700, cursor: submitting ? 'default' : 'pointer', padding: '10px 0' }}>RehearseAll</button>
          <span style={{ color: palette.muted, fontSize: 12 }}>{progress.answered} of {progress.total} answered</span>
        </header>

        <div style={{ height: 5, background: palette.soft }}>
          <div style={{ height: '100%', width: `${progress.percent}%`, background: palette.signal, transition: 'width .2s ease' }} />
        </div>

        <main style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '210px minmax(0, 1fr)', flex: 1 }}>
          <aside style={{ padding: mobile ? '20px 18px 0' : '30px 22px', borderRight: mobile ? undefined : `1px ${borderStyle} ${palette.rule}`, borderBottom: mobile ? `1px ${borderStyle} ${palette.rule}` : undefined }}>
            <div style={{ color: palette.signal, fontSize: 12 }}>Question {index + 1} of {deck.questions.length}</div>
            <h1 style={{ margin: '12px 0 8px', fontSize: 18, lineHeight: 1.3 }}>{deck.title}</h1>
            <p style={{ margin: 0, color: palette.muted, fontSize: 12.5, lineHeight: 1.6 }}>{deck.instructions}</p>
            {!mobile && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, marginTop: 28 }}>
                {deck.questions.map((question, questionIndex) => {
                  const answered = answers.some(item => item.questionId === question.id && (Array.isArray(item.value) ? item.value.length : item.value.trim()));
                  return <button key={question.id} type="button" onClick={() => setIndex(questionIndex)} aria-label={`Go to question ${questionIndex + 1}`} style={{ height: 28, border: `1px ${borderStyle} ${questionIndex === index ? palette.signal : palette.rule}`, background: answered ? palette.signal : 'transparent', color: answered ? (transcriptTheme ? '#fbfaf6' : '#101208') : palette.muted, font: 'inherit', fontSize: 11, cursor: 'pointer' }}>{questionIndex + 1}</button>;
                })}
              </div>
            )}
          </aside>

          <section style={{ padding: mobile ? '28px 18px 36px' : '52px 64px', maxWidth: 760 }}>
            <div style={{ color: palette.muted, fontSize: 12, marginBottom: 14 }}>{current.type.replace('-', ' ')}</div>
            {current.stimulus && (
              <div style={{ marginBottom: 28, padding: '18px 20px', background: palette.soft, borderLeft: `4px solid ${palette.signal}`, whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 13.5 }}>
                {current.stimulus}
              </div>
            )}
            <h2 style={{ margin: 0, fontSize: mobile ? 24 : 30, lineHeight: 1.35, letterSpacing: '-0.02em' }}>{current.prompt}</h2>

            <div style={{ marginTop: 32 }}>
              {current.type === 'single-choice' && current.options?.map(option => (
                <label key={option} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px ${borderStyle} ${palette.rule}`, cursor: 'pointer', lineHeight: 1.5 }}>
                  <input type="radio" name={current.id} checked={answer?.value === option} onChange={() => setAnswer(current.id, option)} style={{ marginTop: 4, accentColor: palette.signal }} />
                  <span>{option}</span>
                </label>
              ))}
              {current.type === 'multiple-choice' && current.options?.map(option => {
                const selected = Array.isArray(answer?.value) ? answer.value : [];
                return (
                  <label key={option} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px ${borderStyle} ${palette.rule}`, cursor: 'pointer', lineHeight: 1.5 }}>
                    <input type="checkbox" checked={selected.includes(option)} onChange={() => setAnswer(current.id, selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option])} style={{ marginTop: 4, accentColor: palette.signal }} />
                    <span>{option}</span>
                  </label>
                );
              })}
              {(current.type === 'short-text' || current.type === 'long-text') && (
                <textarea
                  aria-label="Your answer"
                  rows={current.type === 'long-text' ? 10 : 5}
                  value={typeof answer?.value === 'string' ? answer.value : ''}
                  onChange={event => setAnswer(current.id, event.target.value)}
                  placeholder="Write your answer here. Explain your reasoning when it matters."
                  style={{ ...controlStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 16, lineHeight: 1.6 }}
                />
              )}
            </div>

            {error && <p role="alert" style={{ color: palette.signal, fontSize: 13, lineHeight: 1.5, marginTop: 18 }}>{error}</p>}
            {confirmBlanks && blanks > 0 && (
              <p role="alert" style={{ color: palette.signal, fontSize: 13, lineHeight: 1.5, marginTop: 18 }}>{blanks} {blanks === 1 ? 'question is' : 'questions are'} blank. Submit again to finish anyway.</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 34, flexWrap: 'wrap' }}>
              <button type="button" disabled={index === 0 || submitting} onClick={() => setIndex(value => value - 1)} style={{ ...controlStyle, padding: '0 22px', opacity: index === 0 ? 0.4 : 1, cursor: index === 0 ? 'default' : 'pointer' }}>Back</button>
              {index < deck.questions.length - 1 ? (
                <button type="button" disabled={submitting} onClick={() => setIndex(value => value + 1)} style={{ ...controlStyle, padding: '0 24px', borderColor: palette.signal, color: palette.signal, cursor: 'pointer' }}>Next question</button>
              ) : (
                <button type="button" disabled={submitting} onClick={submit} style={{ minHeight: 48, padding: '0 24px', border: 0, background: palette.signal, color: transcriptTheme ? '#fbfaf6' : '#101208', font: 'inherit', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer' }}>
                  {submitting ? 'Evaluating…' : confirmBlanks && blanks > 0 ? `Submit with ${blanks} blank` : 'Finish and debrief'}
                </button>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default AssessmentRunner;
