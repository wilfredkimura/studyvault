import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  RefreshCw, 
  Search, 
  Wand2, 
  History, 
  Settings, 
  FileText, 
  Tag, 
  Plus, 
  Bookmark, 
  Highlighter, 
  UploadCloud, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  ArrowRight,
  Send,
  FolderOpen
} from 'lucide-react';

// Expose Electron API context bridge types
declare global {
  interface Window {
    api?: {
      getDocuments: () => Promise<any[]>;
      addDocument: (doc: any) => Promise<any>;
      deleteDocument: (id: string) => Promise<any>;
      searchDocuments: (query: string) => Promise<any[]>;
      getTags: () => Promise<any[]>;
      addTag: (tag: { id: string; name: string; color: string }) => Promise<any>;
      tagFile: (fileId: string, tagId: string) => Promise<any>;
      untagFile: (fileId: string, tagId: string) => Promise<any>;
      getFileTags: (fileId: string) => Promise<any[]>;
      getAnnotations: (fileId: string) => Promise<any[]>;
      addAnnotation: (anno: any) => Promise<any>;
      deleteAnnotation: (id: string) => Promise<any>;
      getProgress: (fileId: string) => Promise<any>;
      saveProgress: (progress: { file_id: string; last_page: number; scroll_position: number }) => Promise<any>;
      getHistory: () => Promise<any[]>;
      addHistory: (record: any) => Promise<any>;
      getAiCache: (hash: string) => Promise<any>;
      saveAiCache: (cache: any) => Promise<any>;
      runWorkerCommand: (command: string, args: any) => Promise<any>;
      openFileDialog: () => Promise<any>;
    };
  }
}

