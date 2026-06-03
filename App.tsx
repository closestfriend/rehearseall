
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import InterviewChat from './components/InterviewChat';
import VoiceInterview from './components/VoiceInterview';
import { AppStage, ResumeData, InterviewMessage, InterviewFeedback, HistoryEntry } from './types';
import { geminiService } from './services/geminiService';
import { pickPersona, LAST_PERSONA_STORAGE_KEY, InterviewerPersona } from './constants';

const STORAGE_KEY = 'hireprep_history_v1';

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resumeData, setResumeData] = useState<ResumeData>({
    text: '',
    role: '',
    experienceLevel: 'mid'
  });
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState<InterviewMessage[]>([]);
  const [currentPersona, setCurrentPersona] = useState<InterviewerPersona | null>(null);
  const [displayPersonaName, setDisplayPersonaName] = useState<string | null>(null);

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
    setStage(AppStage.RESUME_UPLOAD);
  };
  
  const startInterview = (mode: AppStage.INTERVIEWING_VOICE | AppStage.INTERVIEWING_TEXT) => {
    const lastId = localStorage.getItem(LAST_PERSONA_STORAGE_KEY) ?? undefined;
    const persona = pickPersona(lastId);
    setCurrentPersona(persona);
    localStorage.setItem(LAST_PERSONA_STORAGE_KEY, persona.id);
    setStage(mode);
  };

  const handleResumeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resumeData.text && resumeData.role) {
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

      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        date: Date.now(),
        resume: { ...resumeData },
        transcript: messages,
        feedback: result,
        personaName: currentPersona?.name ?? 'Unknown',
      };
      saveToHistory(entry);
      setDisplayPersonaName(currentPersona?.name ?? null);
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
    setStage(AppStage.FEEDBACK);
  };

  const exportFeedbackAsMarkdown = () => {
    if (!feedback) return;

    const isoDate = new Date().toISOString().slice(0, 10);
    const slug = (resumeData.role || 'interview').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const strengthsMd = feedback.strengths.map(s => `- ${s}`).join('\n');
    const improvementsMd = feedback.improvements.map(s => `- ${s}`).join('\n');
    const transcriptMd = currentTranscript.map(m => {
      const speaker = m.role === 'user' ? '**You:**' : '**Interviewer:**';
      return `${speaker} ${m.content}`;
    }).join('\n\n');

    const md = `# Interview Report — ${resumeData.role} (${resumeData.experienceLevel})
**Date:** ${isoDate} · **Score:** ${feedback.score}/100

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

  const renderLanding = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
      <div className="text-center mb-20">
        <h1 className="text-5xl lg:text-7xl font-extrabold text-gray-900 tracking-tight mb-8">
          Master your next <br />
          <span className="text-blue-600">job interview</span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-gray-500 mb-12">
          HirePrep AI analyzes your resume and conducts realistic mock interviews. Get instant feedback on your answers and communication.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={handleStartResume}
            className="px-10 py-4 bg-blue-600 text-white rounded-full font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
          >
            Start New Practice
          </button>
        </div>
      </div>
      
      {history.length > 0 && (
        <div className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Your Recent Activity</h2>
            <span className="text-sm text-gray-500 font-medium">{history.length} Sessions logged</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((entry) => (
              <div 
                key={entry.id}
                onClick={() => viewHistoryItem(entry)}
                className="group bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative"
              >
                <button 
                  onClick={(e) => deleteHistoryItem(entry.id, e)}
                  className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-lg">
                    {entry.feedback.score}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{entry.resume.role}</h3>
                    <p className="text-xs text-gray-400 font-medium">
                      {new Date(entry.date).toLocaleDateString()} at {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">{entry.resume.experienceLevel}</span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-wider">{entry.transcript.length} Messages</span>
                </div>
                <div className="text-blue-600 text-sm font-bold flex items-center gap-1">
                  View Full Report <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-12 text-center">
        <div>
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-3">Resume Analysis</h3>
          <p className="text-gray-500">We extract keywords and skills from your resume to tailor the interview questions.</p>
        </div>
        <div>
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-3">AI Mock Interview</h3>
          <p className="text-gray-500">Practice via voice or text with a state-of-the-art AI that responds like a real recruiter.</p>
        </div>
        <div>
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-3">Instant Feedback</h3>
          <p className="text-gray-500">Get a detailed report with scores, strengths, and specific areas to improve.</p>
        </div>
      </div>
    </div>
  );

  const renderResumeUpload = () => (
    <div className="max-w-3xl mx-auto py-16 px-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 lg:p-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Setup Your Interview</h2>
        <form onSubmit={handleResumeSubmit} className="space-y-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Job Role</label>
            <input 
              required
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
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
            <label className="block text-sm font-semibold text-gray-700 mb-2">Resume Content (Paste here)</label>
            <textarea 
              required
              placeholder="Paste your resume details, skills, and work history here..."
              className="w-full h-64 px-5 py-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow resize-none"
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

  const renderFeedback = () => (
    <div className="max-w-4xl mx-auto py-12 px-4">
      {isLoadingFeedback ? (
        <div className="text-center py-24">
          <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-8"></div>
          <h2 className="text-2xl font-bold text-gray-900">Analyzing Your Interview...</h2>
          <p className="text-gray-500 mt-2">Our AI is reviewing your responses against best practices.</p>
        </div>
      ) : feedback ? (
        <div className="space-y-8">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 flex flex-col md:flex-row items-center gap-12">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                <path className="text-gray-100" strokeDasharray="100, 100" strokeWidth="3" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-blue-600" strokeDasharray={`${feedback.score}, 100`} strokeWidth="3" strokeLinecap="round" fill="none" stroke="currentColor" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold text-gray-900">{feedback.score}</span>
                <span className="text-xs text-gray-400 font-bold tracking-widest uppercase">Score</span>
              </div>
            </div>
            <div className="flex-grow text-center md:text-left">
              <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Performance Review</h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                Interview report for <strong>{resumeData.role}</strong> ({resumeData.experienceLevel}).
              </p>
              <p className="text-xs text-gray-400 mt-2">Analyzed using Gemini 3 Pro Reasoning</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-green-50 rounded-3xl p-8 border border-green-100">
              <h3 className="text-xl font-bold text-green-800 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Key Strengths
              </h3>
              <ul className="space-y-4">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-3 text-green-700">
                    <span className="shrink-0 w-1.5 h-1.5 bg-green-500 rounded-full mt-2"></span>
                    <span className="text-sm font-medium">{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-amber-50 rounded-3xl p-8 border border-amber-100">
              <h3 className="text-xl font-bold text-amber-800 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Areas to Improve
              </h3>
              <ul className="space-y-4">
                {feedback.improvements.map((s, i) => (
                  <li key={i} className="flex gap-3 text-amber-700">
                    <span className="shrink-0 w-1.5 h-1.5 bg-amber-500 rounded-full mt-2"></span>
                    <span className="text-sm font-medium">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Detailed Analysis</h3>
            <div className="prose prose-blue max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
              {feedback.detailedAnalysis}
            </div>
          </div>

          <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
             <h3 className="text-xl font-bold text-gray-900 mb-6">Interview Transcript</h3>
             <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
                {currentTranscript.map((m, i) => (
                  <div key={i} className={`p-4 rounded-2xl ${m.role === 'user' ? 'bg-blue-50 ml-8' : 'bg-white border border-gray-100 mr-8'}`}>
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">{m.role === 'user' ? 'You' : 'Interviewer'}</p>
                    <p className="text-sm text-gray-700">{m.content}</p>
                  </div>
                ))}
             </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-8">
            <button
              onClick={exportFeedbackAsMarkdown}
              className="px-10 py-4 border border-gray-300 text-gray-700 rounded-full font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export as Markdown
            </button>
            <button
              onClick={() => setStage(AppStage.LANDING)}
              className="px-10 py-4 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto py-24 px-4 text-center">
          <p className="text-red-500 font-bold text-lg mb-4">Failed to load feedback.</p>
          {feedbackError && (
            <pre className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-6 text-left whitespace-pre-wrap break-all">
              {feedbackError}
            </pre>
          )}
          <div className="flex justify-center gap-4">
            <button
              onClick={retryFeedback}
              className="px-6 py-3 bg-gray-900 text-white rounded-full font-bold hover:bg-gray-800 transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => setStage(AppStage.LANDING)}
              className="px-6 py-3 border border-gray-200 text-gray-600 rounded-full font-bold hover:bg-gray-50 transition-all"
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const getStageContent = () => {
    switch(stage) {
      case AppStage.LANDING: return renderLanding();
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
      case AppStage.FEEDBACK: return renderFeedback();
      default: return renderLanding();
    }
  };

  return (
    <Layout>
      {getStageContent()}
    </Layout>
  );
};

export default App;
