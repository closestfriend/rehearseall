
import React, { useState, useEffect } from 'react';
import InterviewChat from './components/InterviewChat';
import VoiceInterview from './components/VoiceInterview';
import ThemedHome from './components/theme/ThemedHome';
import ThemedResumeUpload from './components/theme/ThemedResumeUpload';
import ThemedModePicker from './components/theme/ThemedModePicker';
import ThemedDebrief from './components/theme/ThemedDebrief';
import ThemedSessionLog from './components/theme/ThemedSessionLog';
import { AppStage, ResumeData, InterviewMessage, InterviewFeedback, HistoryEntry } from './types';
import { evaluateInterview } from './services/apiClient';
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './lib/replySuggestions';
import { LAST_PERSONA_STORAGE_KEY } from './constants';

const STORAGE_KEY = 'hireprep_history_v1';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData>({
    text: '',
    role: '',
    experienceLevel: 'mid',
    jobDescription: ''
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [resumeParseState, setResumeParseState] = useState<'idle' | 'parsing' | 'error'>('idle');
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<InterviewMessage[]>([]);
  // Server-picked persona (id+name only — fragments never reach the client).
  const [currentPersona, setCurrentPersona] = useState<{ id: string; name: string } | null>(null);
  const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'voice' | 'text' | null>(null);
  const [selectedMode, setSelectedMode] = useState<'voice' | 'text'>('voice');

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveToHistory = (entry: HistoryEntry) => {
    const newHistory = [entry, ...history];
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(h => h.id !== id);
    setHistory(newHistory);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
  };

  const handleStartResume = () => {
    setResumeData({ text: '', role: '', experienceLevel: 'mid' });
    setFeedback(null);
    setUploadedFile(null);
    setResumeParseState('idle');
    setStage(AppStage.RESUME_UPLOAD);
  };

  // Relaunch a new interview attempt reusing a past setup. With an `entry`,
  // pulls its resume/role/JD into the form (history card path); without one,
  // resumeData already reflects the report on screen (feedback screen path).
  const startPracticeAgain = (entry?: HistoryEntry) => {
    if (entry) setResumeData(entry.resume);
    setFeedback(null);
    setUploadedFile(null);
    setResumeParseState('idle');
    setStage(AppStage.RESUME_UPLOAD);
  };

  const handleFileSelected = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      console.error('Resume file over the 10 MB limit:', file.size);
      setResumeParseState('error');
      return;
    }
    setResumeParseState('parsing');
    try {
      const { parseResumeFile } = await import('./lib/resumeParser');
      const text = await parseResumeFile(file);
      setResumeData(prev => ({ ...prev, text }));
      setUploadedFile(file);
      setResumeParseState('idle');
    } catch (err) {
      console.error('Failed to parse resume file:', err);
      setResumeParseState('error');
    }
  };

  const handleFileClear = () => {
    setUploadedFile(null);
    setResumeData(prev => ({ ...prev, text: '' }));
    setResumeParseState('idle');
  };
  
  const startInterview = (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
    setCurrentPersona(null);
    setCurrentMode(mode === AppStage.INTERVIEWING_VOICE ? 'voice' : 'text');
    setDisplayPersonaName(null); // clear any name left over from viewing past history
    setStage(mode);
  };

  // Called by the interview components when the server's first response
  // resolves the persona. Persisting immediately (before the interview
  // completes) keeps the deliberate anti-repeat-even-if-user-backs-out behavior.
  const handlePersonaPicked = React.useCallback((p: { id: string; name: string }) => {
    setCurrentPersona(p);
    localStorage.setItem(LAST_PERSONA_STORAGE_KEY, p.id);
  }, []);

  const handleSetupContinue = () => {
    if (!resumeData.role.trim()) return;
    const jd = resumeData.jobDescription?.trim();
    setResumeData({ ...resumeData, jobDescription: jd || undefined });
    setStage(AppStage.INTERVIEW_MODE);
  };

  // Skip = proceed without a resume (the prompts have an explicit no-resume
  // branch), not skip the setup flow — role/level/JD survive.
  const handleSetupSkip = () => {
    if (!resumeData.role.trim()) return;
    const jd = resumeData.jobDescription?.trim();
    setResumeData({ ...resumeData, text: '', jobDescription: jd || undefined });
    setUploadedFile(null);
    setResumeParseState('idle');
    setStage(AppStage.INTERVIEW_MODE);
  };

  const processInterviewResults = async (messages: InterviewMessage[]) => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    setStage(AppStage.FEEDBACK);
    setCurrentTranscript(messages);
    try {
      const result = await evaluateInterview(resumeData, messages);
      setFeedback(result);

      // currentPersona is set by onPersonaPicked when the server's first
      // response arrives — before any transcript exists to finish — so the
      // fallback only guards the no-first-response edge. Capture once so the
      // saved entry and the on-screen reveal can never disagree.
      const personaName = currentPersona?.name ?? 'Unknown';

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: Date.now(),
        resume: { ...resumeData },
        transcript: messages,
        feedback: result,
        personaName,
        mode: currentMode ?? undefined,
      };
      saveToHistory(entry);
      setDisplayPersonaName(personaName);
    } catch (err) {
      console.error('Feedback generation failed:', err);
      setFeedbackError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const retryFeedback = () => {
    if (currentTranscript.length > 0) {
      processInterviewResults(currentTranscript);
    }
  };

  const viewHistoryItem = (entry: HistoryEntry) => {
    setResumeData(entry.resume);
    setFeedback(entry.feedback);
    setCurrentTranscript(entry.transcript);
    setDisplayPersonaName(entry.personaName ?? null);
    setCurrentMode(entry.mode ?? null);
    setStage(AppStage.FEEDBACK);
  };

  const exportFeedbackAsMarkdown = () => {
    if (!feedback) return;

    const isoDate = new Date().toISOString().slice(0, 10);
    const slug = (resumeData.role || 'interview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const strengthsMd = feedback.strengths.map(s => `- ${s}`).join('\n');
    const improvementsMd = feedback.improvements.map(s => `- ${s}`).join('\n');
    const transcriptMd = buildTranscriptMarkdown(currentTranscript, feedback.suggestions);

    const md = `# Interview Report — ${resumeData.role} (${resumeData.experienceLevel})
**Date:** ${isoDate} · **Score:** ${feedback.score}/100${displayPersonaName ? ` · **Interviewer:** ${displayPersonaName}` : ''}

## Key Strengths
${strengthsMd}

## Areas to Improve
${improvementsMd}

## Detailed Analysis
${feedback.detailedAnalysis}

## Transcript
${transcriptMd}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-${slug}-${isoDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderResumeUpload = () => (
    <ThemedResumeUpload
      role={resumeData.role}
      onRoleChange={(v) => setResumeData(prev => ({ ...prev, role: v }))}
      level={resumeData.experienceLevel}
      onLevelChange={(v) => setResumeData(prev => ({ ...prev, experienceLevel: v }))}
      jobDescription={resumeData.jobDescription ?? ''}
      onJobDescriptionChange={(v) => setResumeData(prev => ({ ...prev, jobDescription: v }))}
      resumeText={uploadedFile ? '' : resumeData.text}
      onResumeTextChange={(v) => setResumeData(prev => ({ ...prev, text: v }))}
      uploadedFileName={uploadedFile?.name ?? null}
      parseState={resumeParseState}
      parseSummary={
        uploadedFile && resumeData.text
          ? `parsed \u00b7 ${resumeData.text.trim().split(/\s+/).length.toLocaleString()} words`
          : null
      }
      onFileSelected={handleFileSelected}
      onFileClear={handleFileClear}
      onContinue={handleSetupContinue}
      onSkip={handleSetupSkip}
      onBackToHome={() => setStage(AppStage.LANDING)}
    />
  );

  const renderInterviewMode = () => (
    <ThemedModePicker
      roleLabel={resumeData.role}
      levelLabel={resumeData.experienceLevel}
      mode={selectedMode}
      onModeChange={setSelectedMode}
      onStart={() => startInterview(selectedMode === 'voice' ? AppStage.INTERVIEWING_VOICE : AppStage.INTERVIEWING_TEXT)}
      onBack={() => setStage(AppStage.RESUME_UPLOAD)}
    />
  );

  // Picks one weak reply to show as the Debrief's before/after study example —
  // the design shows a single rewrite, not the full suggestions list.
  const getRewriteExample = (): { before: string; after: string; critique: string } | null => {
    if (!feedback?.suggestions?.length) return null;
    const aligned = mapSuggestionsToMessages(currentTranscript, feedback.suggestions);
    const messageIndex = aligned.findIndex(s => s !== null);
    if (messageIndex === -1) return null;
    const suggestion = aligned[messageIndex]!;
    return {
      before: currentTranscript[messageIndex]?.content ?? '',
      after: suggestion.modelAnswer,
      critique: suggestion.critique,
    };
  };

  const getStageContent = () => {
    switch(stage) {
      case AppStage.LANDING: return (
        <ThemedHome
          history={history}
          onStartInterview={handleStartResume}
          onViewSession={viewHistoryItem}
          onViewSessionLog={() => setStage(AppStage.SESSION_LOG)}
        />
      );
      case AppStage.RESUME_UPLOAD: return renderResumeUpload();
      case AppStage.INTERVIEW_MODE: return renderInterviewMode();
      case AppStage.INTERVIEWING_TEXT: return (
        <InterviewChat
          resume={resumeData}
          lastPersonaId={localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined}
          onPersonaPicked={handlePersonaPicked}
          onFinish={processInterviewResults}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
      case AppStage.INTERVIEWING_VOICE: return (
        <VoiceInterview
          resume={resumeData}
          lastPersonaId={localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined}
          onPersonaPicked={handlePersonaPicked}
          onFinish={(transcript) => processInterviewResults(transcript.map(t => ({
            role: t.startsWith('Candidate') ? 'user' : 'assistant',
            content: t.split(': ')[1] || '',
            timestamp: Date.now()
          })))}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
      case AppStage.FEEDBACK: return (
        <ThemedDebrief
          state={isLoadingFeedback ? 'loading' : feedback ? 'success' : 'error'}
          errorMessage={feedbackError ?? undefined}
          onRetry={retryFeedback}
          score={feedback?.score}
          roleLabel={resumeData.role}
          levelLabel={resumeData.experienceLevel}
          questionCount={currentTranscript.filter(m => m.role === 'assistant').length}
          modeLabel={currentMode ?? undefined}
          personaName={displayPersonaName}
          strengths={feedback?.strengths ?? []}
          improvements={feedback?.improvements ?? []}
          detailedAnalysis={feedback?.detailedAnalysis}
          rewriteExample={getRewriteExample()}
          onPracticeAgain={() => startPracticeAgain()}
          onExportMarkdown={exportFeedbackAsMarkdown}
          onViewSessionLog={() => setStage(AppStage.SESSION_LOG)}
          onBackToDashboard={() => setStage(AppStage.LANDING)}
        />
      );
      case AppStage.SESSION_LOG: return (
        <ThemedSessionLog
          history={history}
          onViewSession={viewHistoryItem}
          onDeleteSession={deleteHistoryItem}
          onStartInterview={handleStartResume}
          onBackToHome={() => setStage(AppStage.LANDING)}
        />
      );
      default: return (
        <ThemedHome
          history={history}
          onStartInterview={handleStartResume}
          onViewSession={viewHistoryItem}
          onViewSessionLog={() => setStage(AppStage.SESSION_LOG)}
        />
      );
    }
  };

  // Every stage now renders themed, full-bleed chrome — the old Layout
  // wrapper (components/Layout.tsx) is no longer mounted anywhere.
  return getStageContent();
};

export default App;
