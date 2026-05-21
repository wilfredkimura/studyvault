import { useState, useEffect } from 'react';
import { 
  Download, 
  BookOpen, 
  Folder, 
  RefreshCw, 
  Sparkles, 
  CheckCircle, 
  Cpu, 
  Bookmark, 
  Edit3, 
  Play
} from 'lucide-react';

const GithubIcon = ({ size = 16 }: { size?: number }) => (
  <svg 
    height={size} 
    width={size} 
    viewBox="0 0 16 16" 
    fill="currentColor" 
    style={{ display: 'inline-block', verticalAlign: 'text-bottom' }}
  >
    <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

interface MockDoc {
  id: string;
  name: string;
  type: string;
  folder: string;
  path: string;
  size: string;
  content: string;
}

interface ConversionRecord {
  id: string;
  source_name: string;
  output_name: string;
  output_path: string;
  status: string;
  output_id: string;
}

interface ReadingHistoryRecord {
  file_id: string;
  name: string;
  type: string;
  last_page: number;
  updated_at: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'reader' | 'converter' | 'history'>('library');
  const [selectedFolder, setSelectedFolder] = useState<'all' | 'lectures' | 'research' | 'uncategorized'>('all');
  const [latestRelease, setLatestRelease] = useState<{ version: string; installerUrl: string; portableUrl: string }>({
    version: 'v1.0.0',
    installerUrl: 'https://github.com/wilfredkimura/studyvault/releases/download/v1.0.0/StudyVault_Setup_1.0.0.exe',
    portableUrl: 'https://github.com/wilfredkimura/studyvault/releases/download/v1.0.0/StudyVault_1.0.0.exe'
  });

  // Simulator State
  const [documents, setDocuments] = useState<MockDoc[]>([
    {
      id: 'doc-1',
      name: 'Distributed Systems Lecture 03.pdf',
      type: 'pdf',
      folder: 'lectures',
      path: 'C:/Users/kimushzyyy/Documents/studyvault/library/Distributed Systems Lecture 03.pdf',
      size: '2.4 MB',
      content: 'This lecture covers the CAP Theorem (Consistency, Availability, Partition Tolerance). In any distributed system, you can only guarantee two out of the three. We will discuss Paxos, Raft, and basic database replication strategies.'
    },
    {
      id: 'doc-2',
      name: 'Deep Learning Architectures Survey.pdf',
      type: 'pdf',
      folder: 'research',
      path: 'C:/Users/kimushzyyy/Documents/studyvault/library/Deep Learning Architectures Survey.pdf',
      size: '4.8 MB',
      content: 'A survey of modern transformer architectures, including attention mechanics, self-attention, and sequence-to-sequence modeling. We explore scale laws, optimization functions, and computational trade-offs.'
    },
    {
      id: 'doc-3',
      name: 'Intro to Computer Graphics.pptx',
      type: 'pptx',
      folder: 'lectures',
      path: 'C:/Users/kimushzyyy/Documents/studyvault/library/Intro to Computer Graphics.pptx',
      size: '12.1 MB',
      content: 'Welcome to Computer Graphics! Today we cover rasterization, raytracing, homogeneous coordinates, and matrix translations. Slide 1: Course Introduction. Slide 2: Rendering pipeline. Slide 3: Vertex shader vs fragment shader.'
    },
    {
      id: 'doc-4',
      name: 'Unorganized Research Notes.docx',
      type: 'docx',
      folder: '', // No folder = Uncategorized
      path: 'C:/Users/kimushzyyy/Documents/studyvault/library/Unorganized Research Notes.docx',
      size: '154 KB',
      content: 'Rough thoughts on multi-agent execution, local-first database syncing, and Electron desktop shell structures using SQLite as a main backend database.'
    }
  ]);

  const [readingDoc, setReadingDoc] = useState<MockDoc>(documents[0]);
  const [readerViewMode, setReaderViewMode] = useState<'image' | 'text'>('image');
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({
    'doc-1': ['Page 1: Note - Remember CAP theorem limits for exam!', 'Page 2: Highlight - Paxos consensus algorithm details'],
    'doc-2': ['Page 1: Highlight - Multi-head attention formula'],
    'doc-3': ['Page 1: Note - Learn the difference between orthographic and perspective projection']
  });
  const [newAnnotationText, setNewAnnotationText] = useState('');
  
  // AI summarizer state
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeProgress, setSummarizeProgress] = useState(0);

  // Conversion state
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [externalFile, setExternalFile] = useState<{ name: string; type: string; path: string; size: string } | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [conversionLogs, setConversionLogs] = useState<ConversionRecord[]>([
    {
      id: 'conv-1',
      source_name: 'Syllabus_Fall_2026.docx',
      output_name: 'Syllabus_Fall_2026.pdf',
      output_path: 'C:/Users/kimushzyyy/Documents/studyvault/converted/Syllabus_Fall_2026.pdf',
      status: 'success',
      output_id: 'doc-1' // points to a viewable file
    }
  ]);

  // Reading history state
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryRecord[]>([
    { file_id: 'doc-1', name: 'Distributed Systems Lecture 03.pdf', type: 'pdf', last_page: 3, updated_at: '10 mins ago' },
    { file_id: 'doc-3', name: 'Intro to Computer Graphics.pptx', type: 'pptx', last_page: 1, updated_at: 'Yesterday' }
  ]);

  // Fetch latest release from GitHub API
  useEffect(() => {
    fetch('https://api.github.com/repos/wilfredkimura/studyvault/releases/latest')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch release info');
        return res.json();
      })
      .then(data => {
        const tag = data.tag_name || 'v1.0.0';
        let installer = '';
        let portable = '';
        
        if (data.assets && Array.isArray(data.assets)) {
          const instAsset = data.assets.find((a: any) => a.name.includes('Setup') && a.name.endsWith('.exe'));
          const portAsset = data.assets.find((a: any) => !a.name.includes('Setup') && a.name.endsWith('.exe'));
          
          if (instAsset) installer = instAsset.browser_download_url;
          if (portAsset) portable = portAsset.browser_download_url;
        }

        // Fallbacks if assets are not matched perfectly
        if (!installer) {
          installer = `https://github.com/wilfredkimura/studyvault/releases/download/${tag}/StudyVault_Setup_${tag.replace('v', '')}.exe`;
        }
        if (!portable) {
          portable = `https://github.com/wilfredkimura/studyvault/releases/download/${tag}/StudyVault_${tag.replace('v', '')}.exe`;
        }

        setLatestRelease({
          version: tag,
          installerUrl: installer,
          portableUrl: portable
        });
      })
      .catch(err => {
        console.warn('Using fallback release URLs:', err);
      });
  }, []);

  // Filtered documents
  const filteredDocs = documents.filter(doc => {
    if (selectedFolder === 'all') return true;
    if (selectedFolder === 'uncategorized') return doc.folder === '';
    return doc.folder === selectedFolder;
  });

  // Handle open document in Reader
  const openInReader = (doc: MockDoc) => {
    setReadingDoc(doc);
    setActiveTab('reader');
    
    // Add to history or update it
    setReadingHistory(prev => {
      const filtered = prev.filter(h => h.file_id !== doc.id);
      return [
        { file_id: doc.id, name: doc.name, type: doc.type, last_page: 1, updated_at: 'Just now' },
        ...filtered
      ];
    });
  };

  // Handle Add Annotation
  const addAnnotation = () => {
    if (!newAnnotationText.trim()) return;
    setAnnotations(prev => {
      const currentList = prev[readingDoc.id] || [];
      return {
        ...prev,
        [readingDoc.id]: [...currentList, `Page 1: Note - ${newAnnotationText}`]
      };
    });
    setNewAnnotationText('');
  };

  // Handle AI summarization simulation
  const handleSummarize = () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setSummarizeProgress(0);
    
    const interval = setInterval(() => {
      setSummarizeProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSummarizing(false);
          setSummaries(s => ({
            ...s,
            [readingDoc.id]: `### AI Page Summary (Gemini 2.5 Flash)\n\n• **Core Topic**: ${readingDoc.name.replace('.pdf','').replace('.pptx','')}\n• **Key Concepts**: Discusses the central architecture, key data attributes, and engineering methodologies mentioned in the material.\n• **Important Insights**: \n  - Details essential structural mechanisms.\n  - Analyzes the efficiency of local-first paradigms.\n  - Notes specific implementation parameters relevant to examinations and research.`
          }));
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Handle mock file conversion
  const handleConvert = () => {
    let sourceName = '';
    
    if (externalFile) {
      sourceName = externalFile.name;
    } else if (selectedFileId) {
      const doc = documents.find(d => d.id === selectedFileId);
      if (doc) {
        sourceName = doc.name;
      }
    }

    if (!sourceName) return;

    setIsConverting(true);
    setConvertProgress(0);

    const interval = setInterval(() => {
      setConvertProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsConverting(false);
          
          const outputName = sourceName.substring(0, sourceName.lastIndexOf('.')) + '.pdf';
          const newDocId = `doc-${Date.now()}`;
          const newDocPath = `C:/Users/kimushzyyy/Documents/studyvault/converted/${outputName}`;
          
          // Add to mock documents
          const newDoc: MockDoc = {
            id: newDocId,
            name: outputName,
            type: 'pdf',
            folder: 'lectures',
            path: newDocPath,
            size: externalFile ? externalFile.size : '1.5 MB',
            content: `Converted PDF version of ${sourceName}. Fully indexed and ready for layout reading & annotation.`
          };
          
          setDocuments(prevDocs => [...prevDocs, newDoc]);

          // Add to conversion logs
          setConversionLogs(prevLogs => [
            {
              id: `conv-${Date.now()}`,
              source_name: sourceName,
              output_name: outputName,
              output_path: newDocPath,
              status: 'success',
              output_id: newDocId
            },
            ...prevLogs
          ]);

          setSelectedFileId('');
          setExternalFile(null);
          return 100;
        }
        return prev + 20;
      });
    }, 200);
  };

  // Handle Mock Browse External File
  const handleBrowseExternal = () => {
    const filenames = [
      { name: 'Lecture_Distributed_Systems.pptx', size: '6.4 MB', type: 'pptx' },
      { name: 'Thesis_Draft_V2.docx', size: '1.2 MB', type: 'docx' },
      { name: 'Algorithm_Design_Manual.epub', size: '4.5 MB', type: 'epub' }
    ];
    // Cycle pick one randomly
    const randomPick = filenames[Math.floor(Math.random() * filenames.length)];
    setExternalFile({
      name: randomPick.name,
      type: randomPick.type,
      path: `C:/Users/kimushzyyy/Downloads/${randomPick.name}`,
      size: randomPick.size
    });
    setSelectedFileId('');
  };

  // Handle Rename converted doc
  const handleRename = (id: string, currentName: string) => {
    const newName = prompt('Enter new filename:', currentName);
    if (newName && newName.trim() && newName.trim() !== currentName) {
      const trimmed = newName.trim();
      // Update documents
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, name: trimmed } : d));
      // Update logs
      setConversionLogs(prev => prev.map(log => log.output_id === id ? { ...log, output_name: trimmed, output_path: log.output_path.replace(currentName, trimmed) } : log));
    }
  };

  return (
    <div className="app-container">
      {/* Background glow effects */}
      <div className="background-glow"></div>

      {/* Navigation Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(12, 10, 18, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-outline-variant)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '70px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
            width: '32px',
            height: '32px',
            borderRadius: 'var(--rounded-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-on-primary)',
            fontWeight: 'bold',
            fontSize: '18px'
          }}>S</div>
          <span style={{
            fontFamily: 'var(--font-family-display)',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(to right, #fff, var(--color-primary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>StudyVault</span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <a href="#features" style={{ color: 'var(--color-on-surface-variant)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}>Features</a>
          <a href="#simulator" style={{ color: 'var(--color-on-surface-variant)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}>Interactive Demo</a>
          <a href="#tutorial" style={{ color: 'var(--color-on-surface-variant)', textDecoration: 'none', fontSize: '14px', fontWeight: 500, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}>Tutorial</a>
          
          {/* GitHub Handle Icon Link */}
          <a 
            href="https://github.com/wilfredkimura/studyvault" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--color-on-surface-variant)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              textDecoration: 'none', 
              fontSize: '14px', 
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: 'var(--rounded-default)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--color-outline-variant)'
            }}
            title="Visit developer's GitHub: wilfredkimura"
          >
            <GithubIcon size={16} />
            <span style={{ fontSize: '12px' }}>wilfredkimura</span>
          </a>
        </nav>

        <div>
          <a href="#download" className="glass-panel" style={{
            background: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 600,
            padding: '8px 18px',
            borderRadius: 'var(--rounded-default)',
            border: 'none',
            cursor: 'pointer'
          }}>Get StudyVault</a>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', flex: 1 }}>
        
        {/* HERO SECTION */}
        <section style={{
          padding: '80px 0 60px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{
            background: 'rgba(200, 191, 255, 0.1)',
            border: '1px solid rgba(200, 191, 255, 0.2)',
            color: 'var(--color-primary)',
            padding: '6px 16px',
            borderRadius: 'var(--rounded-full)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={14} /> Local-first academic research vault
          </div>

          <h1 className="display-lg" style={{ maxWidth: '800px', marginBottom: '24px', color: '#fff' }}>
            Academic vault for your study material.
          </h1>

          <p className="body-lg" style={{
            maxWidth: '650px',
            color: 'var(--color-on-surface-variant)',
            marginBottom: '40px',
            lineHeight: 1.6
          }}>
            Offline-first document organizer with local SQLite integration, automatic file conversion (PDF/PPTX), and AI-powered summarization. Mimics your local file structure and keeps your data 100% private.
          </p>

          {/* Download buttons */}
          <div id="download" style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <a 
              href={latestRelease.installerUrl}
              className="btn-pulse"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                color: 'var(--color-on-primary)',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '15px',
                padding: '14px 28px',
                borderRadius: 'var(--rounded-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 20px rgba(200, 191, 255, 0.3)'
              }}
            >
              <Download size={18} />
              Download Installer (Windows)
            </a>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--color-outline)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Latest build: <strong>{latestRelease.version}</strong></span>
            <span>•</span>
            <span>Direct download from GitHub releases without redirections</span>
          </div>
        </section>

        {/* INTERACTIVE SIMULATOR (THE APP TUTORIAL) */}
        <section id="simulator" style={{ padding: '60px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 className="headline-lg" style={{ color: '#fff', marginBottom: '12px' }}>Interactive App Simulator</h2>
            <p className="body-md" style={{ color: 'var(--color-on-surface-variant)', maxWidth: '600px', margin: '0 auto' }}>
              Explore the exact UI and features of the StudyVault desktop app right here in your browser. Click the sidebar icons to try different workflows.
            </p>
          </div>

          {/* App Window container */}
          <div className="mockup-app">
            {/* Title Bar */}
            <div className="mockup-header">
              <div className="mockup-dots">
                <div className="mockup-dot"></div>
                <div className="mockup-dot"></div>
                <div className="mockup-dot"></div>
              </div>
              <div className="mockup-title">StudyVault Desktop App</div>
              <div style={{
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: 'var(--rounded-full)',
                background: 'rgba(200, 191, 255, 0.1)',
                color: 'var(--color-primary)',
                fontFamily: 'monospace'
              }}>OFFLINE-MODE</div>
            </div>

            {/* Application Body */}
            <div className="mockup-body">
              {/* Sidebar */}
              <div className="mockup-sidebar">
                <div 
                  className={`mockup-sidebar-item ${activeTab === 'library' ? 'active' : ''}`}
                  onClick={() => setActiveTab('library')}
                >
                  <Folder size={16} />
                  <span>Library</span>
                </div>
                <div 
                  className={`mockup-sidebar-item ${activeTab === 'reader' ? 'active' : ''}`}
                  onClick={() => setActiveTab('reader')}
                >
                  <BookOpen size={16} />
                  <span>Reader</span>
                </div>
                <div 
                  className={`mockup-sidebar-item ${activeTab === 'converter' ? 'active' : ''}`}
                  onClick={() => setActiveTab('converter')}
                >
                  <RefreshCw size={16} />
                  <span>File Conversion</span>
                </div>
                <div 
                  className={`mockup-sidebar-item ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  <Bookmark size={16} />
                  <span>Reader History</span>
                </div>

                <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '10px', fontSize: '11px', color: 'var(--color-outline)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px' }}>
                    <Cpu size={12} />
                    <span>Gemini 2.5 Flash</span>
                  </div>
                </div>
              </div>

              {/* App Main Content Area */}
              <div className="mockup-content">
                
                {/* 1. LIBRARY TAB */}
                {activeTab === 'library' && (
                  <div style={{ display: 'flex', gap: '20px', height: '100%' }}>
                    {/* Folders List Sidebar */}
                    <div style={{ width: '160px', display: 'flex', flexDirection: 'column', gap: '6px', borderRight: '1px solid var(--color-outline-variant)', paddingRight: '12px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--color-outline)', fontWeight: 'bold', marginBottom: '4px' }}>FOLDERS</div>
                      <button 
                        onClick={() => setSelectedFolder('all')}
                        style={{
                          background: selectedFolder === 'all' ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', color: selectedFolder === 'all' ? '#fff' : 'var(--color-on-surface-variant)',
                          padding: '6px 8px', borderRadius: '4px', textAlign: 'left', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📂 All Files
                      </button>
                      <button 
                        onClick={() => setSelectedFolder('lectures')}
                        style={{
                          background: selectedFolder === 'lectures' ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', color: selectedFolder === 'lectures' ? '#fff' : 'var(--color-on-surface-variant)',
                          padding: '6px 8px', borderRadius: '4px', textAlign: 'left', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📂 Lecture Slides
                      </button>
                      <button 
                        onClick={() => setSelectedFolder('research')}
                        style={{
                          background: selectedFolder === 'research' ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', color: selectedFolder === 'research' ? '#fff' : 'var(--color-on-surface-variant)',
                          padding: '6px 8px', borderRadius: '4px', textAlign: 'left', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📂 Research Papers
                      </button>
                      <button 
                        onClick={() => setSelectedFolder('uncategorized')}
                        style={{
                          background: selectedFolder === 'uncategorized' ? 'rgba(255,255,255,0.06)' : 'transparent',
                          border: 'none', color: selectedFolder === 'uncategorized' ? '#fff' : 'var(--color-on-surface-variant)',
                          padding: '6px 8px', borderRadius: '4px', textAlign: 'left', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                      >
                        📂 Uncategorized
                      </button>
                    </div>

                    {/* Documents List */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                          {selectedFolder === 'all' && 'All Library Documents'}
                          {selectedFolder === 'lectures' && 'Lecture Slides'}
                          {selectedFolder === 'research' && 'Research Papers'}
                          {selectedFolder === 'uncategorized' && 'Uncategorized (No Folder)'}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>{filteredDocs.length} items</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', overflowY: 'auto' }}>
                        {filteredDocs.map(doc => (
                          <div 
                            key={doc.id}
                            onClick={() => openInReader(doc)}
                            style={{
                              background: 'var(--color-surface-container-low)',
                              border: '1px solid var(--color-outline-variant)',
                              borderRadius: 'var(--rounded-default)',
                              padding: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--color-primary)';
                              e.currentTarget.style.background = 'var(--color-surface-container-high)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                              e.currentTarget.style.background = 'var(--color-surface-container-low)';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                background: doc.type === 'pdf' ? '#e57373' : doc.type === 'pptx' ? '#ffb74d' : '#81c784',
                                color: '#000', fontSize: '9px', fontWeight: 'bold', padding: '2px 4px', borderRadius: '3px'
                              }}>{doc.type.toUpperCase()}</span>
                              <span style={{ fontSize: '10px', color: 'var(--color-outline)' }}>{doc.size}</span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface)', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '36px' }}>
                              {doc.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-outline)', marginTop: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {doc.path}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. READER TAB */}
                {activeTab === 'reader' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    {/* Reader Topbar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '10px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>READING</span>
                        <div style={{ fontSize: '13px', fontWeight: 600, maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{readingDoc.name}</div>
                      </div>

                      {/* Mode Toggles */}
                      <div style={{ display: 'flex', background: 'var(--color-surface-container-low)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-outline-variant)' }}>
                        <button 
                          onClick={() => setReaderViewMode('image')}
                          style={{
                            background: readerViewMode === 'image' ? 'var(--color-surface-container-highest)' : 'transparent',
                            color: readerViewMode === 'image' ? '#fff' : 'var(--color-on-surface-variant)',
                            border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          Layout View (Slides/Images)
                        </button>
                        <button 
                          onClick={() => setReaderViewMode('text')}
                          style={{
                            background: readerViewMode === 'text' ? 'var(--color-surface-container-highest)' : 'transparent',
                            color: readerViewMode === 'text' ? '#fff' : 'var(--color-on-surface-variant)',
                            border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          Text View
                        </button>
                      </div>
                    </div>

                    {/* Reader Main Content */}
                    <div style={{ display: 'flex', flex: 1, gap: '14px', overflow: 'hidden' }}>
                      {/* Left: View Panel */}
                      <div style={{ flex: 1, background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-default)', padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                        
                        {readerViewMode === 'image' ? (
                          /* Layout View Mockup (Maintaining source layouts for PPTX and PDF) */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                            {readingDoc.type === 'pptx' ? (
                              /* Mock PPTX Slide presentation style */
                              <div style={{
                                width: '100%',
                                maxWidth: '380px',
                                aspectRatio: '16/9',
                                background: '#1c1a23',
                                border: '2px solid var(--color-primary-container)',
                                borderRadius: 'var(--rounded-default)',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                position: 'relative',
                                boxShadow: '0 6px 16px rgba(0,0,0,0.3)'
                              }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--color-primary)', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '4px' }}>
                                  🎨 Introduction to Computer Graphics
                                </div>
                                <div style={{ fontSize: '10px', lineHeight: 1.4, color: 'var(--color-on-surface-variant)' }}>
                                  • Rasterization vs Raytracing<br/>
                                  • Matrix Math & homogeneous coordinates [x, y, z, w]<br/>
                                  • Vertex shader & Fragment processing logic
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: 'var(--color-outline)' }}>
                                  <span>Slide 1 of 12</span>
                                  <span>StudyVault Rich Layout</span>
                                </div>
                              </div>
                            ) : (
                              /* Mock PDF page layout */
                              <div style={{
                                width: '100%',
                                maxWidth: '340px',
                                aspectRatio: '1/1.41',
                                background: '#f5f5f5',
                                color: '#111',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                padding: '24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
                                fontSize: '10px'
                              }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #ccc', paddingBottom: '6px' }}>Distributed Consensus & CAP</div>
                                <div style={{ height: '8px', background: '#e0e0e0', width: '80%' }}></div>
                                <div style={{ height: '8px', background: '#e0e0e0', width: '90%' }}></div>
                                <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
                                  <div style={{ width: '40px', height: '40px', background: '#ccc', borderRadius: '3px' }}></div>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ height: '6px', background: '#e0e0e0' }}></div>
                                    <div style={{ height: '6px', background: '#e0e0e0' }}></div>
                                    <div style={{ height: '6px', background: '#e0e0e0' }}></div>
                                  </div>
                                </div>
                                <div style={{ height: '8px', background: '#e0e0e0' }}></div>
                                <div style={{ height: '8px', background: '#e0e0e0' }}></div>
                                <div style={{ marginTop: 'auto', textAlign: 'center', color: '#888', fontSize: '8px' }}>Page 1 of 44</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Text View Mockup */
                          <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--color-on-surface-variant)' }}>
                            <p style={{ fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>📚 EXTRACTED PLAIN TEXT:</p>
                            {readingDoc.content}
                          </div>
                        )}
                      </div>

                      {/* Right Sidebar: AI Summary & Annotations */}
                      <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                        
                        {/* Summary Block */}
                        <div style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-default)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={11} /> AI Summarizer
                            </span>
                          </div>

                          {isSummarizing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>Querying Gemini 2.5 Flash...</div>
                              <div style={{ width: '100%', height: '4px', background: 'var(--color-surface-container-highest)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${summarizeProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.1s' }}></div>
                              </div>
                            </div>
                          ) : summaries[readingDoc.id] ? (
                            <div style={{ fontSize: '10px', lineHeight: 1.4, color: 'var(--color-on-surface-variant)', maxHeight: '110px', overflowY: 'auto', background: 'rgba(0,0,0,0.1)', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                              {summaries[readingDoc.id]}
                            </div>
                          ) : (
                            <button 
                              onClick={handleSummarize}
                              style={{
                                background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)',
                                border: 'none', borderRadius: '4px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                              }}
                            >
                              <Sparkles size={12} /> Summarize Page
                            </button>
                          )}
                        </div>

                        {/* Annotations Block */}
                        <div style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-default)', padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>📝 Page Annotations</span>
                          
                          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '80px', maxHeight: '140px' }}>
                            {(annotations[readingDoc.id] || []).length > 0 ? (
                              (annotations[readingDoc.id] || []).map((ann, idx) => (
                                <div key={idx} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '4px', borderLeft: '2px solid var(--color-secondary)' }}>
                                  {ann}
                                </div>
                              ))
                            ) : (
                              <div style={{ fontSize: '10px', color: 'var(--color-outline)', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>No annotations yet.</div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '4px', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '6px' }}>
                            <input 
                              type="text" 
                              placeholder="Add a study note..."
                              value={newAnnotationText}
                              onChange={e => setNewAnnotationText(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && addAnnotation()}
                              style={{
                                flex: 1, background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                                color: '#fff', fontSize: '10px', padding: '4px 6px', borderRadius: '4px', outline: 'none'
                              }}
                            />
                            <button 
                              onClick={addAnnotation}
                              style={{
                                background: 'var(--color-secondary)', color: 'var(--color-on-secondary)',
                                border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer'
                              }}
                            >
                              Add
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}

                {/* 3. FILE CONVERTER TAB */}
                {activeTab === 'converter' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Offline Document Converter</div>

                    {/* Convert Input */}
                    <div style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-default)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button 
                          onClick={handleBrowseExternal}
                          style={{
                            background: 'var(--color-surface-container-highest)', color: '#fff',
                            border: '1px solid var(--color-outline-variant)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 500
                          }}
                        >
                          📂 Browse External File...
                        </button>
                        <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>or select from library below</span>
                      </div>

                      {/* Display Selected external file */}
                      {externalFile && (
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(200, 191, 255, 0.05)', border: '1px dashed var(--color-primary)', padding: '6px 12px', borderRadius: '4px', fontSize: '12px' }}>
                          <span style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{externalFile.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '8px' }}>({externalFile.size})</span>
                          <button onClick={() => setExternalFile(null)} style={{ background: 'none', border: 'none', color: '#ff5f56', marginLeft: 'auto', cursor: 'pointer' }}>✕</button>
                        </div>
                      )}

                      {!externalFile && (
                        <select 
                          value={selectedFileId} 
                          onChange={(e) => setSelectedFileId(e.target.value)}
                          style={{
                            width: '100%',
                            background: 'var(--color-surface-container-lowest)',
                            border: '1px solid var(--color-outline-variant)',
                            borderRadius: 'var(--rounded-default)',
                            padding: '8px',
                            color: '#fff',
                            fontSize: '13px'
                          }}
                        >
                          <option value="">-- Choose file from library --</option>
                          {documents.map(d => (
                            <option key={d.id} value={d.id}>{d.name} ({d.type.toUpperCase()})</option>
                          ))}
                        </select>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>Converts documents (.docx, .pptx, .epub, etc.) to uniform PDF locally.</span>
                        <button 
                          onClick={handleConvert}
                          disabled={!selectedFileId && !externalFile || isConverting}
                          style={{
                            background: (!selectedFileId && !externalFile) || isConverting ? 'var(--color-outline-variant)' : 'var(--color-primary)',
                            color: 'var(--color-on-primary)',
                            border: 'none', borderRadius: '4px', padding: '8px 20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer'
                          }}
                        >
                          {isConverting ? `Converting (${convertProgress}%)` : 'Convert to PDF'}
                        </button>
                      </div>

                      {/* Convert progress bar */}
                      {isConverting && (
                        <div style={{ width: '100%', height: '4px', background: 'var(--color-surface-container-lowest)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${convertProgress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s' }}></div>
                        </div>
                      )}
                    </div>

                    {/* Conversion Logs */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--color-outline)' }}>CONVERSION LOGS</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {conversionLogs.map(log => {
                          const doc = documents.find(d => d.id === log.output_id);
                          return (
                            <div 
                              key={log.id}
                              style={{
                                background: 'var(--color-surface-container-low)',
                                border: '1px solid var(--color-outline-variant)',
                                borderRadius: 'var(--rounded-default)',
                                padding: '10px 14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>Source: <strong>{log.source_name}</strong></span>
                                <span style={{ fontSize: '10px', color: '#81c784', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <CheckCircle size={10} /> Success
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
                                <span>Output:</span>
                                {doc ? (
                                  <>
                                    <span 
                                      onClick={() => openInReader(doc)}
                                      style={{ color: 'var(--color-primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}
                                      title="Click to view in Reader"
                                    >
                                      {doc.name}
                                    </span>
                                    <button 
                                      onClick={() => handleRename(doc.id, doc.name)}
                                      style={{
                                        background: 'var(--color-surface-container-highest)', border: 'none', borderRadius: '3px',
                                        color: '#fff', fontSize: '9px', padding: '2px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px'
                                      }}
                                    >
                                      <Edit3 size={8} /> Rename
                                    </button>
                                  </>
                                ) : (
                                  <span>{log.output_name}</span>
                                )}
                              </div>

                              <div style={{ fontSize: '10px', color: 'var(--color-outline)' }}>
                                📂 Location: <code>{log.output_path}</code>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

                {/* 4. READER HISTORY TAB */}
                {activeTab === 'history' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Recently Read Documents</div>
                    <p style={{ fontSize: '11px', color: 'var(--color-outline)' }}>Resume study sessions from the exact page you last read.</p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                      {readingHistory.map(hist => {
                        const matchedDoc = documents.find(d => d.id === hist.file_id);
                        return (
                          <div 
                            key={hist.file_id}
                            style={{
                              background: 'var(--color-surface-container-low)',
                              border: '1px solid var(--color-outline-variant)',
                              borderRadius: 'var(--rounded-default)',
                              padding: '12px 16px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{hist.name}</span>
                              <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: 'var(--color-outline)' }}>
                                <span>Last read: Page <strong>{hist.last_page}</strong></span>
                                <span>•</span>
                                <span>{hist.updated_at}</span>
                              </div>
                            </div>

                            <button 
                              onClick={() => {
                                if (matchedDoc) {
                                  openInReader(matchedDoc);
                                }
                              }}
                              style={{
                                background: 'var(--color-secondary)',
                                color: 'var(--color-on-secondary)',
                                border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Play size={10} fill="currentColor" /> Resume
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </section>

        {/* FEATURES GRID SECTION */}
        <section id="features" style={{ padding: '60px 0', borderTop: '1px solid var(--color-outline-variant)' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="headline-lg" style={{ color: '#fff' }}>Premium Local-First Capabilities</h2>
          </div>

          <div className="features-grid">
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(200,191,255,0.1)', color: 'var(--color-primary)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <Folder size={20} />
              </div>
              <h3 className="headline-sm" style={{ color: '#fff' }}>Structured Local Library</h3>
              <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Keep your books, slides, and syllabus documents organized in sqlite tables. Folder selections persist automatically, and files with no category are structured neatly in Uncategorized slots.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(225,182,255,0.1)', color: 'var(--color-secondary)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <Cpu size={20} />
              </div>
              <h3 className="headline-sm" style={{ color: '#fff' }}>Gemini 2.5 Flash Summarizer</h3>
              <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Use your Google AI API key to generate fast summaries, ask queries, and index text contexts. Free from 404 client crashes with the latest API interfaces.
              </p>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'rgba(255,183,122,0.1)', color: 'var(--color-tertiary)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                <RefreshCw size={20} />
              </div>
              <h3 className="headline-sm" style={{ color: '#fff' }}>High Fidelity Local Converter</h3>
              <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
                Easily drag and drop or select external files (.docx, .pptx, etc.) from anywhere on your PC to convert to uniform PDFs with original layout structures.
              </p>
            </div>
          </div>
        </section>

        {/* TUTORIAL / SETUP SECTION */}
        <section id="tutorial" style={{ padding: '60px 0', borderTop: '1px solid var(--color-outline-variant)' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 className="headline-lg" style={{ color: '#fff' }}>Getting Started with StudyVault</h2>
            <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>
              Follow these simple steps to configure and boot your offline-first studying engine.
            </p>
          </div>

          <div style={{ maxWidth: '750px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)',
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
              }}>1</div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Download and Install</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                  Download the installation executable (`StudyVault Setup.exe`) and double-click to install. If you get a Windows SmartScreen warning, click **"More Info"** then **"Run Anyway"** since the installer is self-signed.
                </p>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)',
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
              }}>2</div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Configure your Gemini API Key (Optional)</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                  Go to settings and paste your Google Gemini API Key. This will unlock the offline-first text summaries and document analyses using the latest optimized `gemini-2.5-flash` model.
                </p>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{
                background: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)',
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0
              }}>3</div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Import & Study</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', lineHeight: 1.5 }}>
                  Drag syllabus outlines, lecture notes, or textbooks into the library. For slides and docs, use the File Conversion tab to render beautiful uniform layouts ready for full annotations.
                </p>
              </div>
            </div>

          </div>
        </section>

      </main>

      {/* Footer */}
      <footer style={{
        background: 'var(--color-surface-container-lowest)',
        borderTop: '1px solid var(--color-outline-variant)',
        padding: '30px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '60px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-outline)' }}>
            © 2026 StudyVault. All rights reserved. Created by **wilfredkimura**.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <a 
            href="https://github.com/wilfredkimura/studyvault" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--color-on-surface-variant)', 
              textDecoration: 'none', 
              fontSize: '13px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              transition: 'color 0.2s' 
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'} 
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-on-surface-variant)'}
          >
            <GithubIcon size={14} />
            <span>wilfredkimura/studyvault</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
