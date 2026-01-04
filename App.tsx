import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AppView, OMRFile, StudentResult, SectionName } from './types';
import { generateAnalyticsInsights } from './services/geminiService';
import { 
    UploadCloudIcon, FileIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, CogIcon,
    SearchIcon, DownloadIcon, ChevronLeftIcon, ChevronRightIcon, TrashIcon
} from './components/Icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

// Mock Data Generator
const MOCK_STUDENT_IDS = ['ST001', 'ST002', 'ST003', 'ST004', 'ST005', 'ST006', 'ST007', 'ST008', 'ST009', 'ST010'];
const SECTIONS: SectionName[] = ['Data Analytics', 'AI/ML', 'Data Science', 'Generative AI', 'Statistics'];
const CORRECT_ANSWERS = Array.from({ length: 50 }, (_, i) => String.fromCharCode(65 + (i % 4))); // A, B, C, D cycle

const generateMockResult = (file: OMRFile, index: number): StudentResult => {
    const studentId = MOCK_STUDENT_IDS[index % MOCK_STUDENT_IDS.length] + `-${Math.floor(Math.random() * 900) + 100}`;
    const sectionScores: any = {};
    let totalScore = 0;
    const answers: StudentResult['answers'] = [];

    SECTIONS.forEach(section => {
        let sectionScore = 0;
        for (let i = 0; i < 10; i++) {
            const questionNum = SECTIONS.indexOf(section) * 10 + i;
            const isCorrect = Math.random() > 0.3; // 70% chance of being correct
            if (isCorrect) {
                sectionScore += 2;
            }
            answers.push({
                question: questionNum + 1,
                studentAnswer: isCorrect ? CORRECT_ANSWERS[questionNum] : String.fromCharCode(65 + ((questionNum + 1) % 4)),
                correctAnswer: CORRECT_ANSWERS[questionNum],
                isCorrect: isCorrect
            });
        }
        sectionScores[section] = sectionScore;
        totalScore += sectionScore;
    });

    const confidence = Math.random() * 0.2 + 0.8; // 80% - 100%
    const needsReview = confidence < 0.9;
    
    const randomDaysAgo = Math.floor(Math.random() * 30); // Random date in the last 30 days
    const processingDate = new Date();
    processingDate.setDate(processingDate.getDate() - randomDaysAgo);

    return {
        id: file.id,
        studentId,
        examSet: ['A', 'B', 'C', 'D'][index % 4] as 'A' | 'B' | 'C' | 'D',
        sectionScores,
        totalScore,
        confidence,
        status: needsReview ? 'Needs Review' : 'Complete',
        answers,
        originalImage: `https://picsum.photos/seed/${studentId}/800/1100`,
        processingDate,
    };
};

// --- Child Components ---

