
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Wand2, Settings2, FileText, AlertCircle, Code, Youtube, Facebook, MessageCircle, Play, Download, Volume2, ChevronDown, Upload, FileAudio, History, Trash2, RotateCcw, Clock, Sparkles, PenTool, MapPin } from 'lucide-react';
import { StyleOption, SpeedOption, VoiceName, VOICE_OPTIONS } from './types';
import { generateSSML, generateSpeech, generateScript } from './services/gemini';
import { Button } from './components/Button';
import { SSMLViewer } from './components/SSMLViewer';
// @ts-ignore
import * as pdfjsLibImport from 'pdfjs-dist';
// @ts-ignore
import * as mammothImport from 'mammoth';

const getModule = (mod: any) => {
  if (!mod) return null;
  return mod.default ? mod.default : mod;
};

const base64ToUint8Array = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const getWavHeader = (dataLength: number, sampleRate: number, numChannels: number, bitsPerSample: number) => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  return header;
};

const createWavUrl = (base64: string): string => {
  const pcmData = base64ToUint8Array(base64);
  const wavHeader = getWavHeader(pcmData.length, 24000, 1, 16);
  const wavBlob = new Blob([wavHeader, pcmData], { type: 'audio/wav' });
  return URL.createObjectURL(wavBlob);
};

