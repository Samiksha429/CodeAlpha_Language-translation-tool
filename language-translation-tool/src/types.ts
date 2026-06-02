export interface TranslationResponse {
  translatedText: string;
  detectedLanguage: string;
  pronunciation?: string;
  explanations?: string;
  vocabulary?: Array<{
    word: string;
    translation: string;
    partOfSpeech?: string;
    explanation?: string;
  }>;
}

export interface DictionaryResponse {
  word: string;
  partOfSpeech: string;
  directTranslation: string;
  definition: string;
  synonyms?: string[];
  examples: Array<{
    original: string;
    translation: string;
  }>;
}

export interface LanguageItem {
  name: string;
  code: string; // Speech synthesis locale code
  flag: string; // Emoji flag for aesthetics
  greeting: string; // Cool sample greeting
}

export interface SavedTranslation {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

export interface TranslationHistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}