const Header: React.FC<{ view: AppView; setView: (view: AppView) => void; hasResults: boolean }> = ({ view, setView, hasResults }) => (
    <header className="bg-white/75 dark:bg-slate-900/75 backdrop-blur-lg sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
                <div className="flex items-center">
                    <SparklesIcon className="h-8 w-8 text-indigo-500" />
                    <h1 className="ml-2 text-xl font-bold text-slate-800 dark:text-white">AutoOMR <span className="font-light text-slate-500">by Innomatics</span></h1>
                </div>
                <nav className="hidden md:flex items-center space-x-2">
                    {['upload', 'results', 'analytics'].map(v => {
                        const isEnabled = v === 'upload' || hasResults;
                        return (
                            <button
                                key={v}
                                onClick={() => isEnabled && setView(v as AppView)}
                                disabled={!isEnabled}
                                className={`capitalize text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                                    view === v ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                                } ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {v}
                            </button>
                        )
                    })}
                </nav>
            </div>
        </div>
    </header>
);

const UploadView: React.FC<{ onProcessStart: (files: OMRFile[]) => void; totalProcessed: number }> = ({ onProcessStart, totalProcessed }) => {
    const [files, setFiles] = useState<OMRFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = useCallback((incomingFiles: FileList | null) => {
        if (!incomingFiles) return;
        const newOmrFiles = Array.from(incomingFiles)
            .filter(file => ['image/jpeg', 'image/png', 'application/pdf', 'application/zip'].includes(file.type))
            .map(file => ({
                id: `${file.name}-${file.lastModified}-${Math.random()}`,
                file,
                preview: URL.createObjectURL(file),
                progress: 0,
                status: 'pending' as const
            }));
        setFiles(prev => [...prev, ...newOmrFiles.filter(nf => !prev.some(ef => ef.id === nf.id))]);
    }, []);

    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const removeFile = (id: string) => {
        setFiles(files.filter(f => f.id !== id));
    };
    
    const clearQueue = () => {
        setFiles([]);
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            {totalProcessed > 0 && (
                 <div className="mb-8 p-6 bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Welcome Back!</h3>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                        <div>
                            <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">{totalProcessed}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total Sheets Processed</p>
                        </div>
                        <div>
                            <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">~1.2s</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Avg. Processing Time</p>
                        </div>
                    </div>
                </div>
            )}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">Automated OMR Sheet Evaluation</h2>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Upload your scanned OMR sheets to start the automated grading process.</p>
            </div>
            <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ease-in-out ${isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-105 shadow-xl' : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400'}`}
            >
                <UploadCloudIcon className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-4 text-slate-600 dark:text-slate-400">Drag & drop files here or</p>
                <label htmlFor="file-upload" className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer transition-transform hover:scale-105">
                    Browse files
                </label>
                <input id="file-upload" type="file" multiple className="sr-only" onChange={e => handleFiles(e.target.files)} accept=".jpg,.jpeg,.png,.pdf,.zip" />
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">Supports: JPG, PNG, PDF, ZIP</p>
            </div>

            {files.length > 0 && (
                <div className="mt-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-slate-900 dark:text-white">File Queue ({files.length})</h3>
                        <button onClick={clearQueue} className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">Clear Queue</button>
                    </div>
                    <ul className="space-y-3">
                        {files.map(omrFile => (
                            <li key={omrFile.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:scale-[1.02]">
                                <div className="flex items-center min-w-0">
                                    {omrFile.file.type.startsWith('image/') ?
                                        <img src={omrFile.preview} alt={omrFile.file.name} className="w-12 h-12 object-cover rounded-md flex-shrink-0" /> :
                                        <FileIcon className="w-12 h-12 text-slate-400 p-2 flex-shrink-0" />
                                    }
                                    <div className="ml-4 min-w-0">
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{omrFile.file.name}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{(omrFile.file.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                </div>
                                <button onClick={() => removeFile(omrFile.id)} className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                    <XCircleIcon className="w-6 h-6 text-red-500" />
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={() => onProcessStart(files)}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 transition-all hover:scale-105 active:scale-100"
                            disabled={files.length === 0}
                        >
                           Start Processing {files.length} {files.length === 1 ? 'File' : 'Files'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


const ProcessingDashboard: React.FC<{ files: OMRFile[]; onProcessingComplete: (results: StudentResult[]) => void }> = ({ files, onProcessingComplete }) => {
    const [processedFiles, setProcessedFiles] = useState<OMRFile[]>(files.map(f => ({ ...f, status: 'uploading' })));
    const [processingTime, setProcessingTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setProcessingTime(t => t + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const totalFiles = processedFiles.length;
        const generatedResults: StudentResult[] = [];

        const processFile = (index: number) => {
            if (index >= totalFiles) {
                setTimeout(() => onProcessingComplete(generatedResults), 1000);
                return;
            }

            const isError = Math.random() < 0.1; // 10% chance of error
            const stages: OMRFile['status'][] = isError 
                ? ['preprocessing', 'detecting', 'error']
                : ['preprocessing', 'detecting', 'scoring', 'complete'];
            
            let currentStageIndex = 0;
            let progress = 0;

            const updateProgress = () => {
                progress += Math.random() * 15;
                if (progress >= 100) {
                    progress = 100;
                    if (currentStageIndex < stages.length - 1) {
                        currentStageIndex++;
                        progress = 0;
                    }
                }

                setProcessedFiles(prev => prev.map((file, i) => i === index ? { ...file, progress, status: stages[currentStageIndex] } : file));

                if (stages[currentStageIndex] === 'complete' || stages[currentStageIndex] === 'error') {
                    if (stages[currentStageIndex] === 'complete') {
                        generatedResults.push(generateMockResult(processedFiles[index], index));
                    }
                    setTimeout(() => processFile(index + 1), 300); // Start next file after a short delay
                } else {
                    setTimeout(updateProgress, 100 + Math.random() * 150);
                }
            };
            setTimeout(updateProgress, 100);
        };

        processFile(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const completedCount = processedFiles.filter(f => f.status === 'complete' || f.status === 'error').length;
    const overallProgress = (completedCount / processedFiles.length) * 100;
    const currentFile = processedFiles.find(f => f.status !== 'complete' && f.status !== 'error' && f.status !== 'pending' && f.status !== 'uploading');

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Processing OMR Sheets</h2>
            <div className="mt-4 text-center text-slate-500 dark:text-slate-400">
                <p>Processing {completedCount} of {processedFiles.length} files. Elapsed time: {processingTime}s</p>
            </div>

            <div className="mt-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
                <div className="bg-indigo-600 h-4 rounded-full transition-all duration-500" style={{ width: `${overallProgress}%` }}></div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Live Preview</h3>
                    {currentFile ? (
                        <div>
                            <img src={currentFile.preview} alt="Processing file" className="w-full rounded-lg aspect-[8.5/11] object-cover bg-slate-100 dark:bg-slate-700" />
                            <p className="mt-4 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{currentFile.file.name}</p>
                            <p className="capitalize text-sm text-indigo-500 dark:text-indigo-400 font-semibold">{currentFile.status}...</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full aspect-[8.5/11] bg-slate-100 dark:bg-slate-700 rounded-lg">
                             <div className="text-center">
                                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500" />
                                <p className="mt-2 text-slate-500">Processing Complete!</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Processing Queue</h3>
                    <ul className="space-y-3 h-[500px] overflow-y-auto pr-2">
                        {processedFiles.map(omrFile => {
                            const isComplete = omrFile.status === 'complete';
                            const isError = omrFile.status === 'error';
                            const inProgress = !isComplete && !isError;
                            const progressColor = isError ? 'bg-red-500' : 'bg-indigo-500';

                            return (
                            <li key={omrFile.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">{omrFile.file.name}</p>
                                    {isComplete && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
                                    {isError && <XCircleIcon className="w-5 h-5 text-red-500" />}
                                    {inProgress && <div className="w-5 h-5 border-2 border-dashed rounded-full border-indigo-500 animate-spin"></div>}
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 overflow-hidden">
                                    <div className={`${progressColor} h-2 rounded-full transition-all duration-300`} style={{ width: `${isComplete ? 100 : omrFile.progress}%` }}></div>
                                </div>
                                <p className={`text-xs text-right mt-1 capitalize ${isError ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>{omrFile.status}</p>
                            </li>
                        )})}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const IndividualResultModal: React.FC<{ result: StudentResult; onClose: () => void; onApprove: (id: string) => void }> = ({ result, onClose, onApprove }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Review: {result.studentId}</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        <XCircleIcon className="w-6 h-6 text-slate-500" />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-md font-semibold mb-2 dark:text-white">Original OMR Sheet</h3>
                        <img src={result.originalImage} alt={`OMR for ${result.studentId}`} className="rounded-lg shadow-md w-full" />
                    </div>
                    <div>
                        <h3 className="text-md font-semibold mb-2 dark:text-white">Detailed Breakdown</h3>
                        <div className="space-y-4">
                            <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                                <p><strong>Total Score:</strong> <span className="font-bold text-indigo-600 dark:text-indigo-400">{result.totalScore} / 100</span></p>
                                <p><strong>Status:</strong> <span className={result.status === 'Needs Review' ? 'text-amber-500' : 'text-green-500'}>{result.status}</span></p>
                                <p><strong>Confidence:</strong> <span>{(result.confidence * 100).toFixed(1)}%</span></p>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                                <h4 className="font-semibold mb-2">Section Scores</h4>
                                <ul className="text-sm space-y-1">
                                    {SECTIONS.map(section => (
                                        <li key={section} className="flex justify-between">
                                            <span>{section}:</span>
                                            <span className="font-medium">{result.sectionScores[section]} / 20</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                             <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                                <h4 className="font-semibold mb-2">Answers</h4>
                                <ul className="text-sm space-y-1 max-h-60 overflow-y-auto pr-2">
                                    {result.answers.map(ans => (
                                        <li key={ans.question} className={`flex justify-between p-1 rounded ${ans.isCorrect ? 'bg-green-100 dark:bg-green-500/20' : 'bg-red-100 dark:bg-red-500/20'}`}>
                                            <span>Q{ans.question}: Your answer <span className="font-bold">{ans.studentAnswer}</span></span>
                                            {!ans.isCorrect && <span className="text-xs">(Correct: {ans.correctAnswer})</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t dark:border-slate-700 flex justify-end space-x-3">
                    {result.status === 'Needs Review' && (
                         <button onClick={() => { onApprove(result.id); onClose(); }} className="px-4 py-2 text-sm font-medium rounded-md bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-300 dark:hover:bg-green-500/30 transition-colors">Approve Result</button>
                    )}
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Close</button>
                </div>
            </div>
        </div>
    );
}

const RESULTS_PER_PAGE = 10;

const ResultsView: React.FC<{ 
    results: StudentResult[]; 
    onApproveResult: (id: string) => void;
    onApproveResults: (ids: string[]) => void;
    onDeleteResults: (ids: string[]) => void;
}> = ({ results, onApproveResult, onApproveResults, onDeleteResults }) => {
    const [selectedResult, setSelectedResult] = useState<StudentResult | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof StudentResult; direction: 'asc' | 'desc' } | null>({ key: 'totalScore', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Complete' | 'Needs Review'>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // State for export filters
    const [exportStatusFilter, setExportStatusFilter] = useState<'All' | 'Complete' | 'Needs Review'>('All');
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');


    const filteredResults = useMemo(() => {
        return results
            .filter(r => r.studentId.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(r => statusFilter === 'All' || r.status === statusFilter);
    }, [results, searchTerm, statusFilter]);

    const sortedResults = useMemo(() => {
        let sortableItems = [...filteredResults];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [filteredResults, sortConfig]);
    
    const paginatedResults = useMemo(() => {
        const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
        return sortedResults.slice(startIndex, startIndex + RESULTS_PER_PAGE);
    }, [sortedResults, currentPage]);
    
    const totalPages = Math.ceil(sortedResults.length / RESULTS_PER_PAGE);

    // Reset selection when filters/page changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [searchTerm, statusFilter, currentPage]);

    const handleSelect = (id: string) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIdsOnPage = paginatedResults.map(r => r.id);
            setSelectedIds(new Set(allIdsOnPage));
        } else {
            setSelectedIds(new Set());
        }
    };
    
    const isAllSelectedOnPage = paginatedResults.length > 0 && paginatedResults.every(r => selectedIds.has(r.id));

    const requestSort = (key: keyof StudentResult) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: keyof StudentResult) => {
        if (!sortConfig || sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    }
    
    const exportToCSV = () => {
        const dataToExport = results.filter(res => {
            if (exportStatusFilter !== 'All' && res.status !== exportStatusFilter) return false;
            
            const resultDate = new Date(res.processingDate);
            resultDate.setHours(0, 0, 0, 0); // Normalize date

            if (exportStartDate) {
                const startDate = new Date(exportStartDate);
                if (resultDate < startDate) return false;
            }
            if (exportEndDate) {
                const endDate = new Date(exportEndDate);
                if (resultDate > endDate) return false;
            }
            return true;
        });
        
        if (dataToExport.length === 0) {
            alert("No results match the selected export filters.");
            return;
        }

        const headers = ['studentId', 'processingDate', 'totalScore', 'status', 'confidence', 'examSet', ...SECTIONS];
        const rows = dataToExport.map(res => [
            `"${res.studentId}"`,
            new Date(res.processingDate).toISOString().split('T')[0],
            res.totalScore,
            res.status,
            res.confidence.toFixed(3),
            res.examSet,
            ...SECTIONS.map(sec => res.sectionScores[sec])
        ].join(','));
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "omr_results_filtered.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <div className="sm:flex sm:items-start sm:justify-between mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white shrink-0">Evaluation Results</h2>
                
                <div className="mt-4 sm:mt-0 w-full max-w-lg">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Export Options</h4>
                        <div className="flex flex-col sm:flex-row gap-4 items-start mb-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Status</label>
                                <div className="flex items-center space-x-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-md">
                                    {(['All', 'Complete', 'Needs Review'] as const).map(status => (
                                        <button
                                            key={status}
                                            onClick={() => setExportStatusFilter(status)}
                                            className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${exportStatusFilter === status ? 'bg-white dark:bg-slate-600 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                             <div className="flex gap-2 w-full sm:w-auto">
                                <div className="flex-1">
                                    <label htmlFor="start-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                                    <input id="start-date" type="date" value={exportStartDate} onChange={e => setExportStartDate(e.target.value)} className="text-xs w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="end-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                                    <input id="end-date" type="date" value={exportEndDate} onChange={e => setExportEndDate(e.target.value)} className="text-xs w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
                                </div>
                            </div>
                        </div>
                        <button onClick={exportToCSV} className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
                            <DownloadIcon className="w-5 h-5 mr-2" />
                            Export Filtered Results
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="mb-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-full sm:max-w-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <SearchIcon className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search Student ID..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="block w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md leading-5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="flex items-center space-x-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                    {(['All', 'Complete', 'Needs Review'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${statusFilter === status ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow' : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                            <tr>
                                <th scope="col" className="px-4 py-3">
                                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={isAllSelectedOnPage}
                                        onChange={handleSelectAll}
                                        aria-label="Select all results on this page"
                                    />
                                </th>
                                {([
                                    { key: 'studentId', name: 'Student ID' },
                                    { key: 'totalScore', name: 'Total Score' },
                                    { key: 'status', name: 'Status' },
                                    { key: 'processingDate', name: 'Processing Date' },
                                    { key: 'confidence', name: 'Confidence' },
                                    { key: 'examSet', name: 'Set' }
                                ] as {key: keyof StudentResult, name: string}[]).map(({ key, name }) => (
                                     <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        <button className="flex items-center group" onClick={() => requestSort(key)}>
                                            {name}
                                            <span className="ml-2 text-slate-400 group-hover:text-slate-600 transition-opacity opacity-50 group-hover:opacity-100">{getSortIndicator(key)}</span>
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {paginatedResults.map(result => (
                                <tr key={result.id} className={`transition-colors ${selectedIds.has(result.id) ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                    <td className="px-4 py-4">
                                        <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={selectedIds.has(result.id)}
                                            onChange={() => handleSelect(result.id)}
                                            aria-label={`Select result for ${result.studentId}`}
                                        />
                                    </td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white cursor-pointer">{result.studentId}</td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 font-bold cursor-pointer">{result.totalScore}</td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            result.status === 'Needs Review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300'
                                        }`}>
                                            {result.status}
                                        </span>
                                    </td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 cursor-pointer">{new Date(result.processingDate).toLocaleDateString()}</td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 cursor-pointer">{(result.confidence * 100).toFixed(1)}%</td>
                                    <td onClick={() => setSelectedResult(result)} className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 cursor-pointer">{result.examSet}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                 {/* Pagination & Batch Actions */}
                <div className="px-6 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
                     {selectedIds.size > 0 ? (
                        <div className="flex items-center gap-4">
                             <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{selectedIds.size} selected</span>
                             <button onClick={() => { onApproveResults(Array.from(selectedIds)); setSelectedIds(new Set()); }} className="text-sm font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors">Approve</button>
                             <button onClick={() => { if (window.confirm(`Are you sure you want to delete ${selectedIds.size} results?`)) { onDeleteResults(Array.from(selectedIds)); setSelectedIds(new Set()); } }} className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors">Delete</button>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Showing <span className="font-medium">{(currentPage - 1) * RESULTS_PER_PAGE + 1}</span> to <span className="font-medium">{Math.min(currentPage * RESULTS_PER_PAGE, sortedResults.length)}</span> of <span className="font-medium">{sortedResults.length}</span> results
                        </p>
                    )}
                    <div className="flex items-center space-x-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700">
                            <ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                        <span className="text-sm text-slate-600 dark:text-slate-300 font-medium">{currentPage} / {totalPages || 1}</span>
                         <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700">
                            <ChevronRightIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>
                </div>
            </div>
            {selectedResult && <IndividualResultModal result={selectedResult} onClose={() => setSelectedResult(null)} onApprove={onApproveResult} />}
        </div>
    );
};


const AnalyticsView: React.FC<{ results: StudentResult[] }> = ({ results }) => {
    const [insights, setInsights] = useState<string>('');
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);

    const analyticsData = useMemo(() => {
        if (results.length === 0) return { avgScore: 0, sectionAvgs: [], passRate: 0, questionDifficulty: [] };

        const totalStudents = results.length;
        const totalScoreSum = results.reduce((sum, r) => sum + r.totalScore, 0);
        const avgScore = totalScoreSum / totalStudents;
        
        const sectionTotals: { [key in SectionName]: number } = { 'Data Analytics': 0, 'AI/ML': 0, 'Data Science': 0, 'Generative AI': 0, 'Statistics': 0 };
        results.forEach(r => {
            SECTIONS.forEach(section => {
                sectionTotals[section] += r.sectionScores[section];
            });
        });

        const sectionAvgs = SECTIONS.map(section => ({
            name: section,
            avgScore: sectionTotals[section] / totalStudents
        }));

        const passedCount = results.filter(r => r.totalScore >= 50).length;
        const passRate = (passedCount / totalStudents) * 100;
        
        const incorrectCounts = new Array(50).fill(0);
        results.forEach(result => {
            result.answers.forEach(answer => {
                if (!answer.isCorrect) {
                    incorrectCounts[answer.question - 1]++;
                }
            });
        });
        const questionDifficulty = incorrectCounts.map((count, index) => ({
            name: `Q${index + 1}`,
            incorrect: (count / totalStudents) * 100
        })).sort((a, b) => b.incorrect - a.incorrect).slice(0, 10); // Top 10


        return { avgScore, sectionAvgs, passRate, questionDifficulty };
    }, [results]);

    const handleGenerateInsights = async () => {
        setIsLoadingInsights(true);
        setInsights('');
        const result = await generateAnalyticsInsights(results);
        setInsights(result);
        setIsLoadingInsights(false);
    };

    const barColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088FE", "#00C49F", "#FFBB28"];

    const renderInsights = () => {
        const lines = insights.split('\n').filter(line => line.trim() !== '');
        return (
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 space-y-2">
                {lines.map((line, i) => {
                    if (line.startsWith('**') && line.endsWith('**')) {
                        return <h4 key={i} className="font-bold text-base text-slate-800 dark:text-slate-200 !mt-4 !mb-1">{line.replace(/\*\*/g, '')}</h4>;
                    }
                    if (/^\d+\.\s/.test(line)) {
                        return <p key={i} className="!my-0.5"><span className="font-semibold">{line.substring(0, 2)}</span>{line.substring(2)}</p>;
                    }
                    return <p key={i} className="!my-0.5">{line}</p>;
                })}
            </div>
        );
    }
    
    const AiInsightsSkeleton = () => (
        <div className="space-y-4 animate-pulse">
            <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
            </div>
            <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                 <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/6"></div>
            </div>
             <div className="space-y-2">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Performance Analytics</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6 flex flex-col justify-center items-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Average Score</p>
                    <p className="text-5xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">{analyticsData.avgScore.toFixed(1)}</p>
                 </div>
                 <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6 flex flex-col justify-center items-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Pass Rate (>=50)</p>
                    <p className="text-5xl font-extrabold text-green-600 dark:text-green-400 mt-2">{analyticsData.passRate.toFixed(1)}%</p>
                 </div>
                 <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6 flex flex-col justify-center items-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Sheets</p>
                    <p className="text-5xl font-extrabold text-slate-800 dark:text-slate-200 mt-2">{results.length}</p>
                 </div>
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Average Score by Section</h3>
                     <div className="w-full h-96">
                        <ResponsiveContainer>
                            <BarChart data={analyticsData.sectionAvgs} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                                <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" />
                                <Tooltip
                                    cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        border: '1px solid #e2e8f0',
                                        backdropFilter: 'blur(5px)',
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                />
                                <Bar dataKey="avgScore" name="Avg Score / 20" barSize={20}>
                                    {analyticsData.sectionAvgs.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6">
                     <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Top 10 Most Difficult Questions</h3>
                     <div className="w-full h-96">
                        <ResponsiveContainer>
                            <BarChart data={analyticsData.questionDifficulty} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'currentColor' }} className="text-slate-600 dark:text-slate-400" />
                                <Tooltip
                                    formatter={(value: number) => `${value.toFixed(1)}%`}
                                    cursor={{fill: 'rgba(100, 116, 139, 0.1)'}}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '0.5rem',
                                    }}
                                />
                                <Bar dataKey="incorrect" name="% Incorrect" fill="#ef4444" barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-slate-800 shadow-xl rounded-2xl p-6 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">AI-Powered Insights</h3>
                        <SparklesIcon className="w-6 h-6 text-indigo-500"/>
                    </div>
                    <div className="flex-grow min-h-[200px]">
                        {isLoadingInsights && <AiInsightsSkeleton />}
                        {!isLoadingInsights && insights && (
                            <div className="h-full overflow-y-auto pr-2 text-sm">
                               {renderInsights()}
                            </div>
                        )}
                        {!isLoadingInsights && !insights && (
                            <div className="text-center flex flex-col items-center justify-center h-full">
                                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Get a detailed analysis of class performance, including strengths, weaknesses, and recommendations.</p>
                                <button
                                    onClick={handleGenerateInsights}
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform hover:scale-105"
                                >
                                    Generate AI Insights
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Main App Component ---
const App: React.FC = () => {
    const [view, setView] = useState<AppView>('upload');
    const [omrFiles, setOmrFiles] = useState<OMRFile[]>([]);
    const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
    const [totalProcessed, setTotalProcessed] = useState(0);
    const isInitialMount = useRef(true);

    // Load state from localStorage on initial mount
    useEffect(() => {
        try {
            const savedResults = localStorage.getItem('studentResults');
            const savedTotal = localStorage.getItem('totalProcessed');
            if (savedResults) {
                setStudentResults(JSON.parse(savedResults));
            }
            if (savedTotal) {
                setTotalProcessed(JSON.parse(savedTotal));
            }
        } catch (error) {
            console.error("Failed to load state from localStorage", error);
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        try {
            localStorage.setItem('studentResults', JSON.stringify(studentResults));
            localStorage.setItem('totalProcessed', JSON.stringify(totalProcessed));
        } catch (error) {
            console.error("Failed to save state to localStorage", error);
        }
    }, [studentResults, totalProcessed]);

    const handleProcessStart = (files: OMRFile[]) => {
        setOmrFiles(files);
        setView('processing');
    };

    const handleProcessingComplete = (results: StudentResult[]) => {
        setStudentResults(prev => [...prev, ...results]);
        setTotalProcessed(prev => prev + results.length);
        setView('results');
    };
    
    const handleApproveResult = (resultId: string) => {
        setStudentResults(prevResults => prevResults.map(r => r.id === resultId ? { ...r, status: 'Complete', confidence: 1.0 } : r));
    };
    
    const handleApproveResults = (resultIds: string[]) => {
        const idsToUpdate = new Set(resultIds);
        setStudentResults(prev => prev.map(r => idsToUpdate.has(r.id) ? { ...r, status: 'Complete', confidence: 1.0 } : r));
    };

    const handleDeleteResults = (resultIds: string[]) => {
        const idsToDelete = new Set(resultIds);
        setStudentResults(prev => prev.filter(r => !idsToDelete.has(r.id)));
    };

    const renderView = () => {
        switch (view) {
            case 'upload':
                return <UploadView onProcessStart={handleProcessStart} totalProcessed={totalProcessed} />;
            case 'processing':
                return <ProcessingDashboard files={omrFiles} onProcessingComplete={handleProcessingComplete} />;
            case 'results':
                return <ResultsView results={studentResults} onApproveResult={handleApproveResult} onApproveResults={handleApproveResults} onDeleteResults={handleDeleteResults} />;
            case 'analytics':
                 return <AnalyticsView results={studentResults} />;
            default:
                return <UploadView onProcessStart={handleProcessStart} totalProcessed={totalProcessed} />;
        }
    };

    return (
        <main className="pb-16 md:pb-0">
            <Header view={view} setView={setView} hasResults={studentResults.length > 0} />
            {renderView()}
             {/* Mobile Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-50 flex justify-around">
                {['upload', 'results', 'analytics'].map(v => {
                    const isEnabled = v === 'upload' || studentResults.length > 0;
                    return (
                        <button
                            key={v + '-mobile'}
                            onClick={() => isEnabled && setView(v as AppView)}
                            disabled={!isEnabled}
                            className={`flex-1 capitalize text-xs font-medium py-3 text-center transition-colors ${
                                view === v ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                            } ${!isEnabled ? 'opacity-40' : ''}`}
                        >
                            {v}
                        </button>
                    )
                })}
            </nav>
        </main>
    );
};

export default App;
