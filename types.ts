export type AppView = 'upload' | 'processing' | 'results' | 'analytics';

export interface OMRFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'preprocessing' | 'detecting' | 'scoring' | 'complete' | 'error';
  studentId?: string;
}

export interface SectionScores {
  'Data Analytics': number;
  'AI/ML': number;
  'Data Science': number;
  'Generative AI': number;
  'Statistics': number;
}

export type SectionName = keyof SectionScores;

export interface AnswerDetail {
  question: number;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface StudentResult {
  id: string;
  studentId: string;
  examSet: 'A' | 'B' | 'C' | 'D';
  sectionScores: SectionScores;
  totalScore: number;
  confidence: number;
  status: 'Complete' | 'Needs Review';
  answers: AnswerDetail[];
  originalImage: string;
  processingDate: Date;
}