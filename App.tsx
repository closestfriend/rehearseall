
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import InterviewChat from './components/InterviewChat';
import VoiceInterview from './components/VoiceInterview';
import ThemedHome from './components/theme/ThemedHome';
import ThemedDebrief from './components/theme/ThemedDebrief';
import ThemedSessionLog from './components/theme/ThemedSessionLog';
import { AppStage, ResumeData, InterviewMessage, InterviewFeedback, HistoryEntry } from './types';
import { geminiService } from './services/geminiService';
import { mapSuggestionsToMessages, buildTranscriptMarkdown } from './lib/replySuggestions';
import { pickPersona, LAST_PERSONA_STORAGE_KEY, InterviewerPersona } from './constants';

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
  const [currentPersona, setCurrentPersona] = useState<InterviewerPersona | null>(null);
  const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'voice' | 'text' | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    e.target.value = '';
  };

  const handleFileClear = () => {
    setUploadedFile(null);
    setResumeData(prev => ({ ...prev, text: '' }));
    setResumeParseState('idle');
  };
  
  const startInterview = (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
    const lastId = localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined;
    const persona = pickPersona(lastId);
    setCurrentPersona(persona);
    setCurrentMode(mode === AppStage.INTERVIEWING_VOICE ? 'voice' : 'text');
    setDisplayPersonaName(null); // clear any name left over from viewing past history
    // Persist the choice up front (before the interview completes) so the next
    // run still excludes it even if the user backs out — deliberate, for anti-repeat.
    localStorage.setItem(LAST_PERSONA_STORAGE_KEY, persona.id);
    setStage(mode);
  };

  const handleResumeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resumeData.text && resumeData.role) {
      const jd = resumeData.jobDescription?.trim();
      setResumeData({ ...resumeData, jobDescription: jd || undefined });
      setStage(AppStage.INTERVIEW_MODE);
    }
  };

  const processInterviewResults = async (messages: InterviewMessage[]) => {
    setIsLoadingFeedback(true);
    setFeedbackError(null);
    setStage(AppStage.FEEDBACK);
    setCurrentTranscript(messages);
    try {
      const result = await geminiService.generateFeedback(resumeData, messages);
      setFeedback(result);

      // currentPersona is always set before an interview can start (the
      // INTERVIEWING_* render cases gate on it), so the fallback only guards
      // an impossible state. Capture once so the saved entry and the on-screen
      // reveal can never disagree.
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
    <div className="max-w-3xl mx-auto py-6 sm:py-16 px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 lg:p-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Setup Your Interview</h2>
        <form onSubmit={handleResumeSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Job Role</label>
            <input 
              required
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-base"
              value={resumeData.role}
              onChange={(e) => setResumeData({...resumeData, role: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Experience Level</label>
            <div className="grid grid-cols-3 gap-3">
              {['entry', 'mid', 'senior'].map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setResumeData({...resumeData, experienceLevel: level})}
                  className={`py-3 rounded-xl border font-medium transition-all ${
                    resumeData.experienceLevel === level 
                    ? 'border-blue-600 bg-blue-50 text-blue-600 ring-1 ring-blue-600' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Job Description (optional)
            </label>
            <textarea
              placeholder="Paste the full job description to tailor the interview…"
              className="w-full h-32 sm:h-40 px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none text-base"
              value={resumeData.jobDescription ?? ''}
              onChange={(e) => setResumeData({...resumeData, jobDescription: e.target.value})}
            />
          </div>

          <div>
            <div className="mb-3">
              {uploadedFile ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-700 flex-grow truncate">{uploadedFile.name}</span>
                  <button
                    type="button"
                    onClick={handleFileClear}
                    className="text-blue-400 hover:text-blue-600 transition-colors"
                    aria-label="Remove file"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="resume-file-input"
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 cursor-pointer hover:border-blue-400 hover:text-blue-600 transition-all ${resumeParseState === 'parsing' ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {resumeParseState === 'parsing' ? (
                      <>
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        Reading file…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload PDF or .md
                      </>
                    )}
                  </label>
                  <input
                    id="resume-file-input"
                    type="file"
                    accept=".pdf,.md,application/pdf,text/markdown"
                    className="sr-only"
                    onChange={handleFileUpload}
                  />
                  {resumeParseState === 'error' && (
                    <p className="mt-2 text-xs text-red-500">Could not read that file — try another or paste your resume below.</p>
                  )}
                </div>
              )}
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {uploadedFile ? 'Resume Content' : 'Resume Content (Paste here)'}
            </label>
            <textarea
              required={!uploadedFile}
              disabled={!!uploadedFile}
              placeholder="Paste your resume details, skills, and work history here..."
              className={`w-full h-40 sm:h-64 px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none text-base ${uploadedFile ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
              value={resumeData.text}
              onChange={(e) => setResumeData({...resumeData, text: e.target.value})}
            />
          </div>

          <div className="flex gap-4">
             <button 
              type="button"
              onClick={() => setStage(AppStage.LANDING)}
              className="w-1/3 py-5 bg-gray-100 text-gray-600 rounded-2xl font-bold text-xl hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-grow py-5 bg-blue-600 text-white rounded-2xl font-bold text-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderInterviewMode = () => (
    <div className="max-w-4xl mx-auto py-24 px-4 text-center">
      <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Choose Interview Format</h2>
      <p className="text-gray-500 mb-8 text-lg">We've analyzed your details. How would you like to practice today?</p>

      <div className="grid md:grid-cols-2 gap-8">
        <button 
          onClick={() => startInterview(AppStage.INTERVIEWING_VOICE)}
          className="group bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left"
        >
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-10-4V5a2 2 0 012-2h4a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Voice Interview</h3>
          <p className="text-gray-500">Real-time conversational audio. Best for practicing verbal communication.</p>
          <div className="mt-6 flex items-center text-blue-600 font-semibold gap-2">
            Start Voice <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </div>
        </button>

        <button 
          onClick={() => startInterview(AppStage.INTERVIEWING_TEXT)}
          className="group bg-white p-10 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left"
        >
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Chat Interview</h3>
          <p className="text-gray-500">Interactive text messaging. Best for structuring complex technical answers.</p>
          <div className="mt-6 flex items-center text-blue-600 font-semibold gap-2">
            Start Chat <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </div>
        </button>
      </div>
      <button 
        onClick={() => setStage(AppStage.LANDING)}
        className="mt-12 text-gray-400 font-medium hover:text-gray-600 transition-colors"
      >
        Go back to dashboard
      </button>
    </div>
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
      case AppStage.INTERVIEWING_TEXT: return currentPersona ? (
        <InterviewChat
          resume={resumeData}
          persona={currentPersona}
          onFinish={processInterviewResults}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      ) : renderInterviewMode();
      case AppStage.INTERVIEWING_VOICE: return currentPersona ? (
        <VoiceInterview
          resume={resumeData}
          persona={currentPersona}
          onFinish={(transcript) => processInterviewResults(transcript.map(t => ({
            role: t.startsWith('Candidate') ? 'user' : 'assistant',
            content: t.split(': ')[1] || '',
            timestamp: Date.now()
          })))}
          onCancel={() => setStage(AppStage.INTERVIEW_MODE)}
        />
      ) : renderInterviewMode();
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

  const usesThemedChrome = [
    AppStage.LANDING,
    AppStage.INTERVIEWING_TEXT,
    AppStage.INTERVIEWING_VOICE,
    AppStage.FEEDBACK,
    AppStage.SESSION_LOG,
  ].includes(stage);

  return usesThemedChrome ? (
    getStageContent()
  ) : (
    <Layout>
      {getStageContent()}
    </Layout>
  );
};

export default App;
