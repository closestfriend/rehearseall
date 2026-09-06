
import React, { useState, useEffect } from 'react';
import InterviewChat from './components/InterviewChat';
import VoiceInterview from './components/VoiceInterview';
import ThemedHome from './components/theme/ThemedHome';
import ThemedResumeUpload from './components/theme/ThemedResumeUpload';
import ThemedConversationSetup from './components/theme/ThemedConversationSetup';
import ThemedModePicker from './components/theme/ThemedModePicker';
import ThemedDebrief from './components/theme/ThemedDebrief';
import ThemedSessionLog from './components/theme/ThemedSessionLog';
import RehearsalLibrary from './components/RehearsalLibrary';
import AssessmentRunner from './components/AssessmentRunner';
import { AppStage, ConversationSetup, ResumeData, InterviewMessage, InterviewFeedback, HistoryEntry, PracticeSetup, RehearsalSetup } from './types';
import { evaluateInterview } from './services/apiClient';
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './lib/replySuggestions';
import { LAST_PERSONA_STORAGE_KEY } from './constants';
import { isConversationSetup, isRehearsalSetup, practiceDetail, practicePersonaLabel, practiceTitle } from './lib/practiceSetup';
import { createRehearsalSetup, REHEARSAL_PRESETS } from './lib/rehearsalCatalog';
import { destinationForRehearsal } from './lib/rehearsalNavigation';
import { resetStageScroll } from './lib/stageEffects';

