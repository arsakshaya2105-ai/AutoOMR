import { GoogleGenAI } from "@google/genai";
import { StudentResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  // In a real app, you'd handle this more gracefully.
  // Here we assume it's set in the environment.
  console.warn("Gemini API key not found in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const generateAnalyticsInsights = async (results: StudentResult[]): Promise<string> => {
  if (!API_KEY) {
    return "API Key not configured. Please set the API_KEY environment variable.";
  }

  // Pass more detailed info for better analysis
  const detailedResults = results.map(r => ({
    studentId: r.studentId,
    totalScore: r.totalScore,
    sections: r.sectionScores,
    answers: r.answers.map(a => ({ q: a.question, correct: a.isCorrect })),
  }));

  const prompt = `
    As an expert educational analyst, examine the following OMR test results for a class.
    The total possible score is 100. The sections are 'Data Analytics', 'AI/ML', 'Data Science', 'Generative AI', and 'Statistics'.

    Results data (includes individual question correctness):
    ${JSON.stringify(detailedResults, null, 2)}

    Provide a concise, insightful analysis of the class's performance. Structure your response in Markdown with the following sections:
    1.  **Overall Performance Summary:** A brief overview of the average score, and general pass/fail impressions.
    2.  **Strengths:** Identify the sections or topics where students performed the best.
    3.  **Areas for Improvement:** Pinpoint the sections or topics where students struggled the most.
    4.  **Question Analysis:** Identify the top 3 most frequently missed questions. List them and briefly speculate why they might have been difficult.
    5.  **Actionable Recommendations:** Suggest 2-3 specific actions instructors could take to address the identified weaknesses.

    Keep the analysis professional, data-driven, and easy to understand.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating insights from Gemini:", error);
    return "An error occurred while generating AI insights. Please check the console for details.";
  }
};