const createMp3Url = (base64: string): string => {
  const pcmData = base64ToUint8Array(base64);
  // Ensure the buffer is aligned for Int16Array
  const int16Samples = new Int16Array(pcmData.buffer, 0, pcmData.byteLength / 2);
  
  // Access lamejs from window as it was loaded via script tag to avoid "MPEGMode not defined" error
  const lame = (window as any).lamejs;
  if (!lame || !lame.Mp3Encoder) {
    throw new Error("Thư viện lamejs chưa được tải đúng cách.");
  }
  
  const mp3encoder = new lame.Mp3Encoder(1, 24000, 128);
  const mp3Data = [];
  const blockSize = 1152;
  
  for (let i = 0; i < int16Samples.length; i += blockSize) {
    const sampleChunk = int16Samples.subarray(i, i + blockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  
  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(end);
  
  return URL.createObjectURL(new Blob(mp3Data, { type: 'audio/mp3' }));
};

interface HistoryItem {
  id: string;
  timestamp: number;
  text: string;
  ssml: string;
  audioBase64: string;
  voice: VoiceName;
  style: StyleOption;
  speed: SpeedOption;
}

const DURATIONS = [6, 8, 12, 15, 16, 18, 24, 30, 32, 45, 48, 60, 64, 75, 90];

const App = () => {
  const [inputText, setInputText] = useState('');
  const [ssmlOutput, setSsmlOutput] = useState('');
  const [isSsmlLoading, setIsSsmlLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isEncoding, setIsEncoding] = useState(false);
  const [previewLoading, setPreviewLoading] = useState<VoiceName | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Configuration State
  const [selectedStyle, setSelectedStyle] = useState<StyleOption>(StyleOption.STORY);
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedOption>(SpeedOption.NORMAL);
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(VoiceName.Zephyr);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Script Generator State
  const [inputMode, setInputMode] = useState<'manual' | 'generator'>('manual');
  const [productInfo, setProductInfo] = useState('');
  const [targetDuration, setTargetDuration] = useState<number>(30);
  const [isScriptGenerating, setIsScriptGenerating] = useState(false);

  useEffect(() => {
    try {
      const pdfLib = getModule(pdfjsLibImport);
      if (pdfLib && pdfLib.GlobalWorkerOptions) {
        pdfLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
      }
    } catch (e) {}
  }, []);

  const handleConvertSSML = async () => {
    if (!inputText.trim()) return;
    setIsSsmlLoading(true);
    setError(null);
    setSsmlOutput('');
    try {
      const result = await generateSSML(inputText, selectedStyle, selectedSpeed);
      if (result.includes("ERROR: UNSAFE_CONTENT")) {
        setError("Nội dung vi phạm tiêu chuẩn an toàn.");
      } else {
        setSsmlOutput(result);
      }
    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setIsSsmlLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!inputText.trim()) return;
    setIsAudioLoading(true);
    setError(null);
    setAudioUrl(null);
    setAudioBase64(null);
    try {
      const base64 = await generateSpeech(inputText, selectedVoice);
      setAudioBase64(base64);
      setAudioUrl(createWavUrl(base64));

      // Add to history
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        text: inputText,
        ssml: ssmlOutput,
        audioBase64: base64,
        voice: selectedVoice,
        style: selectedStyle,
        speed: selectedSpeed
      };
      setHistory(prev => [newItem, ...prev]);

    } catch (err: any) {
      setError(err.message || "Đã xảy ra lỗi.");
    } finally {
      setIsAudioLoading(false);
    }
  };

  const handleGenerateScript = async () => {
    if (!productInfo.trim()) return;
    setIsScriptGenerating(true);
    setError(null);
    
    // Clear previous results to ensure data consistency
    setSsmlOutput('');
    setAudioUrl(null);
    setAudioBase64(null);

    try {
      const script = await generateScript(productInfo, targetDuration);
      setInputText(script);
      setInputMode('manual'); // Switch back to manual mode to see the result
    } catch (err: any) {
      setError(err.message || "Lỗi khi tạo kịch bản.");
    } finally {
      setIsScriptGenerating(false);
    }
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    setInputText(item.text);
    setSsmlOutput(item.ssml);
    setSelectedVoice(item.voice);
    setSelectedStyle(item.style);
    setSelectedSpeed(item.speed);
    setAudioBase64(item.audioBase64);
    setAudioUrl(createWavUrl(item.audioBase64));
    setError(null);
  };

  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handlePreviewVoice = async (voice: VoiceName, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewLoading) return;
    setPreviewLoading(voice);
    try {
      const base64 = await generateSpeech("Xin chào, đây là giọng đọc mẫu.", voice);
      new Audio(createWavUrl(base64)).play();
    } catch (err) {} finally {
      setPreviewLoading(null);
    }
  };

  const insertTag = (tag: string) => {
    setInputText((prev) => prev + ` ${tag} `);
  };

  const handleDownload = (format: 'mp3' | 'wav') => {
    if (!audioBase64) return;
    
    try {
      if (format === 'mp3') setIsEncoding(true);
      
      // Small timeout to allow UI to show loading state
      setTimeout(() => {
        try {
          const url = format === 'mp3' ? createMp3Url(audioBase64) : createWavUrl(audioBase64);
          const link = document.createElement("a");
          link.href = url;
          link.download = `voicemaster_${Date.now()}.${format}`;
          link.click();
        } catch (err: any) {
          setError("Lỗi khi tạo tệp tải xuống: " + err.message);
        } finally {
          setIsEncoding(false);
        }
      }, 50);
    } catch (e) {
      setIsEncoding(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    
    // Clear previous results
    setError(null);
    setSsmlOutput('');
    setAudioUrl(null);
    setAudioBase64(null);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        const pdfLib = getModule(pdfjsLibImport);
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfLib.getDocument({ data: arrayBuffer }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((item: any) => item.str).join(' ') + '\n';
        }
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = getModule(mammothImport);
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value;
      } else {
        text = await file.text();
      }
      setInputText(text);
      setInputMode('manual'); // Ensure we are in manual mode to see uploaded text
    } catch (err: any) {
      setError(err.message || "Lỗi đọc file.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-slate-200 font-sans selection:bg-brand-400/30 flex flex-col">
      
      {/* Header */}
      <header className="py-10 text-center bg-navy-900 border-b border-brand-500/10">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-brand-400 mb-2">
          VoiceMaster AI - KTC
        </h1>
        <p className="text-white/80 font-medium tracking-wide">Chuyển văn bản sang giọng nói Miễn Phí</p>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 lg:py-12 flex-grow w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Step 1: Config */}
            <div className="bg-navy-800 border border-brand-500/10 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-6 text-brand-400 font-bold uppercase tracking-widest text-sm">
                <Settings2 size={18} />
                <h2>Tùy Chọn Concept & Cấu Hình</h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Phong cách</label>
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value as StyleOption)}
                    className="w-full bg-navy-900 border border-brand-500/20 text-slate-200 text-sm rounded-lg p-3 hover:border-brand-400 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    {Object.values(StyleOption).map((style) => (
                      <option key={style} value={style}>{style}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tốc độ</label>
                  <select 
                    value={selectedSpeed}
                    onChange={(e) => setSelectedSpeed(e.target.value as SpeedOption)}
                    className="w-full bg-navy-900 border border-brand-500/20 text-slate-200 text-sm rounded-lg p-3 hover:border-brand-400 transition-colors cursor-pointer outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    {Object.values(SpeedOption).map((speed) => (
                      <option key={speed} value={speed}>{speed}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Input Area */}
            <div className="bg-navy-800/50 border border-brand-500/10 rounded-xl overflow-hidden shadow-lg">
              
              {/* Tab Navigation */}
              <div className="flex border-b border-brand-500/10 bg-navy-800">
                <button
                  onClick={() => setInputMode('manual')}
                  className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
                    inputMode === 'manual' 
                      ? 'bg-navy-800 text-brand-400 border-b-2 border-brand-400' 
                      : 'bg-navy-900/50 text-white/30 hover:text-white hover:bg-navy-800'
                  }`}
                >
                  <FileText size={14} /> Nhập Văn Bản
                </button>
                <button
                  onClick={() => setInputMode('generator')}
                  className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors ${
                    inputMode === 'generator' 
                      ? 'bg-navy-800 text-brand-400 border-b-2 border-brand-400' 
                      : 'bg-navy-900/50 text-white/30 hover:text-white hover:bg-navy-800'
                  }`}
                >
                  <Sparkles size={14} /> Tạo Kịch Bản AI
                </button>
              </div>

              {inputMode === 'manual' ? (
                /* Manual Input Mode */
                <>
                  <div className="flex justify-between items-center p-4 border-b border-brand-500/10 bg-navy-800/50">
                     <div className="flex items-center gap-2">
                         <span className="text-[10px] text-white/40 uppercase tracking-wider">Nhập hoặc tải file</span>
                     </div>
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] flex items-center gap-2 bg-navy-900 hover:bg-navy-700 text-brand-400 px-3 py-1.5 rounded-md border border-brand-400/30 transition-all font-bold uppercase tracking-wider"
                    >
                      {isUploading ? <div className="animate-spin w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full"/> : <Upload size={14} />}
                      Tải File
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.pdf,.docx"/>
                  </div>
                  
                  <div className="relative">
                    <textarea
                      id="input-textarea"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Nhập văn bản của bạn tại đây..."
                      className="w-full min-h-[350px] bg-transparent text-slate-100 placeholder-white/20 text-sm p-6 outline-none resize-none leading-relaxed"
                      spellCheck={false}
                    />
                    
                    <div className="absolute bottom-4 right-4 flex gap-2">
                       <button onClick={() => insertTag('[Đọc Nhanh]')} className="text-[10px] bg-navy-900/80 hover:bg-brand-400 hover:text-navy-950 text-brand-400 px-2 py-1 rounded border border-brand-400/30 transition-all font-bold">
                        + Đọc Nhanh
                      </button>
                      <button onClick={() => insertTag('[Đọc Chậm]')} className="text-[10px] bg-navy-900/80 hover:bg-brand-400 hover:text-navy-950 text-brand-400 px-2 py-1 rounded border border-brand-400/30 transition-all font-bold">
                        + Đọc Chậm
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* AI Script Generator Mode */
                <div className="p-6 space-y-5 min-h-[400px]">
                   <div className="space-y-2">
                      <label className="text-[11px] font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                        <PenTool size={14} /> Mô Tả Sản Phẩm / Nội Dung
                      </label>
                      <textarea
                        value={productInfo}
                        onChange={(e) => setProductInfo(e.target.value)}
                        placeholder="Ví dụ: Nước hoa Charme hương gỗ trầm ấm, lưu hương 12 tiếng, thích hợp cho nam giới văn phòng..."
                        className="w-full h-40 bg-navy-900 border border-brand-500/20 text-slate-200 text-sm rounded-xl p-4 placeholder-white/20 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all resize-none"
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[11px] font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={14} /> Thời Lượng Mong Muốn
                      </label>
                      <div className="relative">
                        <select 
                          value={targetDuration}
                          onChange={(e) => setTargetDuration(Number(e.target.value))}
                          className="w-full bg-navy-900 border border-brand-500/20 text-slate-200 text-sm rounded-xl p-4 appearance-none outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 cursor-pointer"
                        >
                          {DURATIONS.map(dur => (
                            <option key={dur} value={dur}>{dur} Giây</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" size={16} />
                      </div>
                      <p className="text-[10px] text-white/30 italic">* Thời gian ước tính dựa trên tốc độ đọc trung bình.</p>
                   </div>

                   <Button 
                      onClick={handleGenerateScript} 
                      isLoading={isScriptGenerating} 
                      disabled={!productInfo.trim()} 
                      className="w-full mt-4 py-4"
                    >
                      <Sparkles size={16} className="mr-2" />
                      Tạo Kịch Bản Ngay
                   </Button>
                </div>
              )}
            </div>

             {/* Voice Selection */}
             <div className="bg-navy-800 border border-brand-500/10 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-6 text-brand-400 font-bold uppercase tracking-widest text-sm">
                  <Mic size={18} />
                  <h2>Chọn Nhân Vật / Giọng Đọc</h2>
              </div>
              
              <div className="space-y-3 h-64 overflow-y-auto pr-2">
                {VOICE_OPTIONS.map((voice) => (
                    <div 
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`flex items-start justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                        selectedVoice === voice.id 
                          ? 'bg-brand-400/10 border-brand-400 shadow-lg shadow-brand-400/5' 
                          : 'bg-navy-900/50 border-white/5 hover:border-brand-400/30 hover:bg-navy-900'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 mt-1 ${
                          selectedVoice === voice.id ? 'border-brand-400 bg-brand-400 text-navy-950' : 'border-white/10 bg-navy-800 text-white/30'
                        }`}>
                          <span className="text-lg font-bold">
                            {voice.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`font-bold ${selectedVoice === voice.id ? 'text-brand-400' : 'text-slate-300'}`}>
                              {voice.name}
                            </span>
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-navy-800 text-white/40 border border-white/5 font-bold uppercase tracking-tighter">
                              {voice.gender === 'Nam' ? 'Zalo' : 'FB'} {voice.gender}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mb-2">
                              {voice.tags.map((tag, idx) => (
                              <span key={idx} className={`text-[9px] px-1.5 py-0.5 rounded border ${selectedVoice === voice.id ? 'bg-brand-400/20 text-brand-400 border-brand-400/20' : 'bg-white/5 text-white/50 border-white/10'}`}>
                                  {tag}
                              </span>
                              ))}
                          </div>

                          <p className={`text-[11px] leading-relaxed ${selectedVoice === voice.id ? 'text-brand-400/80' : 'text-white/40'}`}>
                              {voice.description}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => handlePreviewVoice(voice.id, e)}
                        className={`p-2 rounded-full transition-colors shrink-0 mt-1 ${
                          selectedVoice === voice.id ? 'text-brand-400 bg-brand-400/10' : 'text-white/20 hover:text-brand-400'
                        }`}
                      >
                        {previewLoading === voice.id ? (
                          <div className="w-5 h-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                        ) : (
                          <Play size={18} fill="currentColor" />
                        )}
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button onClick={handleConvertSSML} isLoading={isSsmlLoading} disabled={!inputText.trim()} variant="secondary">
                Tối Ưu SSML
              </Button>
              <Button onClick={handleGenerateAudio} isLoading={isAudioLoading} disabled={!inputText.trim()} variant="primary">
                Tạo Giọng Nói
              </Button>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
             <div className="flex items-center gap-2 mb-4 text-brand-400 font-bold uppercase tracking-widest text-sm h-[28px]">
                <Code size={18} /> 
                <h2>Kết Quả Hiển Thị</h2>
              </div>

            {error ? (
              <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-8 flex flex-col items-center justify-center text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4 opacity-50" />
                <h3 className="text-red-400 font-bold mb-2">Đã xảy ra lỗi</h3>
                <p className="text-red-300/60 text-sm max-w-xs">{error}</p>
                <Button className="mt-4" onClick={() => setError(null)} variant="ghost">Thử lại</Button>
              </div>
            ) : (
              <div className="space-y-6 h-full flex flex-col">
                
                {audioUrl && (
                  <div className="bg-navy-800 border border-brand-500/20 rounded-xl overflow-hidden shadow-2xl animate-fade-in">
                    <div className="px-5 py-4 border-b border-brand-500/10 bg-navy-950 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
                        <Volume2 size={18} />
                        Kết Quả Audio
                      </div>
                    </div>
                    <div className="p-8 flex flex-col gap-6 items-center">
                      <audio controls className="w-full custom-audio" src={audioUrl} />
                      
                      <div className="w-full space-y-3">
                        <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">
                          <Download size={12} />
                          Tải xuống bản ghi:
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            onClick={() => handleDownload('mp3')}
                            disabled={isEncoding}
                            className="flex items-center justify-center gap-2 bg-brand-400 hover:bg-brand-300 disabled:opacity-50 text-navy-950 px-6 py-3 rounded-xl text-sm font-black transition-all shadow-lg active:scale-95"
                          >
                            {isEncoding ? (
                              <div className="w-4 h-4 animate-spin rounded-full border-2 border-navy-950 border-t-transparent" />
                            ) : (
                              <FileAudio size={18} />
                            )}
                            TẢI XUỐNG MP3
                          </button>
                          
                          <button
                            onClick={() => handleDownload('wav')}
                            className="flex items-center justify-center gap-2 bg-navy-900 border border-brand-400/30 hover:bg-navy-950 hover:border-brand-400 text-brand-400 px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                          >
                            <Download size={18} />
                            TẢI XUỐNG WAV
                          </button>
                        </div>
                        
                        <p className="text-[10px] text-white/20 text-center italic mt-2">
                          * Định dạng MP3 được khuyến nghị cho các nền tảng mạng xã hội.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* History Section */}
                {history.length > 0 && (
                  <div className="bg-navy-800 border border-brand-500/10 rounded-xl overflow-hidden shadow-lg animate-fade-in order-last">
                    <div className="px-5 py-4 border-b border-brand-500/10 bg-navy-950 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-brand-400 font-bold text-sm">
                        <History size={18} />
                        Lịch Sử Phiên Làm Việc
                      </div>
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-wider">{history.length} bản ghi</span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {history.map((item) => (
                        <div key={item.id} className="p-4 border-b border-brand-500/5 hover:bg-white/5 transition-colors flex items-start gap-3 group">
                          <div className="w-8 h-8 rounded bg-navy-900 border border-brand-400/20 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                            {item.voice.charAt(0)}
                          </div>
                          <div className="flex-grow min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-brand-400 font-bold text-xs truncate pr-2">{item.voice} - {item.style}</span>
                              <div className="flex items-center gap-1 text-[10px] text-white/30">
                                <Clock size={10} />
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <p className="text-white/60 text-xs truncate mb-2">{item.text}</p>
                            <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleRestoreHistory(item)}
                                className="flex items-center gap-1 text-[10px] bg-brand-400/10 text-brand-400 px-2 py-1 rounded hover:bg-brand-400 hover:text-navy-950 transition-colors font-bold"
                              >
                                <RotateCcw size={10} /> Khôi phục
                              </button>
                              <button 
                                onClick={(e) => handleDeleteHistory(item.id, e)}
                                className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500 hover:text-white transition-colors ml-auto"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ssmlOutput ? (
                  <div className="animate-fade-in flex-grow">
                    <div className="bg-brand-400/5 border border-brand-400/20 rounded-lg p-4 mb-4">
                        <p className="text-sm text-brand-400 font-bold uppercase tracking-tight">Mã SSML Đã Được Tối Ưu</p>
                        <p className="text-[10px] text-white/30 mt-1 uppercase tracking-[0.2em] font-medium">WaveNet Speech Synthesis Engine</p>
                    </div>
                    <SSMLViewer ssml={ssmlOutput} />
                  </div>
                ) : !audioUrl && (
                  <div className="bg-navy-800/20 border border-brand-500/10 border-dashed rounded-xl flex-grow min-h-[300px] flex flex-col items-center justify-center text-center p-12">
                    <div className="w-20 h-20 bg-navy-800 rounded-3xl flex items-center justify-center mb-6 text-brand-400/20 border border-brand-500/10 shadow-inner">
                      <Wand2 size={40} />
                    </div>
                    <h3 className="text-white/40 font-bold text-lg mb-2 uppercase tracking-widest">Sẵn Sàng Xử Lý</h3>
                    <p className="text-white/20 text-xs max-w-xs leading-loose font-medium">
                      Nhập văn bản và chọn cấu hình để bắt đầu tạo nội dung âm thanh chất lượng cao.
                    </p>
                    <div className="mt-12 text-[9px] text-brand-400/20 font-bold uppercase tracking-[0.3em]">APP NÀY ĐƯỢC TẠO BỞI XUÂN MINH</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer styled as per the reference image */}
      <footer className="bg-navy-950 py-8 border-t border-brand-500/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-col items-center sm:items-start gap-1">
              <p className="text-[9px] text-white/20 uppercase font-bold tracking-[0.4em]">VOICEMASTER AI - KTC SYSTEM 2.0</p>
              <p className="text-[10px] text-brand-400 font-bold uppercase tracking-widest">Người phát triển: Xuân Minh</p>
            </div>
            <div className="flex gap-4 opacity-20">
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
