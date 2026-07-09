import React, { useRef, useState } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { useIsMobile } from '../hooks';

interface ResumeUploadProps {
  role: string;
  onRoleChange: (v: string) => void;
  level: string; // 'junior' | 'mid' | 'senior' | 'staff+'
  onLevelChange: (v: string) => void;
  jobDescription: string;
  onJobDescriptionChange: (v: string) => void;
  resumeText: string; // paste-fallback textarea content
  onResumeTextChange: (v: string) => void;
  uploadedFileName: string | null;
  parseState: 'idle' | 'parsing' | 'error';
  parseSummary: string | null; // honest summary line for the confirmation panel
  onFileSelected: (file: File) => void;
  onFileClear: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onBackToHome: () => void;
}

const FILE_ACCEPT = '.pdf,.md,application/pdf,text/markdown';

const LEVELS: Array<[value: string, label: string]> = [
  ['junior', 'JUNIOR'],
  ['mid', 'MID'],
  ['senior', 'SENIOR'],
  ['staff+', 'STAFF+'],
];

const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: '0.2em',
  color: '#d4f222',
  fontWeight: 600,
};

const PersonalBestResumeUpload: React.FC<ResumeUploadProps> = ({
  role,
  onRoleChange,
  level,
  onLevelChange,
  jobDescription,
  onJobDescriptionChange,
  resumeText,
  onResumeTextChange,
  uploadedFileName,
  parseState,
  parseSummary,
  onFileSelected,
  onFileClear,
  onContinue,
  onSkip,
  onBackToHome,
}) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);
  const [jdFocused, setJdFocused] = useState(false);
  const [pasteFocused, setPasteFocused] = useState(false);

  const canContinue = role.trim().length > 0;
  const showParsing = parseState === 'parsing';
  const showConfirmation = !showParsing && uploadedFileName !== null && parseState !== 'error';
  const showDropzone = !showParsing && !showConfirmation && !pasteMode;
  const showPaste = !showParsing && !showConfirmation && pasteMode;

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = ''; // allow re-selecting the same file after a clear
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#101208', color: '#f2f4e4', fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* TOP BAR — setup state: muted dot, SESSION SETUP */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 10 : 0, padding: isMobile ? '14px 20px' : '16px 40px', borderBottom: '1px solid #2a2d1a', flex: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button type="button" onClick={onBackToHome} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ width: 26, height: 26, background: '#d4f222', display: 'grid', placeItems: 'center', color: '#101208', fontWeight: 700, fontSize: 15 }}>H</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#f2f4e4', fontFamily: 'inherit' }}>HIREPREP</span>
          </button>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#a9ad91' }}>
              <span data-anim="" style={{ width: 7, height: 7, borderRadius: 99, background: '#8a8f5e', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
              SESSION SETUP
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, letterSpacing: '0.16em', color: '#a9ad91' }}>
            <span data-anim="" style={{ width: 7, height: 7, borderRadius: 99, background: '#8a8f5e', animation: 'hpBlink 1.6s ease-in-out infinite' }} />
            SESSION SETUP
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', gap: 12 }}>
          <button
            type="button"
            onClick={() => setTheme('transcript')}
            title="Switch to the Transcript theme"
            style={{ background: 'none', border: '1px solid #3a3e24', color: '#a9ad91', padding: isMobile ? '9px 12px' : '9px 16px', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' }}
          >
            {isMobile ? 'OUTFIT' : 'SWITCH OUTFIT'}
          </button>
          <button
            type="button"
            onClick={onBackToHome}
            style={{ background: 'none', border: '1px solid #3a3e24', padding: '8px 18px', fontSize: 12.5, fontWeight: 600, color: '#a9ad91', cursor: 'pointer', minHeight: 44, boxSizing: 'border-box', fontFamily: 'inherit' }}
          >
            BACK TO HOME
          </button>
        </div>
      </div>

      {/* STEP TRACKER — 50% fill */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '12px 20px' : '14px 40px', borderBottom: '1px solid #2a2d1a', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <span style={{ fontSize: 12, letterSpacing: '0.14em', color: '#a9ad91', flex: 'none' }}>
          STEP <span style={{ color: '#f2f4e4', fontWeight: 700 }}>1</span> / 2 — THE LOADOUT
        </span>
        <div style={{ flex: 1, height: 4, background: '#2a2d1a', minWidth: isMobile ? '100%' : undefined, order: isMobile ? 3 : 0 }}>
          <div style={{ width: '50%', height: '100%', background: '#d4f222', boxShadow: '0 0 12px rgba(212,242,34,.5)' }} />
        </div>
        <span style={{ fontSize: 12, color: '#a9ad91', flex: 'none' }}>next: pick your event</span>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, padding: isMobile ? '36px 20px 40px' : '56px 40px 48px', maxWidth: 1100, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(2rem, 6vw, 2.75rem)', lineHeight: 1.02, letterSpacing: '-0.03em', fontWeight: 700 }}>Load your file.</h1>
        <p style={{ margin: isMobile ? '0 0 32px' : '0 0 44px', fontSize: 15, lineHeight: 1.6, color: '#a9ad91', maxWidth: 560 }}>
          Your interviewer reads the resume before the rep — questions come from what you&apos;ve actually done, not a generic script.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 40, alignItems: 'start' }}>
          {/* LEFT: DROPZONE / PASTE / PARSING / CONFIRMATION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={fieldLabelStyle}>RESUME</div>

            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />

            {showParsing && (
              <>
                <div style={{ border: '1px solid #3a3e24', padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ width: 44, height: 44, border: '1px solid #3a3e24', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <span data-anim="" style={{ width: 10, height: 10, background: '#d4f222', animation: 'hpPulseFade 1.2s ease-in-out infinite' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFileName ?? 'your resume'}</div>
                    <div data-anim="" style={{ fontSize: 12, letterSpacing: '0.14em', color: '#d4f222', marginTop: 4, animation: 'hpPulseFade 1.4s ease-in-out infinite' }}>PARSING…</div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: '#6d7157' }}>reading the file — a second or two.</div>
              </>
            )}

            {showConfirmation && (
              <>
                <div style={{ border: '1px solid #d4f222', boxShadow: '0 0 34px rgba(212,242,34,.15)', padding: '24px 26px', display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div style={{ width: 44, height: 44, background: '#d4f222', color: '#101208', display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 700, flex: 'none' }}>✓</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFileName}</div>
                    {parseSummary && <div style={{ fontSize: 12, color: '#a9ad91', marginTop: 4 }}>{parseSummary}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={onFileClear}
                    style={{ flex: 'none', fontSize: 12, color: '#a9ad91', cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid #3a3e24', padding: '0 0 1px', fontFamily: 'inherit' }}
                  >
                    replace
                  </button>
                </div>
                <div style={{ fontSize: 12.5, color: '#8a8f5e' }}>Your interviewer has read it. Expect questions about specifics.</div>
              </>
            )}

            {showDropzone && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={openFilePicker}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFilePicker(); } }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `1px dashed ${dragOver ? '#d4f222' : '#3a3e24'}`,
                    background: dragOver ? 'rgba(212,242,34,.03)' : 'transparent',
                    padding: isMobile ? '40px 20px' : '56px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color .2s, background .2s',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Drag your resume here</div>
                  <div style={{ fontSize: 12.5, color: '#a9ad91' }}>PDF or MD · max 10&nbsp;MB</div>
                  <div style={{ marginTop: 10, border: '1px solid #3a3e24', padding: '10px 22px', fontSize: 12.5, fontWeight: 700, color: '#f2f4e4', minHeight: 44, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center' }}>
                    BROWSE FILES
                  </div>
                </div>
                {parseState === 'error' && (
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ color: '#d4f222', fontWeight: 700 }}>COULDN&apos;T READ THAT FILE — </span>
                    <span style={{ color: '#a9ad91' }}>try another PDF or MD, or paste the text instead.</span>
                  </div>
                )}
                <div style={{ fontSize: 12.5, color: '#6d7157' }}>
                  no file handy?{' '}
                  <button
                    type="button"
                    onClick={() => setPasteMode(true)}
                    style={{ color: '#d4f222', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid #d4f222', padding: '0 0 1px', fontSize: 12.5, fontFamily: 'inherit' }}
                  >
                    paste resume text instead
                  </button>
                </div>
              </>
            )}

            {showPaste && (
              <>
                <textarea
                  value={resumeText}
                  onChange={(e) => onResumeTextChange(e.target.value)}
                  onFocus={() => setPasteFocused(true)}
                  onBlur={() => setPasteFocused(false)}
                  placeholder="Paste the full text of your resume here."
                  style={{
                    background: 'transparent',
                    border: `1px solid ${pasteFocused ? '#d4f222' : '#3a3e24'}`,
                    color: '#f2f4e4',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    padding: '14px 16px',
                    minHeight: 180,
                    resize: 'vertical',
                    outline: 'none',
                    transition: 'border-color .2s',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 12.5, color: '#6d7157' }}>
                  have a file after all?{' '}
                  <button
                    type="button"
                    onClick={() => setPasteMode(false)}
                    style={{ color: '#d4f222', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', borderBottom: '1px solid #d4f222', padding: '0 0 1px', fontSize: 12.5, fontFamily: 'inherit' }}
                  >
                    upload it instead
                  </button>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: TARGET */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 24 : 26 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label htmlFor="hp-target-role" style={fieldLabelStyle}>TARGET ROLE</label>
              <input
                id="hp-target-role"
                value={role}
                onChange={(e) => onRoleChange(e.target.value)}
                onFocus={() => setRoleFocused(true)}
                onBlur={() => setRoleFocused(false)}
                placeholder="Senior Frontend Engineer"
                style={{
                  background: 'transparent',
                  border: `1px solid ${roleFocused ? '#d4f222' : '#3a3e24'}`,
                  color: '#f2f4e4',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 15,
                  padding: '14px 16px',
                  outline: 'none',
                  transition: 'border-color .2s',
                  minHeight: 44,
                  boxSizing: 'border-box',
                  width: '100%',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={fieldLabelStyle}>LEVEL</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {LEVELS.map(([value, label]) => {
                  const selected = level === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onLevelChange(value)}
                      style={{
                        border: `1px solid ${selected ? '#d4f222' : '#3a3e24'}`,
                        background: selected ? 'rgba(212,242,34,.08)' : 'none',
                        padding: '11px 20px',
                        fontSize: 12.5,
                        fontWeight: selected ? 700 : 600,
                        color: selected ? '#d4f222' : '#a9ad91',
                        cursor: 'pointer',
                        transition: 'border-color .2s, color .2s',
                        minHeight: 44,
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        flex: isMobile ? '1 1 auto' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label htmlFor="hp-job-description" style={{ ...fieldLabelStyle, color: '#8a8f5e' }}>
                JOB DESCRIPTION <span style={{ color: '#6d7157', letterSpacing: '0.06em', fontWeight: 400 }}>— optional</span>
              </label>
              <textarea
                id="hp-job-description"
                value={jobDescription}
                onChange={(e) => onJobDescriptionChange(e.target.value)}
                onFocus={() => setJdFocused(true)}
                onBlur={() => setJdFocused(false)}
                placeholder="Paste the posting and the questions get sharper — the interviewer will probe against what the role actually asks for."
                style={{
                  background: 'transparent',
                  border: `1px solid ${jdFocused ? '#d4f222' : '#3a3e24'}`,
                  color: '#f2f4e4',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  padding: '14px 16px',
                  minHeight: 110,
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color .2s',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 18 : 0, marginTop: isMobile ? 40 : 52, paddingTop: 28, borderTop: '1px solid #2a2d1a' }}>
          <button
            type="button"
            onClick={onSkip}
            style={{ fontSize: 12.5, color: '#6d7157', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', minHeight: 44, textAlign: isMobile ? 'center' : 'left' }}
          >
            skip — run it without a resume →
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            title={canContinue ? undefined : 'Enter a target role first'}
            style={{
              display: 'inline-block',
              background: canContinue ? '#d4f222' : '#2a2d1a',
              color: canContinue ? '#101208' : '#6d7157',
              padding: '16px 36px',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              cursor: canContinue ? 'pointer' : 'default',
              minHeight: 44,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              width: isMobile ? '100%' : undefined,
              transition: 'background .2s, color .2s',
            }}
          >
            CONTINUE →
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonalBestResumeUpload;