// In-Memory Mock Database for Web/Test Fallback
const mockDb = {
  documents: [
    { id: '1', name: 'Quantum Physics Lecture 1.pdf', type: 'pdf', path: 'C:/docs/quantum.pdf', size: 1048576, created_at: '2026-05-19 14:02', updated_at: '2026-05-20 11:45', hash: 'q1', content_extracted: 'Quantum mechanics is a fundamental theory in physics.' },
    { id: '2', name: 'Organic Chemistry Lab Notes.docx', type: 'docx', path: 'C:/docs/chem.docx', size: 524288, created_at: '2026-05-18 09:30', updated_at: '2026-05-18 10:15', hash: 'c2', content_extracted: 'Carbon atoms form covalent bonds with other elements.' },
    { id: '3', name: 'Machine Learning Slides.pptx', type: 'pptx', path: 'C:/docs/ml.pptx', size: 4194304, created_at: '2026-05-15 16:45', updated_at: '2026-05-16 09:20', hash: 'ml3', content_extracted: 'Supervised learning models require labeled training datasets.' },
    { id: '4', name: 'Q2 Budget Calculations.xlsx', type: 'xlsx', path: 'C:/docs/budget.xlsx', size: 128000, created_at: '2026-05-20 18:22', updated_at: '2026-05-21 15:30', hash: 'ex4', content_extracted: 'Financial sheet totaling budget projections for Q2 departments.' }
  ],
  tags: [
    { id: 't1', name: 'Physics', color: '#ffb77a' },
    { id: 't2', name: 'Chemistry', color: '#e1b6ff' },
    { id: 't3', name: 'AI/ML', color: '#c8bfff' }
  ],
  fileTags: [
    { file_id: '1', tag_id: 't1' },
    { file_id: '2', tag_id: 't2' },
    { file_id: '3', tag_id: 't3' }
  ],
  annotations: [
    { id: 'a1', file_id: '1', page: 1, rect: null, start_offset: 10, end_offset: 40, type: 'highlight', content: 'Important formula definition', created_at: '2026-05-21 10:00' }
  ],
  progress: [
    { file_id: '1', last_page: 5, scroll_position: 120.5 }
  ],
  history: [
    { id: 'h1', source_file_id: '2', output_file_id: null, operation: 'docx_to_pdf', status: 'completed', timestamp: '2026-05-21 14:00', source_name: 'Organic Chemistry Lab Notes.docx', output_name: 'Organic Chemistry Lab Notes_converted.pdf' }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'library' | 'viewer' | 'convert' | 'search' | 'ai' | 'history' | 'settings'>('dashboard');
  const [documents, setDocuments] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [annotations, setAnnotations] = useState<any[]>([]);
  const [activeProgress, setActiveProgress] = useState<{ last_page: number } | null>(null);
  
  // App-wide Status Notification
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Global Search state (TitleBar)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Settings BYOK state
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('studyvault_apikey') || '');
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('studyvault_provider') || 'openai');
  const [isImporting, setIsImporting] = useState(false);

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    if (window.api) {
      try {
        const docs = await window.api.getDocuments();
        const tgs = await window.api.getTags();
        const hist = await window.api.getHistory();
        setDocuments(docs);
        setTags(tgs);
        setHistory(hist);
      } catch (err) {
        showNotification('Failed to read database records', 'error');
      }
    } else {
      // Mock Fallback
      setDocuments(mockDb.documents);
      setTags(mockDb.tags);
      setHistory(mockDb.history);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  // Open Dialog and Import File
  const handleImportFile = async () => {
    if (window.api) {
      try {
        const file = await window.api.openFileDialog();
        if (file) {
          setIsImporting(true);
          showNotification(`Importing and indexing ${file.name}. Please wait...`, 'info');
          const newDoc = {
            id: Math.random().toString(36).substring(2, 9),
            name: file.name,
            type: file.type,
            path: file.path,
            size: file.size,
            hash: '',
            content_extracted: ''
          };
          await window.api.addDocument(newDoc);
          showNotification(`Imported ${file.name} successfully`, 'success');
          loadAllData();
        }
      } catch (err: any) {
        showNotification(`Import failed: ${err.message}`, 'error');
      } finally {
        setIsImporting(false);
      }
    } else {
      // Web simulator fallback
      const mockName = prompt('Enter filename to simulate import (e.g. syllabus.pdf, project.pptx, data.xlsx):', 'syllabus.pdf');
      if (mockName) {
        const ext = mockName.split('.').pop() || 'pdf';
        const mockDoc = {
          id: Math.random().toString(36).substring(2, 9),
          name: mockName,
          type: ext,
          path: `C:/imported/${mockName}`,
          size: 204850,
          created_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
          updated_at: new Date().toISOString().replace('T', ' ').substring(0, 16),
          hash: 'hash_' + Math.random().toString(36).substring(2, 9),
          content_extracted: `Sample contents for ${mockName}`
        };
        mockDb.documents.unshift(mockDoc);
        showNotification(`Simulated import of ${mockName}`, 'success');
        loadAllData();
      }
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this document from StudyVault?')) return;
    
    if (window.api) {
      try {
        await window.api.deleteDocument(id);
        showNotification('Document removed', 'success');
        if (selectedFile?.id === id) setSelectedFile(null);
        loadAllData();
      } catch (err: any) {
        showNotification(`Delete failed: ${err.message}`, 'error');
      }
    } else {
      const idx = mockDb.documents.findIndex(d => d.id === id);
      if (idx !== -1) {
        mockDb.documents.splice(idx, 1);
        showNotification('Document deleted from simulator', 'success');
        if (selectedFile?.id === id) setSelectedFile(null);
        loadAllData();
      }
    }
  };

  // Open Document Viewer Screen
  const handleViewFile = async (doc: any) => {
    setSelectedFile(doc);
    setActiveTab('viewer');
    if (window.api) {
      try {
        const annos = await window.api.getAnnotations(doc.id);
        const prog = await window.api.getProgress(doc.id);
        setAnnotations(annos);
        setActiveProgress(prog || { last_page: 1 });
      } catch (e) {
        setAnnotations([]);
        setActiveProgress({ last_page: 1 });
      }
    } else {
      const annos = mockDb.annotations.filter(a => a.file_id === doc.id);
      const prog = mockDb.progress.find(p => p.file_id === doc.id);
      setAnnotations(annos);
      setActiveProgress(prog || { last_page: 1 });
    }
  };

  // Global search trigger
  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchQuery.trim()) return;
    setActiveTab('search');
  };

  // Safe save API Key helper
  const handleSaveApiKey = (key: string, provider: string) => {
    setApiKey(key);
    setAiProvider(provider);
    localStorage.setItem('studyvault_apikey', key);
    localStorage.setItem('studyvault_provider', provider);
    showNotification('AI credentials saved locally', 'success');
  };

  return (
    <div className="app-container">
      {/* 1. TitleBar */}
      <header className="titlebar">
        <div className="headline-sm font-display" style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
          <FolderOpen size={20} className="text-primary" style={{ color: 'var(--color-primary)' }} />
          <span>StudyVault</span>
        </div>
        
        {/* Global Search Center Pill */}
        <form onSubmit={handleGlobalSearch} className="search-pill" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <Search size={16} style={{ color: 'var(--color-outline)' }} />
          <input 
            type="text" 
            placeholder="Search documents, tags & text (Ctrl+K)..." 
            value={globalSearchQuery}
            onChange={(e) => setGlobalSearchQuery(e.target.value)}
          />
        </form>

        {/* User state notifications banner */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', WebkitAppRegion: 'no-drag' } as any}>
          {alert && (
            <div className="glass-panel" style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '6px 12px', 
              borderRadius: 'var(--rounded-default)', 
              fontSize: '12px',
              border: alert.type === 'error' ? '1px solid var(--color-error)' : '1px solid var(--color-primary)',
              color: alert.type === 'error' ? 'var(--color-error)' : 'var(--color-primary)'
            }}>
              {alert.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
              <span>{alert.message}</span>
            </div>
          )}
          <button onClick={handleImportFile} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <Plus size={14} />
            <span>Import</span>
          </button>
        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <div className="workspace">
        {/* 2.1 Sidebar */}
        <aside className="sidebar">
          <nav className="nav-list">
            <div 
              className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard size={18} />
              <span className="body-md">Dashboard</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              <BookOpen size={18} />
              <span className="body-md">Library</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'viewer' ? 'active' : ''}`}
              onClick={() => {
                if (selectedFile) setActiveTab('viewer');
                else showNotification('Select a document from Library to view', 'info');
              }}
              style={{ opacity: selectedFile ? 1 : 0.5 }}
            >
              <FileText size={18} />
              <span className="body-md">Reader</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'convert' ? 'active' : ''}`}
              onClick={() => setActiveTab('convert')}
            >
              <RefreshCw size={18} />
              <span className="body-md">Converter</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Search size={18} />
              <span className="body-md">Deep Search</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'ai' ? 'active' : ''}`}
              onClick={() => setActiveTab('ai')}
            >
              <Wand2 size={18} />
              <span className="body-md">AI Copilot</span>
            </div>

            <div 
              className={`nav-item ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <History size={18} />
              <span className="body-md">History</span>
            </div>
          </nav>

          <div className="nav-list">
            <div 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} />
              <span className="body-md">Settings</span>
            </div>
            <div style={{ padding: '0 var(--spacing-lg)', marginTop: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--color-outline)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#a3e635' }}></span>
                <span>Python worker active</span>
              </div>
            </div>
          </div>
        </aside>

        {/* 2.2 Content Panel router */}
        <main className="main-content">
          {activeTab === 'dashboard' && (
            <DashboardScreen 
              documents={documents} 
              history={history} 
              onViewFile={handleViewFile}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'library' && (
            <LibraryScreen 
              documents={documents} 
              tags={tags}
              onViewFile={handleViewFile}
              onDelete={handleDeleteDoc}
              onImport={handleImportFile}
              isImporting={isImporting}
            />
          )}

          {activeTab === 'viewer' && selectedFile && (
            <ViewerScreen 
              file={selectedFile} 
              annotations={annotations}
              progress={activeProgress}
              apiKey={apiKey}
              provider={aiProvider}
              onRefresh={async () => {
                if (selectedFile) handleViewFile(selectedFile);
              }}
            />
          )}

          {activeTab === 'convert' && (
            <ConversionScreen 
              documents={documents} 
              history={history}
              showNotification={showNotification}
              onRefresh={loadAllData}
            />
          )}

          {activeTab === 'search' && (
            <SearchScreen 
              initialQuery={globalSearchQuery}
              onViewFile={handleViewFile}
            />
          )}

          {activeTab === 'ai' && (
            <AiCopilotScreen 
              documents={documents}
              apiKey={apiKey}
              provider={aiProvider}
            />
          )}

          {activeTab === 'history' && (
            <HistoryScreen history={history} />
          )}

          {activeTab === 'settings' && (
            <SettingsScreen 
              apiKey={apiKey} 
              provider={aiProvider} 
              onSave={handleSaveApiKey} 
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 1. DASHBOARD SCREEN
// ----------------------------------------------------
function DashboardScreen({ documents, history, onViewFile, onNavigate }: any) {
  const recentDocs = documents.slice(0, 3);
  const recentConversions = history.slice(0, 3);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 className="headline-lg">Welcome back to StudyVault</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Your offline academic knowledge command center.</p>
      </div>

      {/* Grid Quick Stats */}
      <div className="grid-container" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="glass-panel" style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: '600' }}>TOTAL LIBRARY</div>
          <div className="headline-md" style={{ marginTop: '8px', color: 'var(--color-primary)' }}>{documents.length} Files</div>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: '600' }}>COMPLETED CONVERSIONS</div>
          <div className="headline-md" style={{ marginTop: '8px', color: 'var(--color-secondary)' }}>{history.length} operations</div>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: '600' }}>OFFLINE OCR NODE</div>
          <div className="headline-md" style={{ marginTop: '8px', color: 'var(--color-tertiary)' }}>Tesseract Engine</div>
        </div>
        <div className="glass-panel" style={{ padding: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-outline)', fontWeight: '600' }}>AI PROVIDER (BYOK)</div>
          <div className="headline-md" style={{ marginTop: '8px', color: 'var(--color-primary-fixed)' }}>Direct Gateway</div>
        </div>
      </div>

      {/* Continue study section */}
      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', width: '100%' }}>
        <div className="glass-panel" style={{ flex: 1.5, padding: 'var(--spacing-lg)' }}>
          <h2 className="headline-sm" style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText className="text-primary" size={18} />
            Continue Reading
          </h2>
          {recentDocs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentDocs.map((doc: any) => (
                <div 
                  key={doc.id}
                  onClick={() => onViewFile(doc)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: 'var(--spacing-md)',
                    backgroundColor: 'var(--color-surface-container-low)',
                    borderRadius: 'var(--rounded-default)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  className="hover-card-btn"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={`badge badge-${doc.type}`}>{doc.type}</span>
                    <span className="body-md" style={{ fontWeight: '500' }}>{doc.name}</span>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--color-primary)' }} className="label-md">Open Reader</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-outline)' }}>
              No documents in vault yet. Drag files or click Import to start.
            </div>
          )}
        </div>

        {/* Recent Transformation Actions */}
        <div className="glass-panel" style={{ flex: 1, padding: 'var(--spacing-lg)' }}>
          <h2 className="headline-sm" style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History className="text-secondary" size={18} />
            Transformation History
          </h2>
          {recentConversions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentConversions.map((hist: any) => (
                <div key={hist.id} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
                  <div style={{ marginTop: '3px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-secondary)' }}></div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: '500' }}>{hist.operation.toUpperCase().replace('_', ' ')}</span>
                    <span style={{ color: 'var(--color-on-surface-variant)', fontSize: '11px' }}>{hist.source_name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-outline)' }}>
              No transformation history yet.
            </div>
          )}
        </div>
      </div>

      {/* AI suggestion block */}
      <div className="glass-panel" style={{ padding: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <div style={{ backgroundColor: 'var(--color-primary-container)', padding: '12px', borderRadius: '50%' }}>
          <Sparkles size={24} style={{ color: 'var(--color-primary)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 className="headline-sm">AI Study Copilot Suggestion</h3>
          <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)', marginTop: '4px' }}>
            Select any document to automatically extract core topics, draft flashcards, or generate a structured summary.
          </p>
        </div>
        <button onClick={() => onNavigate('ai')} className="btn btn-secondary">
          <span>Go to Copilot</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 2. LIBRARY SCREEN
// ----------------------------------------------------
function LibraryScreen({ documents, tags, onViewFile, onDelete, onImport, isImporting }: any) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  const filteredDocs = documents.filter((doc: any) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchFilter.toLowerCase());
    // In mock view, tag filter can be matched with document mapping
    if (selectedTag) {
      const docMappedTags = mockDb.fileTags.filter(ft => ft.tag_id === selectedTag).map(ft => ft.file_id);
      return matchesSearch && docMappedTags.includes(doc.id);
    }
    return matchesSearch;
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="headline-lg">StudyVault Library</h1>
          <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Manage and explore all your academic resources offline.</p>
        </div>
        <button onClick={onImport} className="btn btn-primary" disabled={isImporting}>
          {isImporting ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
          <span>{isImporting ? 'Importing...' : 'Add Document'}</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, minHeight: 0 }}>
        {/* Left Drawer Tags filters */}
        <div className="glass-panel" style={{ width: '220px', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '16px', height: 'fit-content' }}>
          <h3 className="body-sm label-md" style={{ color: 'var(--color-outline)' }}>Filter by Tags</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div 
              onClick={() => setSelectedTag(null)}
              style={{ 
                padding: '6px 12px', 
                borderRadius: 'var(--rounded-default)', 
                cursor: 'pointer',
                backgroundColor: selectedTag === null ? 'var(--color-surface-container-high)' : 'transparent',
                fontWeight: selectedTag === null ? '600' : 'normal',
                fontSize: '14px'
              }}
            >
              All Files
            </div>
            {tags.map((tag: any) => (
              <div 
                key={tag.id}
                onClick={() => setSelectedTag(tag.id)}
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: 'var(--rounded-default)', 
                  cursor: 'pointer',
                  backgroundColor: selectedTag === tag.id ? 'var(--color-surface-container-high)' : 'transparent',
                  fontWeight: selectedTag === tag.id ? '600' : 'normal',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tag.color }}></span>
                <span>{tag.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Library Grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Library Sub Search bar */}
          <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ color: 'var(--color-outline)', marginRight: '12px' }} />
            <input 
              type="text" 
              placeholder="Filter library files..." 
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', width: '100%', fontFamily: 'var(--font-family-body)' }}
            />
          </div>

          <div className="grid-container" style={{ flex: 1, overflowY: 'auto' }}>
            {filteredDocs.map((doc: any) => (
              <div 
                key={doc.id}
                className="glass-panel" 
                onClick={() => onViewFile(doc)}
                style={{ 
                  padding: 'var(--spacing-md)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  height: '180px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* File Header */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className={`badge badge-${doc.type}`}>{doc.type}</span>
                    <button 
                      onClick={(e) => onDelete(doc.id, e)}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-outline)' }}
                      className="hover-delete-btn"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <h3 className="body-md" style={{ fontWeight: '600', color: 'var(--color-on-surface)', wordBreak: 'break-all' }}>{doc.name}</h3>
                </div>

                {/* File Footer metadata */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--color-outline)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{(doc.size / 1024).toFixed(0)} KB</span>
                    <span>{doc.updated_at.split(' ')[0]}</span>
                  </div>
                </div>
              </div>
            ))}

            {filteredDocs.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-outline)' }}>
                No matching documents found in library.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 3. DOCUMENT VIEWER SCREEN
// ----------------------------------------------------
function ViewerScreen({ file, annotations, progress, apiKey, provider, onRefresh }: any) {
  const [activeViewerTab, setActiveViewerTab] = useState<'notes' | 'ai' | 'outline'>('notes');
  const [selectedText, setSelectedText] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [copilotPrompt, setCopilotPrompt] = useState('');
  const [copilotResponses, setCopilotResponses] = useState<{ q: string; a: string }[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  const documentContentRef = useRef<HTMLDivElement>(null);

  // Monitor text selections to allow annotations/AI highlights
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection) {
      setSelectedText(selection.toString().trim());
    }
  };

  const handleAddAnnotation = async (type: 'highlight' | 'note') => {
    const textToAnnotate = selectedText || "Selected section";
    if (!textToAnnotate) return;

    const annotationContent = type === 'note' ? (prompt('Enter annotation comment:') || '') : '';
    
    if (window.api) {
      await window.api.addAnnotation({
        id: Math.random().toString(36).substring(2, 9),
        file_id: file.id,
        page: progress?.last_page || 1,
        rect: null,
        start_offset: 0,
        end_offset: textToAnnotate.length,
        type,
        content: type === 'note' ? annotationContent : textToAnnotate
      });
      onRefresh();
    } else {
      mockDb.annotations.push({
        id: Math.random().toString(36).substring(2, 9),
        file_id: file.id,
        page: progress?.last_page || 1,
        rect: null,
        start_offset: 0,
        end_offset: textToAnnotate.length,
        type,
        content: type === 'note' ? annotationContent : textToAnnotate,
        created_at: new Date().toISOString()
      });
      onRefresh();
    }
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  };

  const handleSendToCopilot = async () => {
    if (!copilotPrompt.trim()) return;
    setLoadingAi(true);
    const query = copilotPrompt;
    setCopilotPrompt('');

    if (window.api) {
      try {
        const res = await window.api.runWorkerCommand('ai_query', {
          provider,
          api_key: apiKey,
          prompt: query,
          context: file.content_extracted || ''
        });
        setCopilotResponses(prev => [...prev, { q: query, a: res.response }]);
      } catch (err: any) {
        setCopilotResponses(prev => [...prev, { q: query, a: `Error calling API: ${err.message}` }]);
      }
    } else {
      // Simulator reply
      setTimeout(() => {
        setCopilotResponses(prev => [...prev, { 
          q: query, 
          a: `[Simulator Response] Analyzed document content from ${file.name}.\n\nThe prompt "${query}" highlights that this document outlines primary study concepts. If you attach a real key, this will utilize the LLM directly.` 
        }]);
      }, 1000);
    }
    setLoadingAi(false);
  };

  const handleRemoveAnnotation = async (id: string) => {
    if (window.api) {
      await window.api.deleteAnnotation(id);
      onRefresh();
    } else {
      const idx = mockDb.annotations.findIndex(a => a.id === id);
      if (idx !== -1) {
        mockDb.annotations.splice(idx, 1);
        onRefresh();
      }
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: '600', letterSpacing: '0.05em' }}>STUDY VAULT READER</span>
          <h1 className="headline-md" style={{ color: 'var(--color-on-surface)' }}>{file.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => handleAddAnnotation('highlight')} 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            disabled={!selectedText}
          >
            <Highlighter size={14} />
            <span>Highlight</span>
          </button>
          <button 
            onClick={() => handleAddAnnotation('note')} 
            className="btn btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '12px' }}
            disabled={!selectedText}
          >
            <Bookmark size={14} />
            <span>Add Annotation</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, minHeight: 0 }}>
        {/* Left Side: Document Reader Screen Content */}
        <div 
          className="glass-panel" 
          ref={documentContentRef}
          onMouseUp={handleTextSelection}
          style={{ 
            flex: 2, 
            padding: 'var(--spacing-xl)', 
            overflowY: 'auto', 
            userSelect: 'text',
            backgroundColor: 'var(--color-surface-container-lowest)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-outline-variant)', paddingBottom: '12px', marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Path: {file.path}</span>
            <span style={{ fontSize: '12px', color: 'var(--color-primary)' }}>Progress: Page {progress?.last_page || 1}</span>
          </div>

          <article style={{ lineHeight: '1.8' }} className="body-lg">
            <h2 className="headline-sm" style={{ marginBottom: '16px' }}>Overview Analysis</h2>
            <p style={{ marginBottom: '16px' }}>
              {file.content_extracted || "No text content has been indexed from this document yet. Run OCR or verify index triggers to extract."}
            </p>
            <p style={{ marginBottom: '16px' }}>
              Academic success is heavily driven by systematic reading and annotation. StudyVault records reading offsets dynamically so you can return to your exact location instantly. Select any portion of text inside this article to highlight passages or create custom study annotations.
            </p>
          </article>
        </div>

        {/* Right Side: Tabbed Sidebar Panel (Notes / AI Chat / Outline) */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {/* Tab bar headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-outline-variant)' }}>
            <button 
              onClick={() => setActiveViewerTab('notes')}
              style={{ 
                flex: 1, 
                padding: '12px', 
                background: 'transparent', 
                border: 'none', 
                borderBottom: activeViewerTab === 'notes' ? '2px solid var(--color-primary)' : 'none',
                color: activeViewerTab === 'notes' ? 'var(--color-primary)' : 'var(--color-outline)',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Notes
            </button>
            <button 
              onClick={() => setActiveViewerTab('ai')}
              style={{ 
                flex: 1, 
                padding: '12px', 
                background: 'transparent', 
                border: 'none', 
                borderBottom: activeViewerTab === 'ai' ? '2px solid var(--color-primary)' : 'none',
                color: activeViewerTab === 'ai' ? 'var(--color-primary)' : 'var(--color-outline)',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              AI Copilot
            </button>
          </div>

          {/* Tab contents */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-md)' }}>
            {activeViewerTab === 'notes' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 className="body-sm label-md" style={{ color: 'var(--color-outline)' }}>Highlights & Notes</h3>
                
                {annotations.map((anno: any) => (
                  <div key={anno.id} style={{ 
                    padding: '10px', 
                    borderRadius: 'var(--rounded-default)', 
                    backgroundColor: 'var(--color-surface-container)',
                    borderLeft: anno.type === 'highlight' ? '3px solid var(--color-tertiary)' : '3px solid var(--color-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-outline)' }}>
                      <span>{anno.type.toUpperCase()}</span>
                      <button 
                        onClick={() => handleRemoveAnnotation(anno.id)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-outline)' }}
                      >
                        Delete
                      </button>
                    </div>
                    <p style={{ fontSize: '13px', fontStyle: anno.type === 'highlight' ? 'italic' : 'normal' }}>
                      {anno.content || "(Highlight)"}
                    </p>
                  </div>
                ))}

                {annotations.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-outline)', fontSize: '13px' }}>
                    Select text in the reader to create highlights or annotations.
                  </div>
                )}
              </div>
            )}

            {activeViewerTab === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyBetween: 'space-between' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                  {copilotResponses.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ alignSelf: 'flex-end', padding: '8px 12px', backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)', borderRadius: 'var(--rounded-default)' }}>
                        {item.q}
                      </div>
                      <div style={{ alignSelf: 'flex-start', padding: '8px 12px', backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--rounded-default)', color: 'var(--color-on-surface)' }}>
                        {item.a}
                      </div>
                    </div>
                  ))}
                  {loadingAi && <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>AI is thinking...</div>}
                </div>

                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--color-outline-variant)', paddingTop: '12px' }}>
                  <input 
                    type="text" 
                    placeholder="Ask AI about this document..."
                    value={copilotPrompt}
                    onChange={(e) => setCopilotPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendToCopilot()}
                    style={{ 
                      flex: 1, 
                      background: 'var(--color-surface-container)', 
                      border: 'none', 
                      borderRadius: 'var(--rounded-default)',
                      padding: '8px 12px',
                      color: '#fff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  <button onClick={handleSendToCopilot} className="btn btn-primary" style={{ padding: '8px' }}>
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 4. CONVERSION SCREEN
// ----------------------------------------------------
function ConversionScreen({ documents, history, showNotification, onRefresh }: any) {
  const [selectedFileId, setSelectedFileId] = useState('');
  const [targetFormat, setTargetFormat] = useState('pdf');
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!selectedFileId) {
      showNotification('Please select a file to convert', 'error');
      return;
    }
    const file = documents.find((d: any) => d.id === selectedFileId);
    if (!file) return;

    setConverting(true);
    showNotification(`Starting conversion of ${file.name} to ${targetFormat.toUpperCase()}`, 'info');

    if (window.api) {
      try {
        const result = await window.api.runWorkerCommand('convert', {
          source_path: file.path,
          target_format: targetFormat
        });

        // Register conversion outputs inside DB
        const conversionId = Math.random().toString(36).substring(2, 9);
        const newDocId = Math.random().toString(36).substring(2, 9);

        // Add document mock representing the converted output
        await window.api.addDocument({
          id: newDocId,
          name: result.output_name,
          type: result.format,
          path: result.output_path,
          size: file.size, // assume comparable
          hash: 'hash_' + Math.random().toString(36).substring(2, 9),
          content_extracted: result.text_content
        });

        // Add conversion history log
        await window.api.addHistory({
          id: conversionId,
          source_file_id: file.id,
          output_file_id: newDocId,
          operation: `${file.type}_to_${targetFormat}`,
          status: 'completed'
        });

        showNotification(`Conversion complete! Output: ${result.output_name}`, 'success');
        onRefresh();
      } catch (err: any) {
        showNotification(`Conversion failed: ${err.message}`, 'error');
      }
    } else {
      // Simulate conversion
      setTimeout(async () => {
        const dummyDocId = Math.random().toString(36).substring(2, 9);
        const outputName = `${file.name.split('.')[0]}_converted.${targetFormat}`;
        
        mockDb.documents.push({
          id: dummyDocId,
          name: outputName,
          type: targetFormat,
          path: `${file.path}_converted.${targetFormat}`,
          size: file.size,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          hash: 'hash_' + Math.random().toString(36).substring(2, 9),
          content_extracted: `Converted format of ${file.name} into ${targetFormat.toUpperCase()}`
        });

        mockDb.history.unshift({
          id: Math.random().toString(36).substring(2, 9),
          source_file_id: file.id,
          output_file_id: dummyDocId,
          operation: `${file.type}_to_${targetFormat}`,
          status: 'completed',
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
          source_name: file.name,
          output_name: outputName
        });

        showNotification(`Simulated conversion to ${targetFormat.toUpperCase()}`, 'success');
        onRefresh();
        setConverting(false);
      }, 1500);
      return;
    }
    setConverting(false);
  };

  return (
    <>
      <div>
        <h1 className="headline-lg">File Conversion Engine</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Convert files locally using offline workers.</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
        {/* Left Side settings */}
        <div className="glass-panel" style={{ flex: 1, padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 className="headline-sm">Conversion Setup</h2>

          <div>
            <label className="label-md" style={{ display: 'block', marginBottom: '8px' }}>Select Input File</label>
            <select 
              value={selectedFileId} 
              onChange={(e) => setSelectedFileId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--color-surface-container)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--rounded-default)',
                padding: '10px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'var(--font-family-body)'
              }}
            >
              <option value="">-- Choose file --</option>
              {documents.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name} ({d.type.toUpperCase()})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-md" style={{ display: 'block', marginBottom: '8px' }}>Select Target Format</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['pdf', 'docx', 'md', 'txt'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setTargetFormat(fmt)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: 'var(--rounded-default)',
                    background: targetFormat === fmt ? 'var(--color-primary)' : 'var(--color-surface-container)',
                    color: targetFormat === fmt ? 'var(--color-on-primary)' : '#fff',
                    border: '1px solid var(--color-outline-variant)',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={handleConvert} 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '12px' }}
            disabled={converting}
          >
            {converting ? <RefreshCw size={16} className="animate-spin" /> : null}
            <span>Convert File</span>
          </button>
        </div>

        {/* Right Side transformation history timeline */}
        <div className="glass-panel" style={{ flex: 1.2, padding: 'var(--spacing-lg)' }}>
          <h2 className="headline-sm" style={{ marginBottom: '16px' }}>Conversion Logs</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '350px', overflowY: 'auto' }}>
            {history.map((hist: any) => (
              <div key={hist.id} style={{ 
                padding: '12px', 
                backgroundColor: 'var(--color-surface-container)', 
                borderRadius: 'var(--rounded-default)',
                borderLeft: '3px solid var(--color-primary)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--color-outline)', marginBottom: '4px' }}>
                  <span>{hist.operation.toUpperCase().replace('_', ' ')}</span>
                  <span>{hist.timestamp}</span>
                </div>
                <div style={{ fontSize: '13px' }}>
                  <strong>Source:</strong> {hist.source_name}
                </div>
                <div style={{ fontSize: '13px', marginTop: '2px', color: 'var(--color-primary)' }}>
                  <strong>Output:</strong> {hist.output_name || 'Processed successfully'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 5. SEARCH SCREEN
// ----------------------------------------------------
function SearchScreen({ initialQuery, onViewFile }: any) {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      triggerSearch(initialQuery);
    }
  }, [initialQuery]);

  const triggerSearch = async (searchVal: string) => {
    if (!searchVal.trim()) return;
    setSearching(true);
    if (window.api) {
      try {
        const res = await window.api.searchDocuments(searchVal);
        setResults(res);
      } catch (e) {
        setResults([]);
      }
    } else {
      // Mock search
      const res = mockDb.documents.filter(d => 
        d.name.toLowerCase().includes(searchVal.toLowerCase()) || 
        d.content_extracted.toLowerCase().includes(searchVal.toLowerCase())
      );
      setResults(res);
    }
    setSearching(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerSearch(query);
  };

  return (
    <>
      <div>
        <h1 className="headline-lg">Deep Search Index</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>SQLite FTS5 powered full-text search across all files.</p>
      </div>

      <form onSubmit={handleSearchSubmit} className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '12px' }}>
        <input 
          type="text" 
          placeholder="Search keywords, phrases or exact queries..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--color-surface-container)',
            border: '1px solid var(--color-outline-variant)',
            borderRadius: 'var(--rounded-default)',
            padding: '12px',
            color: '#fff',
            outline: 'none',
            fontSize: '16px',
            fontFamily: 'var(--font-family-body)'
          }}
        />
        <button type="submit" className="btn btn-primary">
          <Search size={16} />
          <span>Search</span>
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
        {searching && <div style={{ color: 'var(--color-outline)' }}>Running search indexing...</div>}
        
        {results.map((doc: any) => (
          <div 
            key={doc.id} 
            className="glass-panel" 
            onClick={() => onViewFile(doc)}
            style={{ padding: 'var(--spacing-md)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="body-md" style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{doc.name}</h3>
              <span className={`badge badge-${doc.type}`}>{doc.type}</span>
            </div>
            
            {/* Display search snippet with highlight match */}
            <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)', fontStyle: 'italic' }}>
              {doc.snippet ? (
                <span dangerouslySetInnerHTML={{ __html: doc.snippet }}></span>
              ) : (
                doc.content_extracted.substring(0, 150) + '...'
              )}
            </p>
            
            <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
              Path: {doc.path}
            </div>
          </div>
        ))}

        {!searching && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-outline)' }}>
            No results match your search keywords.
          </div>
        )}
      </div>
    </>
  );
}

