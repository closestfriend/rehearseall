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
  onUseOpenRehearsal: () => void;
  onBackToHome: () => void;
}

const LEVELS: Array<{ value: string; label: string }> = [
  { value: 'junior', label: 'junior' },
  { value: 'mid', label: 'mid' },
  { value: 'senior', label: 'senior' },
  { value: 'staff+', label: 'staff+' },
];

const ACCEPT = '.pdf,.md,application/pdf,text/markdown';

const TranscriptResumeUpload: React.FC<ResumeUploadProps> = ({
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
  onUseOpenRehearsal,
  onBackToHome,
}) => {
  const { setTheme } = useTheme();
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const canContinue = role.trim().length > 0;
  const showConfirmation = uploadedFileName !== null;
  const showParsing = !showConfirmation && parseState === 'parsing';
  const showDropzone = !showConfirmation && !showParsing && !pasteMode;
  const showPaste = !showConfirmation && !showParsing && pasteMode;

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const dzHot = hovered === 'dropzone' || dragActive;

  return (
    <div style={{ minHeight: '100vh', background: '#e9e6dc', padding: '0 0 48px', color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', minHeight: '100vh', background: '#fbfaf6', boxShadow: '0 2px 24px rgba(28,27,24,.12)', display: 'flex', flexDirection: 'column' }}>

        {/* TOP BAR */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '14px 20px' : '16px 64px', borderBottom: '1px dashed #b9b4a5', flex: 'none', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 10 : 0 }}>
          <button type="button" onClick={onBackToHome} style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', color: '#1c1b18', padding: 0, fontFamily: 'inherit' }}>
            REHEARSE_ALL_
          </button>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, letterSpacing: '0.18em', color: '#6d685c', fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#6d685c', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PRE-TRIAL FILING
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16 }}>
            <button
              type="button"
              onClick={() => setTheme('personal-best')}
              title="Switch to the Personal Best theme"
              style={{ background: 'none', border: 'none', color: '#6d685c', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', padding: 0, minHeight: isMobile ? 44 : undefined }}
            >
              {isMobile ? '[outfit]' : '[switch outfit]'}
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              onMouseEnter={() => setHovered('home')}
              onMouseLeave={() => setHovered(null)}
              style={{ fontSize: 12, color: hovered === 'home' ? '#b3402a' : '#6d685c', border: `1px solid ${hovered === 'home' ? '#b3402a' : '#b9b4a5'}`, padding: isMobile ? '10px 16px' : '7px 16px', background: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined, transition: 'border-color .2s, color .2s' }}
            >
              return home
            </button>
          </div>
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, letterSpacing: '0.14em', color: '#6d685c', fontWeight: 700, width: '100%' }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: '#6d685c', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
              PRE-TRIAL FILING
            </div>
          )}
        </div>

        {/* CASE HEADER */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'baseline', gap: isMobile ? 4 : 0, padding: isMobile ? '16px 20px 12px' : '20px 64px 14px', flex: 'none', fontSize: 12, color: '#6d685c' }}>
          <span>IN RE: YOUR NEXT JOB — SUBMISSION OF EXHIBITS</span>
          <span>STEP 1 OF 2</span>
        </div>

        {/* PROGRESS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, padding: isMobile ? '0 20px 16px' : '0 64px 18px', borderBottom: '1px dashed #b9b4a5', flex: 'none' }}>
          <span style={{ fontSize: 11, letterSpacing: '0.12em', color: '#6d685c', flex: 'none' }}>FILING</span>
          <div style={{ flex: 1, height: 8, border: '1px solid #1c1b18' }}>
            <div style={{ width: '50%', height: '100%', background: 'repeating-linear-gradient(45deg, #b3402a 0 3px, transparent 3px 6px)' }} />
          </div>
          {!isMobile && <span style={{ fontSize: 11, color: '#8a8471', flex: 'none' }}>next: election of proceedings</span>}
        </div>

        {/* BODY */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '200px 1fr' }}>
          <div style={{ padding: isMobile ? '28px 20px 12px' : '48px 24px 48px 64px', borderRight: isMobile ? 'none' : '1px dashed #b9b4a5', borderBottom: isMobile ? '1px dashed #d8d3c3' : 'none', fontSize: 12, color: '#6d685c', lineHeight: isMobile ? 1.6 : 2 }}>
            EXHIBIT C<br />— the resume{!isMobile && <><br /><br />filed by:<br />the candidate</>}
          </div>

          <div style={{ padding: isMobile ? '28px 20px 40px' : '48px 64px 56px' }}>
            <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(1.6rem, 5.5vw, 2.125rem)', lineHeight: 1.2, fontWeight: 400, letterSpacing: '-0.02em' }}>
              Enter your resume <span style={{ background: '#1c1b18', color: '#fbfaf6', padding: '0 10px' }}>into evidence.</span>
            </h1>
            <p style={{ margin: isMobile ? '0 0 28px' : '0 0 40px', fontSize: 13.5, lineHeight: 1.8, color: '#54503f', maxWidth: 560 }}>
              The examiner reads it before proceedings begin. Questions are drawn from the record you submit — not from a script.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 32 : 44, alignItems: 'start' }}>

              {/* THE EXHIBIT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 11, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>THE EXHIBIT</div>

                <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={handleFileInput} style={{ display: 'none' }} />

                {showDropzone && (
                  <>
                    <div
                      onClick={openFilePicker}
                      onMouseEnter={() => setHovered('dropzone')}
                      onMouseLeave={() => setHovered(null)}
                      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      style={{ border: `1px dashed ${dzHot ? '#1c1b18' : '#b9b4a5'}`, background: dzHot ? '#f4f0e4' : 'transparent', padding: isMobile ? '40px 20px' : '52px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s, background .2s' }}
                    >
                      <div style={{ fontSize: 14.5, fontWeight: 600 }}>Drag resume here to file</div>
                      <div style={{ fontSize: 12, color: '#6d685c' }}>.pdf / .md · max 10 MB</div>
                      <div
                        onMouseEnter={(e) => { e.stopPropagation(); setHovered('browse'); }}
                        onMouseLeave={() => setHovered('dropzone')}
                        style={{ marginTop: 8, border: '1px solid #1c1b18', padding: '9px 20px', fontSize: 12, fontWeight: 600, background: hovered === 'browse' ? '#1c1b18' : 'transparent', color: hovered === 'browse' ? '#fbfaf6' : '#1c1b18', transition: 'background .2s, color .2s', minHeight: isMobile ? 44 : undefined, display: 'inline-flex', alignItems: 'center' }}
                      >
                        [browse files]
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#6d685c' }}>
                      no file at hand?{' '}
                      <button type="button" onClick={() => setPasteMode(true)} style={{ color: '#b3402a', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', minHeight: isMobile ? 44 : undefined }}>
                        [paste resume text into the record]
                      </button>
                    </div>
                  </>
                )}

                {showPaste && (
                  <>
                    <textarea
                      value={resumeText}
                      onChange={(e) => onResumeTextChange(e.target.value)}
                      onFocus={() => setFocused('paste')}
                      onBlur={() => setFocused(null)}
                      placeholder="Paste the full text of your resume here. The examiner reads every line."
                      style={{ background: 'transparent', border: `1px solid ${focused === 'paste' ? '#1c1b18' : '#b9b4a5'}`, color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.7, padding: '13px 15px', minHeight: 180, resize: 'vertical', outline: 'none', transition: 'border-color .2s' }}
                    />
                    <div style={{ fontSize: 12, color: '#6d685c' }}>
                      have the document after all?{' '}
                      <button type="button" onClick={() => setPasteMode(false)} style={{ color: '#b3402a', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', minHeight: isMobile ? 44 : undefined }}>
                        [file it as an exhibit instead]
                      </button>
                    </div>
                  </>
                )}

                {showParsing && (
                  <>
                    <div style={{ border: '1px dashed #b9b4a5', padding: isMobile ? '40px 20px' : '52px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                      <div style={{ fontSize: 12, letterSpacing: '0.18em', color: '#6d685c', fontWeight: 700, animation: 'hpPulseFade 1.4s ease-in-out infinite' }}>ENTERING INTO EVIDENCE…</div>
                      <div style={{ width: '70%', height: 8, border: '1px solid #1c1b18' }}>
                        <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg, #b3402a 0 3px, transparent 3px 6px)', animation: 'hpPulseFade 1.4s ease-in-out infinite' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8471', lineHeight: 1.7 }}>[clerk&apos;s note: reading the document — one moment]</div>
                  </>
                )}

                {showConfirmation && (
                  <>
                    <div style={{ position: 'relative', border: '1px solid #1c1b18', background: '#efe9d5', padding: '26px 28px' }}>
                      <div style={{ position: 'absolute', top: -14, right: 18, transform: 'rotate(-6deg)', border: '2.5px solid #b3402a', color: '#b3402a', background: '#fbfaf6', fontSize: 12, fontWeight: 700, letterSpacing: '0.22em', padding: '5px 12px' }}>
                        RECEIVED
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedFileName}</div>
                      <div style={{ fontSize: 12, color: '#54503f', marginTop: 8, lineHeight: 1.7 }}>
                        entered into evidence ✓
                        {parseSummary && <><br />{parseSummary}</>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6d685c', marginTop: 12 }}>
                        <button type="button" onClick={onFileClear} style={{ color: '#b3402a', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', minHeight: isMobile ? 44 : undefined }}>
                          [withdraw]
                        </button>
                        {' · '}
                        <button type="button" onClick={openFilePicker} style={{ color: '#b3402a', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', minHeight: isMobile ? 44 : undefined }}>
                          [substitute another]
                        </button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a8471', lineHeight: 1.7 }}>[clerk&apos;s note: expect the examiner to quote this document back to you]</div>
                  </>
                )}

                {parseState === 'error' && !showConfirmation && (
                  <div style={{ border: '1px solid #b3402a', color: '#b3402a', padding: '12px 15px', fontSize: 12, lineHeight: 1.7 }}>
                    [clerk&apos;s objection: that document could not be read into the record — file a .pdf or .md, or paste the text instead]
                  </div>
                )}
              </div>

              {/* TARGET FIELDS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <label style={{ fontSize: 11, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>IN RE: TARGET ROLE</label>
                  <input
                    value={role}
                    onChange={(e) => onRoleChange(e.target.value)}
                    onFocus={() => setFocused('role')}
                    onBlur={() => setFocused(null)}
                    placeholder="Senior Frontend Engineer"
                    style={{ background: 'transparent', border: `1px solid ${focused === 'role' ? '#1c1b18' : '#b9b4a5'}`, color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 14, padding: '13px 15px', outline: 'none', transition: 'border-color .2s', minHeight: isMobile ? 44 : undefined, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <label style={{ fontSize: 11, letterSpacing: '0.18em', color: '#b3402a', fontWeight: 700 }}>LEVEL</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {LEVELS.map(({ value, label }) => {
                      const selected = level === value;
                      const hot = hovered === `level-${value}`;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => onLevelChange(value)}
                          onMouseEnter={() => setHovered(`level-${value}`)}
                          onMouseLeave={() => setHovered(null)}
                          style={selected
                            ? { border: '1px solid #1c1b18', background: '#1c1b18', color: '#fbfaf6', padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined }
                            : { border: `1px dashed ${hot ? '#1c1b18' : '#b9b4a5'}`, background: 'none', padding: '10px 18px', fontSize: 12, color: hot ? '#1c1b18' : '#6d685c', cursor: 'pointer', transition: 'border-color .2s, color .2s', fontFamily: 'inherit', minHeight: isMobile ? 44 : undefined }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  <label style={{ fontSize: 11, letterSpacing: '0.18em', color: '#6d685c', fontWeight: 700 }}>
                    ATTACHMENT — JOB DESCRIPTION <span style={{ letterSpacing: '0.06em', fontWeight: 400, color: '#8a8471' }}>(optional)</span>
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => onJobDescriptionChange(e.target.value)}
                    onFocus={() => setFocused('jd')}
                    onBlur={() => setFocused(null)}
                    placeholder="Paste the posting. The examiner will probe against what the role actually demands."
                    style={{ background: 'transparent', border: `1px solid ${focused === 'jd' ? '#1c1b18' : '#b9b4a5'}`, color: '#1c1b18', fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: 12.5, lineHeight: 1.7, padding: '13px 15px', minHeight: 104, resize: 'vertical', outline: 'none', transition: 'border-color .2s' }}
                  />
                </div>
              </div>
            </div>

            {/* ACTIONS */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column-reverse' : 'row', alignItems: isMobile ? 'stretch' : 'center', justifyContent: 'space-between', gap: isMobile ? 16 : 0, marginTop: 48, paddingTop: 26, borderTop: '1px dashed #b9b4a5' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMobile ? 'stretch' : 'flex-start' }}>
                <button type="button" onClick={onUseOpenRehearsal} style={{ fontSize: 12, color: '#b3402a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: isMobile ? 'center' : 'left', minHeight: 32 }}>
                  ← return to open rehearsal brief
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  onMouseEnter={() => setHovered('skip')}
                  onMouseLeave={() => setHovered(null)}
                  style={{ fontSize: 12, color: hovered === 'skip' ? '#b3402a' : '#8a8471', transition: 'color .2s', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: isMobile ? 'center' : 'left', minHeight: 32 }}
                >
                  proceed without exhibits →
                </button>
              </div>
              <button
                type="button"
                onClick={onContinue}
                disabled={!canContinue}
                onMouseEnter={() => setHovered('continue')}
                onMouseLeave={() => setHovered(null)}
                style={{ display: 'inline-block', background: !canContinue ? '#d8d3c3' : hovered === 'continue' ? '#b3402a' : '#1c1b18', color: !canContinue ? '#8a8471' : '#fbfaf6', padding: '15px 30px', fontSize: 13.5, fontWeight: 700, border: 'none', cursor: canContinue ? 'pointer' : 'not-allowed', transition: 'background .2s', fontFamily: 'inherit', minHeight: 44 }}
              >
                PROCEED TO ELECTION →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptResumeUpload;
