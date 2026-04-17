/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, Content } from "@google/genai";

const getAI = (apiKey?: string) => {
  return new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });
};

export const analyzeCode = async (code: string, apiKey?: string) => {
  try {
    const ai = getAI(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Analyze the following code for bugs, suggest improvements, and provide a brief explanation. 
      Return the result in JSON format with the following structure:
      {
        "bugs": ["list of bugs"],
        "suggestions": ["list of improvements"],
        "explanation": "brief explanation",
        "refactoredCode": "the improved code"
      }
      
      Code:
      ${code}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bugs: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            explanation: { type: Type.STRING },
            refactoredCode: { type: Type.STRING }
          },
          required: ["bugs", "suggestions", "explanation"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    const isRateLimit = error?.message?.includes("429") || error?.status === 429 || JSON.stringify(error).includes("429") || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
    
    return {
      bugs: ["Failed to analyze code"],
      suggestions: [],
      explanation: isRateLimit ? "⚠️ **Rate Limit Exceeded:** The Gemini API quota has been exhausted. Please check your API key billing details or try again later." : "Analysis service unavailable."
    };
  }
};



export const chatWithAgent = async (message: string, history: Content[] = [], systemInstruction: string = "", apiKey?: string, model: string = "gemini-3.1-pro-preview") => {
  try {
    const ai = getAI(apiKey);
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction,
      },
      history: history
    });
    const response = await chat.sendMessage({ message });
    return response.text || "I am observing.";
  } catch (error: any) {
    console.error("Agent Chat Error:", error);
    const isRateLimit = error?.message?.includes("429") || error?.status === 429 || JSON.stringify(error).includes("429") || JSON.stringify(error).includes("RESOURCE_EXHAUSTED");
    
    if (isRateLimit) {
      return "⚠️ **Rate Limit Exceeded:** The Gemini API quota has been exhausted. Please check your plan and billing details at [https://ai.dev/rate-limit](https://ai.dev/rate-limit) or try again later.";
    }
    
    return "My connection to the network is temporarily disrupted.";
  }
};