const STORAGE_KEY = 'hireprep_history_v1';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [practiceKind, setPracticeKind] = useState<'conversation' | 'interview' | 'rehearsal'>('conversation');
  const [conversationData, setConversationData] = useState<ConversationSetup>({
    kind: 'conversation',
    title: '',
    counterpart: '',
    goal: '',
    context: '',
    concern: '',
  });
  const [resumeData, setResumeData] = useState<ResumeData>({
    kind: 'interview',
    text: '',
    role: '',
    experienceLevel: 'mid',
    jobDescription: ''
  });
  const [rehearsalData, setRehearsalData] = useState<RehearsalSetup>(() =>
    createRehearsalSetup(REHEARSAL_PRESETS[0], '')
  );
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
  // Pins the anti-repeat hint at interview start so the lastPersonaId prop
  // stays referentially stable for the lifetime of the interview, even
  // though handlePersonaPicked writes a new id to localStorage mid-session.
  // Reading localStorage directly in the render cases would make the prop
  // change identity as soon as the server picks a persona, which re-fires
  // VoiceInterview's mount-effect cleanup (stops mic tracks, closes
  // AudioContexts, marks the session unmounted) and kills audio after the
  // very first mint.
  const [pinnedLastPersonaId, setPinnedLastPersonaId] = useState<string | undefined>(undefined);
  const activeSetup: PracticeSetup = practiceKind === 'conversation'
    ? conversationData
    : practiceKind === 'rehearsal'
      ? rehearsalData
      : resumeData;

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

  useEffect(() => {
    resetStageScroll(options => window.scrollTo(options));
  }, [stage]);

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
    setPracticeKind('conversation');
    setConversationData({ kind: 'conversation', title: '', counterpart: '', goal: '', context: '', concern: '' });
    setResumeData({ kind: 'interview', text: '', role: '', experienceLevel: 'mid' });
    setFeedback(null);
    setUploadedFile(null);
    setResumeParseState('idle');
    setStage(AppStage.RESUME_UPLOAD);
  };

  // Relaunch a new interview attempt reusing a past setup. With an `entry`,
  // pulls its resume/role/JD into the form (history card path); without one,
  // resumeData already reflects the report on screen (feedback screen path).
  const startPracticeAgain = (entry?: HistoryEntry) => {
    let repeatSetup: PracticeSetup = activeSetup;
    if (entry) {
      repeatSetup = entry.resume;
      if (isConversationSetup(entry.resume)) {
        setPracticeKind('conversation');
        setConversationData(entry.resume);
      } else if (isRehearsalSetup(entry.resume)) {
        setPracticeKind('rehearsal');
        setRehearsalData(entry.resume);
      } else {
        setPracticeKind('interview');
        setResumeData(entry.resume);
      }
    }
    setFeedback(null);
    setUploadedFile(null);
    setResumeParseState('idle');
    if (isRehearsalSetup(repeatSetup)) {
      setStage(destinationForRehearsal(repeatSetup));
    } else {
      setStage(AppStage.RESUME_UPLOAD);
    }
  };

  const startCustomRehearsal = (setup: RehearsalSetup) => {
    setPracticeKind('rehearsal');
    setRehearsalData(setup);
    setFeedback(null);
    setCurrentTranscript([]);
    setDisplayPersonaName(null);
    setStage(destinationForRehearsal(setup));
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
    setPinnedLastPersonaId(localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined);
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
    if (practiceKind === 'conversation') {
      if (!conversationData.title.trim() || !conversationData.counterpart.trim() || !conversationData.goal.trim()) return;
      setConversationData(prev => ({ ...prev, concern: prev.concern?.trim() || undefined }));
    } else {
      if (!resumeData.role.trim()) return;
      const jd = resumeData.jobDescription?.trim();
      setResumeData({ ...resumeData, jobDescription: jd || undefined });
    }
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
      const result = await evaluateInterview(activeSetup, messages);
      setFeedback(result);

      // currentPersona is set by onPersonaPicked when the server's first
      // response arrives — before any transcript exists to finish — so the
      // fallback only guards the no-first-response edge. Capture once so the
      // saved entry and the on-screen reveal can never disagree.
      const personaName = currentPersona?.name ?? 'Unknown';

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: Date.now(),
        resume: { ...activeSetup },
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

  const processAssessmentResults = (
    result: InterviewFeedback,
    transcript: InterviewMessage[],
  ) => {
    const personaName = 'Structured assessment';
    setFeedback(result);
    setFeedbackError(null);
    setCurrentTranscript(transcript);
    setCurrentMode('text');
    setDisplayPersonaName(null);
    saveToHistory({
      id: crypto.randomUUID(),
      date: Date.now(),
      resume: { ...rehearsalData },
      transcript,
      feedback: result,
      personaName,
      mode: 'text',
    });
    setStage(AppStage.FEEDBACK);
  };

  const retryFeedback = () => {
    if (currentTranscript.length > 0) {
      processInterviewResults(currentTranscript);
    }
  };

  const viewHistoryItem = (entry: HistoryEntry) => {
    if (isConversationSetup(entry.resume)) {
      setPracticeKind('conversation');
      setConversationData(entry.resume);
    } else if (isRehearsalSetup(entry.resume)) {
      setPracticeKind('rehearsal');
      setRehearsalData(entry.resume);
    } else {
      setPracticeKind('interview');
      setResumeData(entry.resume);
    }
    setFeedback(entry.feedback);
    setCurrentTranscript(entry.transcript);
    setDisplayPersonaName(practicePersonaLabel(entry.resume, entry.personaName));
    setCurrentMode(entry.mode ?? null);
    setStage(AppStage.FEEDBACK);
  };

  const exportFeedbackAsMarkdown = () => {
    if (!feedback) return;

    const isoDate = new Date().toISOString().slice(0, 10);
    const title = practiceTitle(activeSetup);
    const detail = practiceDetail(activeSetup);
    const slug = (title || 'rehearsal').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const strengthsMd = feedback.strengths.map(s => `- ${s}`).join('\n');
    const improvementsMd = feedback.improvements.map(s => `- ${s}`).join('\n');
    const transcriptMd = buildTranscriptMarkdown(currentTranscript, feedback.suggestions);

    const md = `# Rehearsal Debrief — ${title}
**Date:** ${isoDate} · **Context:** ${detail} · **Score:** ${feedback.score}/100${displayPersonaName ? ` · **Rehearsal partner:** ${displayPersonaName}` : ''}

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
    a.download = `rehearsal-${slug}-${isoDate}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadClinicianExample = () => setConversationData({
    kind: 'conversation',
    title: 'AI and teenagers research call',
    counterpart: "A doctor and researcher at Nationwide Children's Hospital",
    goal: 'Build shared language across AI-harms research and clinical practice, learn which concerns matter most in adolescent care, and leave with a useful next step for continued collaboration.',
    context: 'I am a researcher who studies AI and AI harms. I understand the technology and its social risks, but I am less fluent in the medical and clinical world. This is an exploratory professional call about teenagers’ use of AI, where our perspectives may complement each other.',
    concern: 'I do not want to overstate medical knowledge, flatten clinical nuance, or spend the call proving expertise instead of asking good questions.',
  });

  const renderSetup = () => practiceKind === 'conversation' ? (
    <ThemedConversationSetup
      title={conversationData.title}
      onTitleChange={(title) => setConversationData(prev => ({ ...prev, title }))}
      counterpart={conversationData.counterpart}
      onCounterpartChange={(counterpart) => setConversationData(prev => ({ ...prev, counterpart }))}
      goal={conversationData.goal}
      onGoalChange={(goal) => setConversationData(prev => ({ ...prev, goal }))}
      context={conversationData.context}
      onContextChange={(context) => setConversationData(prev => ({ ...prev, context }))}
      concern={conversationData.concern ?? ''}
      onConcernChange={(concern) => setConversationData(prev => ({ ...prev, concern }))}
      onLoadExample={loadClinicianExample}
      onUseInterviewPreset={() => setPracticeKind('interview')}
      onContinue={handleSetupContinue}
      onBackToHome={() => setStage(AppStage.LANDING)}
    />
  ) : (
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
      onUseOpenRehearsal={() => setPracticeKind('conversation')}
      onBackToHome={() => setStage(AppStage.LANDING)}
    />
  );

  const renderInterviewMode = () => (
    <ThemedModePicker
      roleLabel={practiceTitle(activeSetup)}
      levelLabel={practiceDetail(activeSetup)}
      mode={selectedMode}
      onModeChange={setSelectedMode}
      onStart={() => startInterview(selectedMode === 'voice' ? AppStage.INTERVIEWING_VOICE : AppStage.INTERVIEWING_TEXT)}
      onBack={() => setStage(practiceKind === 'rehearsal' ? AppStage.REHEARSAL_LIBRARY : AppStage.RESUME_UPLOAD)}
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
          onBrowseRehearsals={() => setStage(AppStage.REHEARSAL_LIBRARY)}
          onViewSession={viewHistoryItem}
          onViewSessionLog={() => setStage(AppStage.SESSION_LOG)}
        />
      );
      case AppStage.REHEARSAL_LIBRARY: return (
        <RehearsalLibrary
          onBack={() => setStage(AppStage.LANDING)}
          onStart={startCustomRehearsal}
        />
      );
      case AppStage.RESUME_UPLOAD: return renderSetup();
      case AppStage.INTERVIEW_MODE: return renderInterviewMode();
      case AppStage.INTERVIEWING_TEXT: return (
        <InterviewChat
          setup={activeSetup}
          lastPersonaId={pinnedLastPersonaId}
          onPersonaPicked={handlePersonaPicked}
          onFinish={processInterviewResults}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
      case AppStage.INTERVIEWING_VOICE: return (
        <VoiceInterview
          setup={activeSetup}
          lastPersonaId={pinnedLastPersonaId}
          onPersonaPicked={handlePersonaPicked}
          onFinish={(transcript) => processInterviewResults(transcript.map(t => ({
            role: t.startsWith('Candidate') ? 'user' : 'assistant',
            content: t.split(': ')[1] || '',
            timestamp: Date.now()
          })))}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      );
      case AppStage.ASSESSMENT_ACTIVE: return (
        <AssessmentRunner
          setup={rehearsalData}
          onComplete={processAssessmentResults}
          onCancel={() => setStage(AppStage.REHEARSAL_LIBRARY)}
        />
      );
      case AppStage.FEEDBACK: return (
        <ThemedDebrief
          state={isLoadingFeedback ? 'loading' : feedback ? 'success' : 'error'}
          errorMessage={feedbackError ?? undefined}
          onRetry={retryFeedback}
          score={feedback?.score}
          roleLabel={practiceTitle(activeSetup)}
          levelLabel={practiceDetail(activeSetup)}
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
          onBrowseRehearsals={() => setStage(AppStage.REHEARSAL_LIBRARY)}
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