// ----------------------------------------------------
// 6. AI COPILOT SCREEN
// ----------------------------------------------------
function AiCopilotScreen({ documents, apiKey, provider }: any) {
  const [selectedFileId, setSelectedFileId] = useState('');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!promptInput.trim()) return;
    const userText = promptInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setPromptInput('');
    setLoading(true);

    const doc = documents.find((d: any) => d.id === selectedFileId);

    if (window.api) {
      try {
        const result = await window.api.runWorkerCommand('ai_query', {
          provider,
          api_key: apiKey,
          prompt: userText,
          context: doc ? doc.content_extracted : ''
        });
        setChatMessages(prev => [...prev, { role: 'assistant', text: result.response }]);
      } catch (err: any) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `API Connection Failed: ${err.message}` }]);
      }
    } else {
      setTimeout(() => {
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          text: `[Simulator Assistant] Received prompt: "${userText}". Attached document context: ${doc ? doc.name : 'None'}. Provide a real API key in settings to bypass simulation.` 
        }]);
      }, 1000);
    }
    setLoading(false);
  };

  return (
    <>
      <div>
        <h1 className="headline-lg">AI Study Copilot</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Analyze documents, generate mock questions or summarize details locally.</p>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flex: 1, minHeight: 0 }}>
        {/* Left Side: Select Document context */}
        <div className="glass-panel" style={{ width: '260px', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '16px', height: 'fit-content' }}>
          <h3 className="body-sm label-md" style={{ color: 'var(--color-outline)' }}>Select Context File</h3>
          <select 
            value={selectedFileId} 
            onChange={(e) => setSelectedFileId(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-surface-container)',
              border: '1px solid var(--color-outline-variant)',
              borderRadius: 'var(--rounded-default)',
              padding: '10px',
              color: '#fff',
              outline: 'none',
              fontFamily: 'var(--font-family-body)'
            }}
          >
            <option value="">-- No File (General query) --</option>
            {documents.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
            Selected document text will automatically segment and pipe to the LLM query context window.
          </div>
        </div>

        {/* Right Side: Chat panel */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{ 
                  maxWidth: '75%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '10px 16px',
                  borderRadius: 'var(--rounded-default)',
                  backgroundColor: msg.role === 'user' ? 'var(--color-primary-container)' : 'var(--color-surface-container)',
                  color: msg.role === 'user' ? 'var(--color-on-primary-container)' : 'var(--color-on-surface)',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
              >
                {msg.text}
              </div>
            ))}
            {loading && <div style={{ alignSelf: 'flex-start', color: 'var(--color-outline)', fontSize: '12px' }}>AI Bot is analyzing...</div>}
            {chatMessages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--color-outline)', fontSize: '14px' }}>
                <Sparkles size={32} style={{ margin: 'auto', marginBottom: '8px', color: 'var(--color-primary)' }} />
                <span>Ask queries about your imported textbooks or lecture slides.</span>
              </div>
            )}
          </div>

          {/* Input field */}
          <div style={{ padding: 'var(--spacing-md)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Ask anything..." 
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              style={{
                flex: 1,
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--rounded-default)',
                padding: '10px 16px',
                color: '#fff',
                outline: 'none',
                fontFamily: 'var(--font-family-body)'
              }}
            />
            <button onClick={handleSendMessage} className="btn btn-primary">
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 7. HISTORY SCREEN
// ----------------------------------------------------
function HistoryScreen({ history }: any) {
  return (
    <>
      <div>
        <h1 className="headline-lg">Activity Logs</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Comprehensive history of local transformations, OCRs and database updates.</p>
      </div>

      <div className="glass-panel" style={{ padding: 'var(--spacing-lg)', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {history.map((hist: any) => (
            <div 
              key={hist.id}
              style={{
                display: 'flex',
                gap: '16px',
                paddingBottom: '16px',
                borderBottom: '1px solid var(--color-outline-variant)'
              }}
            >
              {/* Event Time */}
              <div style={{ minWidth: '120px', color: 'var(--color-outline)', fontSize: '13px' }}>
                {hist.timestamp}
              </div>

              {/* Event Details */}
              <div style={{ flex: 1 }}>
                <span className="badge badge-pdf" style={{ marginBottom: '4px', backgroundColor: 'var(--color-primary-container)', color: 'var(--color-on-primary-container)' }}>
                  {hist.operation.toUpperCase().replace('_', ' ')}
                </span>
                <h4 className="body-md" style={{ fontWeight: '600', marginTop: '4px' }}>Source file: {hist.source_name}</h4>
                {hist.output_name && (
                  <p className="body-sm" style={{ color: 'var(--color-primary)', marginTop: '2px' }}>
                    Output: {hist.output_name}
                  </p>
                )}
              </div>

              {/* Status */}
              <div>
                <span 
                  className="badge" 
                  style={{ 
                    backgroundColor: hist.status === 'completed' ? 'rgba(163, 230, 53, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: hist.status === 'completed' ? '#a3e635' : '#ef4444',
                    border: hist.status === 'completed' ? '1px solid #a3e635' : '1px solid #ef4444'
                  }}
                >
                  {hist.status}
                </span>
              </div>
            </div>
          ))}

          {history.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-outline)' }}>
              No recorded historical operations.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------
// 8. SETTINGS SCREEN (BYOK)
// ----------------------------------------------------
function SettingsScreen({ apiKey, provider, onSave }: any) {
  const [localKey, setLocalKey] = useState(apiKey || '');
  const [localProvider, setLocalProvider] = useState(provider || 'openai');

  return (
    <>
      <div>
        <h1 className="headline-lg">Settings & Integrations</h1>
        <p className="body-md" style={{ color: 'var(--color-on-surface-variant)' }}>Configure local parameters and custom API credentials.</p>
      </div>

      <div className="glass-panel" style={{ padding: 'var(--spacing-lg)', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 className="headline-sm">Bring Your Own Key (BYOK)</h2>
        <p className="body-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
          StudyVault performs all text parsing locally. To generate summaries, flashcards, or chat prompts, you can add your custom API key. Your credentials are saved strictly in local storage and sent directly to the model provider.
        </p>

        <div>
          <label className="label-md" style={{ display: 'block', marginBottom: '8px' }}>API Provider</label>
          <select 
            value={localProvider}
            onChange={(e) => setLocalProvider(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-surface-container)',
              border: '1px solid var(--color-outline-variant)',
              borderRadius: 'var(--rounded-default)',
              padding: '10px',
              color: '#fff',
              outline: 'none',
              fontFamily: 'var(--font-family-body)'
            }}
          >
            <option value="openai">OpenAI (ChatGPT)</option>
            <option value="gemini">Google Gemini</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="ollama">Local Ollama (Offline AI)</option>
          </select>
        </div>

        <div>
          <label className="label-md" style={{ display: 'block', marginBottom: '8px' }}>API Key</label>
          <input 
            type="password" 
            placeholder={localProvider === 'ollama' ? 'Ollama uses local host endpoints (no key required)' : 'sk-...'}
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            disabled={localProvider === 'ollama'}
            className="input-field"
          />
        </div>

        <button 
          onClick={() => onSave(localKey, localProvider)} 
          className="btn btn-primary"
          style={{ alignSelf: 'flex-start' }}
        >
          <span>Save Changes</span>
        </button>
      </div>
    </>
  );
}
