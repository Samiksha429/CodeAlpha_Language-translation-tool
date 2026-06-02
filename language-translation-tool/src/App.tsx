import { useState, useEffect } from "react";
import {
  Languages,
  Volume2,
  Copy,
  Check,
  Trash2,
  History,
  BookOpen,
  Sparkles,
  ArrowLeftRight,
  Bookmark,
  X,
  Search,
  Compass,
  FileText,
  Moon,
  Sun,
  Globe,
  Star,
  CornerDownRight,
  Sparkle
} from "lucide-react";
import { LANGUAGES, TONE_PRESETS } from "./languages";
import {
  TranslationResponse,
  DictionaryResponse,
  SavedTranslation,
  TranslationHistoryItem,
  LanguageItem
} from "./types";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType
} from "./firebase";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  limit
} from "firebase/firestore";

export default function App() {
  // Navigation active tab: 'translation' | 'saved' | 'history' | 'dictionary'
  const [activeTab, setActiveTab] = useState<"translation" | "saved" | "history" | "dictionary">("translation");

  // Theme support
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Auth support
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Core translation settings
  const [sourceText, setSourceText] = useState<string>("");
  const [sourceLang, setSourceLang] = useState<string>("Auto Detect");
  const [targetLang, setTargetLang] = useState<string>("Spanish");
  const [selectedTone, setSelectedTone] = useState<string>("Standard");

  // Output response state
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationResult, setTranslationResult] = useState<TranslationResponse | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Search input filters for 100+ languages
  const [searchSourceQuery, setSearchSourceQuery] = useState<string>("");
  const [searchTargetQuery, setSearchTargetQuery] = useState<string>("");
  const [showSourceDropdown, setShowSourceDropdown] = useState<boolean>(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState<boolean>(false);

  // Dictionary lookup tab states
  const [dicQuery, setDicQuery] = useState<string>("");
  const [isSearchingDic, setIsSearchingDic] = useState<boolean>(false);
  const [dicResult, setDicResult] = useState<DictionaryResponse | null>(null);
  const [dicError, setDicError] = useState<string | null>(null);

  // Interactive UI feedback
  const [copiedInput, setCopiedInput] = useState<boolean>(false);
  const [copiedOutput, setCopiedOutput] = useState<boolean>(false);
  const [isSpeakingSource, setIsSpeakingSource] = useState<boolean>(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState<boolean>(false);

  // Persistence logic (localStorage)
  const [historyList, setHistoryList] = useState<TranslationHistoryItem[]>([]);
  const [savedList, setSavedList] = useState<SavedTranslation[]>([]);

  // Fetch from Firebase with fallback
  const fetchUserFirebaseData = async (userId: string) => {
    const historyPath = `users/${userId}/history`;
    const savedPath = `users/${userId}/saved`;

    try {
      const historyQuery = query(
        collection(db, "users", userId, "history"),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const historySnap = await getDocs(historyQuery).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, historyPath);
        throw err;
      });
      const historyItems: TranslationHistoryItem[] = [];
      historySnap.forEach((doc) => {
        historyItems.push(doc.data() as TranslationHistoryItem);
      });
      setHistoryList(historyItems);

      const savedQuery = query(
        collection(db, "users", userId, "saved"),
        orderBy("timestamp", "desc")
      );
      const savedSnap = await getDocs(savedQuery).catch((err) => {
        handleFirestoreError(err, OperationType.LIST, savedPath);
        throw err;
      });
      const savedItems: SavedTranslation[] = [];
      savedSnap.forEach((doc) => {
        savedItems.push(doc.data() as SavedTranslation);
      });
      setSavedList(savedItems);
    } catch (err: any) {
      console.error("Firebase data load failure (using offline cache):", err);
      loadOfflineCache();
    }
  };

  const loadOfflineCache = () => {
    const cachedHistory = localStorage.getItem("linguist_history");
    const cachedSaved = localStorage.getItem("linguist_saved");

    if (cachedHistory) {
      try {
        setHistoryList(JSON.parse(cachedHistory));
      } catch (e) {
        console.error(e);
      }
    } else {
      setHistoryList([]);
    }

    if (cachedSaved) {
      try {
        setSavedList(JSON.parse(cachedSaved));
      } catch (e) {
        console.error(e);
      }
    } else {
      setSavedList([]);
    }
  };

  // Listen to Auth stage
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setIsAuthLoading(false);

        // Sync or register profile information
        try {
          await setDoc(doc(db, "users", user.uid), {
            userId: user.uid,
            email: user.email || "",
            displayName: user.displayName || "Google User",
            createdAt: new Date().toISOString()
          }, { merge: true });
        } catch (err) {
          console.error("User profile registration failure:", err);
        }

        await fetchUserFirebaseData(user.uid);
      } else {
        setCurrentUser(null);
        setIsAuthLoading(false);
        loadOfflineCache();
      }
    });

    const cachedTheme = localStorage.getItem("linguist_dark_theme");
    if (cachedTheme !== null) {
      setIsDarkMode(cachedTheme === "true");
    }

    return () => unsubscribe();
  }, []);

  // Google Single Sign-On login action
  const handleSignIn = async () => {
    setErrorStatus(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Failed to authenticate with Google auth provider.");
    }
  };

  // Log-out action
  const handleSignOut = async () => {
    setErrorStatus(null);
    try {
      await signOut(auth);
      setHistoryList([]);
      setSavedList([]);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "Failed to terminate user session.");
    }
  };

  // Set theme mode locally
  const toggleTheme = () => {
    const nextState = !isDarkMode;
    setIsDarkMode(nextState);
    localStorage.setItem("linguist_dark_theme", String(nextState));
  };

  // Helper functions to save state safely
  const updateAndSaveHistory = (updated: TranslationHistoryItem[]) => {
    setHistoryList(updated);
    localStorage.setItem("linguist_history", JSON.stringify(updated));
  };

  const updateAndSaveSaved = (updated: SavedTranslation[]) => {
    setSavedList(updated);
    localStorage.setItem("linguist_saved", JSON.stringify(updated));
  };

  // Language flag finder
  const getLangFlag = (name: string): string => {
    const found = LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase());
    return found ? found.flag : "🌐";
  };

  const getLangLocale = (name: string): string => {
    const found = LANGUAGES.find((l) => l.name.toLowerCase() === name.toLowerCase());
    return found ? found.code : "en-US";
  };

  // Swapper function
  const handleSwapLanguages = () => {
    let resolvedS = sourceLang;
    if (sourceLang === "Auto Detect") {
      if (translationResult && translationResult.detectedLanguage) {
        resolvedS = translationResult.detectedLanguage;
      } else {
        resolvedS = "English";
      }
    }

    setSourceLang(targetLang);
    setTargetLang(resolvedS);

    if (translationResult?.translatedText) {
      setSourceText(translationResult.translatedText);
      setTranslationResult({
        translatedText: sourceText,
        detectedLanguage: targetLang,
        pronunciation: "",
        explanations: ""
      });
    }
  };

  // Handle translation triggering
  const triggerTranslation = async (customText?: string) => {
    const textToTranslate = customText !== undefined ? customText : sourceText;
    if (!textToTranslate || !textToTranslate.trim()) {
      return;
    }

    setIsTranslating(true);
    setErrorStatus(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          tone: selectedTone
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server could not process translation");
      }

      const data: TranslationResponse = await response.json();
      setTranslationResult(data);

      // Save to logs history
      const newItem: TranslationHistoryItem = {
        id: "hist_" + Date.now(),
        sourceText: textToTranslate,
        translatedText: data.translatedText,
        sourceLang: data.detectedLanguage || sourceLang,
        targetLang: targetLang,
        timestamp: Date.now()
      };

      if (currentUser) {
        const path = `users/${currentUser.uid}/history/${newItem.id}`;
        try {
          await setDoc(doc(db, "users", currentUser.uid, "history", newItem.id), newItem);
          setHistoryList((prev) => [newItem, ...prev.slice(0, 49)]);
        } catch (err: any) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      } else {
        const updatedHist = [newItem, ...historyList.slice(0, 49)];
        updateAndSaveHistory(updatedHist);
      }

    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "An unexpected error occurred during translation request.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Play audio TTS
  const runVoiceSynthesize = (text: string, langName: string, isSource: boolean) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();

      if (isSource) setIsSpeakingSource(true);
      else setIsSpeakingTarget(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getLangLocale(langName);

      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find((v) => v.lang.startsWith(utterance.lang));
      if (matchVoice) {
        utterance.voice = matchVoice;
      }

      utterance.onend = () => {
        setIsSpeakingSource(false);
        setIsSpeakingTarget(false);
      };
      utterance.onerror = () => {
        setIsSpeakingSource(false);
        setIsSpeakingTarget(false);
      };

      window.speechSynthesis.speak(utterance);
    } else {
      alert("TTS Pronunciation is not supported in this browser version.");
    }
  };

  // Star / Bookmark current calculation
  const handleSaveCurrent = async () => {
    if (!sourceText.trim() || !translationResult) return;

    const isAlreadySaved = savedList.some(
      (item) => item.sourceText === sourceText && item.translatedText === translationResult.translatedText
    );

    if (isAlreadySaved) {
      const matchItem = savedList.find(
        (item) => item.sourceText === sourceText && item.translatedText === translationResult.translatedText
      );
      if (matchItem) {
        await handleRemoveSaved(matchItem.id);
      }
      return;
    }

    const newSaved: SavedTranslation = {
      id: "save_" + Date.now(),
      sourceText,
      translatedText: translationResult.translatedText,
      sourceLang: translationResult.detectedLanguage || sourceLang,
      targetLang: targetLang,
      timestamp: Date.now()
    };

    if (currentUser) {
      const path = `users/${currentUser.uid}/saved/${newSaved.id}`;
      try {
        await setDoc(doc(db, "users", currentUser.uid, "saved", newSaved.id), newSaved);
        setSavedList((prev) => [newSaved, ...prev]);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    } else {
      updateAndSaveSaved([newSaved, ...savedList]);
    }
  };

  const handleRemoveSaved = async (id: string) => {
    if (currentUser) {
      const path = `users/${currentUser.uid}/saved/${id}`;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "saved", id));
        setSavedList((prev) => prev.filter((item) => item.id !== id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      const filtered = savedList.filter((item) => item.id !== id);
      updateAndSaveSaved(filtered);
    }
  };

  const handleRemoveHistory = async (id: string) => {
    if (currentUser) {
      const path = `users/${currentUser.uid}/history/${id}`;
      try {
        await deleteDoc(doc(db, "users", currentUser.uid, "history", id));
        setHistoryList((prev) => prev.filter((item) => item.id !== id));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    } else {
      const filtered = historyList.filter((item) => item.id !== id);
      updateAndSaveHistory(filtered);
    }
  };

  const handleClearHistory = async () => {
    if (currentUser) {
      // Delete history item logs individually to satisfy permissions
      const deletionPromises = historyList.map(async (item) => {
        const path = `users/${currentUser.uid}/history/${item.id}`;
        try {
          await deleteDoc(doc(db, "users", currentUser.uid, "history", item.id));
        } catch (err: any) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      });
      await Promise.all(deletionPromises);
      setHistoryList([]);
    } else {
      updateAndSaveHistory([]);
    }
  };

  const handleLoadHistoryItem = (item: TranslationHistoryItem | SavedTranslation) => {
    setSourceText(item.sourceText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setTranslationResult({
      translatedText: item.translatedText,
      detectedLanguage: item.sourceLang,
      pronunciation: "",
      explanations: ""
    });
    setActiveTab("translation");
  };

  // Dictionary lookups
  const triggerDictionaryLookup = async (wordToSearch: string) => {
    if (!wordToSearch || !wordToSearch.trim()) return;

    setActiveTab("dictionary");
    setDicQuery(wordToSearch);
    setIsSearchingDic(true);
    setDicError(null);
    setDicResult(null);

    try {
      const response = await fetch("/api/dictionary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: wordToSearch,
          sourceLanguage: translationResult?.detectedLanguage || sourceLang,
          targetLanguage: targetLang
        })
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve linguistic definition at this moment.");
      }

      const data: DictionaryResponse = await response.json();
      setDicResult(data);
    } catch (err: any) {
      console.error(err);
      setDicError(err.message || "An error occurred during lookup.");
    } finally {
      setIsSearchingDic(false);
    }
  };

  const handleCopyToClipboard = (text: string, isInput: boolean) => {
    navigator.clipboard.writeText(text);
    if (isInput) {
      setCopiedInput(true);
      setTimeout(() => setCopiedInput(false), 2000);
    } else {
      setCopiedOutput(true);
      setTimeout(() => setCopiedOutput(false), 2000);
    }
  };

  // Dropdown list filters for the 100+ languages list
  const filteredSourceLangs = LANGUAGES.filter((lang) =>
    lang.name.toLowerCase().includes(searchSourceQuery.toLowerCase())
  );

  const filteredTargetLangs = LANGUAGES.filter((lang) =>
    lang.name !== "Auto Detect" &&
    lang.name.toLowerCase().includes(searchTargetQuery.toLowerCase())
  );

  const isStarred = translationResult
    ? savedList.some(
        (item) => item.sourceText === sourceText && item.translatedText === translationResult.translatedText
      )
    : false;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 font-sans ${
        isDarkMode ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* 1. TOP HEADER (Sleek Theme Layout) */}
      <header
        className={`h-20 flex items-center justify-between px-4 md:px-12 border-b sticky top-0 z-50 transition-colors duration-300 ${
          isDarkMode ? "bg-slate-900/90 border-slate-800/80 backdrop-blur-md" : "bg-white border-slate-200 backdrop-blur-md"
        }`}
      >
        {/* Brand logo container */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-500/30">
            L
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">
            Linguist<span className="text-indigo-500">AI</span>
          </h1>
        </div>

        {/* Dynamic navigation links */}
        <nav className="flex items-center gap-1 sm:gap-4 md:gap-6 text-[13px] md:text-sm font-medium">
          <button
            onClick={() => setActiveTab("translation")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "translation"
                ? isDarkMode
                  ? "bg-indigo-500/10 text-indigo-400 font-bold border-b-2 border-indigo-500 rounded-b-none py-3"
                  : "bg-indigo-50 text-indigo-700 font-bold border-b-2 border-indigo-600 rounded-b-none py-3"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Translate
          </button>
          
          <button
            onClick={() => setActiveTab("dictionary")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "dictionary"
                ? isDarkMode
                  ? "bg-indigo-500/10 text-indigo-400 font-bold border-b-2 border-indigo-500 rounded-b-none py-3"
                  : "bg-indigo-50 text-indigo-700 font-bold border-b-2 border-indigo-600 rounded-b-none py-3"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            Linguistic Dictionary
          </button>

          <button
            onClick={() => setActiveTab("saved")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer relative ${
              activeTab === "saved"
                ? isDarkMode
                  ? "bg-indigo-500/10 text-indigo-400 font-bold border-b-2 border-indigo-500 rounded-b-none py-3"
                  : "bg-indigo-50 text-indigo-700 font-bold border-b-2 border-indigo-600 rounded-b-none py-3"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            <span>Saved</span>
            {savedList.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black">
                {savedList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeTab === "history"
                ? isDarkMode
                  ? "bg-indigo-500/10 text-indigo-400 font-bold border-b-2 border-indigo-500 rounded-b-none py-3"
                  : "bg-indigo-50 text-indigo-700 font-bold border-b-2 border-indigo-600 rounded-b-none py-3"
                : isDarkMode
                ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            }`}
          >
            History
          </button>
        </nav>

        {/* Right tools: Dark/Light Mode switch, version label, SSO Widget */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            onClick={toggleTheme}
            id="toggle-dark-mode-button"
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              isDarkMode
                ? "bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-750"
                : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <div className="hidden lg:flex text-xs font-mono tracking-tight bg-slate-800/40 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-750">
            Engine: <span className="text-indigo-400 font-bold ml-1">Gemini Pro</span>
          </div>

          {isAuthLoading ? (
            <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
          ) : currentUser ? (
            <div className="flex items-center gap-2">
              <div 
                className="flex flex-col items-end hidden sm:flex"
                title={`${currentUser.displayName || "Google User"} (${currentUser.email})`}
              >
                <span className="text-xs font-bold leading-none">{currentUser.displayName || "Google User"}</span>
                <span className="text-[9px] text-indigo-400 font-mono leading-none mt-1">Cloud Synced ✅</span>
              </div>
              <button
                onClick={handleSignOut}
                className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
                  isDarkMode
                    ? "bg-slate-800 border-slate-750 text-slate-200 hover:bg-rose-950/20 hover:border-rose-900/40 hover:text-rose-400"
                    : "bg-slate-100 border-slate-250 text-slate-750 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700"
                }`}
                title="Disconnect Google authentication session"
              >
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="User" 
                    referrerPolicy="no-referrer" 
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                    {(currentUser.displayName || "G").charAt(0).toUpperCase()}
                  </div>
                )}
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                isDarkMode
                  ? "bg-indigo-650/40 border-indigo-550/50 text-indigo-300 hover:bg-indigo-600 hover:text-white"
                  : "bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              }`}
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.211 4.114a5.98 5.98 0 0 1-5.98-5.98c0-3.3 2.68-5.98 5.98-5.98 1.48 0 2.83.54 3.88 1.43l3.22-3.22A10.15 10.15 0 0 0 12.24 2c-5.59 0-10.12 4.53-10.12 10.12a10.14 10.14 0 0 0 10.12 10.12c5.73 0 9.88-3.9 9.88-9.88 0-.67-.09-1.34-.23-1.99s-.65-.09-.65-.09H12.24z"/>
              </svg>
              <span>Connect</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. BODY CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">

        {/* Server check/Error warning */}
        {errorStatus && (
          <div
            className={`p-4 border rounded-2xl flex items-start gap-3 shadow-sm ${
              isDarkMode ? "bg-slate-900 border-rose-950/50 text-rose-300" : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <span className="p-1.5 bg-rose-900/20 rounded-full text-rose-400 text-sm">⚠️</span>
            <div className="flex-1">
              <h4 className="font-semibold text-sm">Neural Translation Status Notice</h4>
              <p className="text-xs mt-0.5 leading-relaxed opacity-90">{errorStatus}</p>
              <span className="text-[10px] mt-1 block opacity-70">
                Tip: Kindly confirm your GEMINI_API_KEY environment config in the System Panel.
              </span>
            </div>
            <button
              onClick={() => setErrorStatus(null)}
              className="text-rose-400 hover:text-rose-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* A. TRANSLATE WORKING TAB */}
        {activeTab === "translation" && (
          <div className="flex flex-col gap-6">
            
            {/* SEARCH-SUPPORT LANGUAGE SELECTORS (Resolves dropdown scrolling with 100+ languages!) */}
            <div
              className={`p-4 rounded-2xl border transition-colors duration-300 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-xs"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Source Selection Panel */}
                <div className="relative w-full md:w-auto flex-1 flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-15 md:w-auto shrink-0">Source</span>
                  
                  <div className="relative w-full">
                    <button
                      onClick={() => {
                        setShowSourceDropdown(!showSourceDropdown);
                        setShowTargetDropdown(false);
                      }}
                      className={`w-full md:w-64 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all ${
                        isDarkMode
                          ? "bg-slate-950 border-slate-800 text-slate-100 hover:border-slate-700"
                          : "bg-slate-100 border-slate-200 text-slate-800 hover:border-indigo-300"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{getLangFlag(sourceLang)}</span>
                        <span>{sourceLang === "Auto Detect" ? "Auto Detect Language" : sourceLang}</span>
                      </span>
                      <span className="text-slate-400 text-[10px]">▼</span>
                    </button>

                    {/* Search filter dropdown list */}
                    {showSourceDropdown && (
                      <div
                        className={`absolute left-0 mt-2 w-full md:w-72 rounded-2xl shadow-xl z-50 border p-3 flex flex-col gap-2 ${
                          isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-slate-400">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            placeholder="Search Source Language..."
                            value={searchSourceQuery}
                            onChange={(e) => setSearchSourceQuery(e.target.value)}
                            className={`w-full text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-hidden ${
                              isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 mt-1">
                          <button
                            onClick={() => {
                              setSourceLang("Auto Detect");
                              setSearchSourceQuery("");
                              setShowSourceDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg ${
                              sourceLang === "Auto Detect"
                                ? "bg-indigo-600 text-white"
                                : isDarkMode
                                ? "hover:bg-slate-800 text-slate-300"
                                : "hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            ✨ Auto Detect Language
                          </button>

                          {filteredSourceLangs.map((lang) => (
                            <button
                              key={lang.name}
                              onClick={() => {
                                setSourceLang(lang.name);
                                setSearchSourceQuery("");
                                setShowSourceDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-between ${
                                sourceLang === lang.name
                                  ? "bg-indigo-600 text-white"
                                  : isDarkMode
                                  ? "hover:bg-slate-800 text-slate-300"
                                  : "hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="truncate">
                                {lang.flag} {lang.name}
                              </span>
                              {sourceLang === lang.name && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Swapper button matches layout */}
                <button
                  onClick={handleSwapLanguages}
                  title="Swap source & destination languages"
                  className={`p-3 rounded-full transition-all border shrink-0 active:scale-95 cursor-pointer ${
                    isDarkMode
                      ? "bg-slate-950 border-slate-850 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300"
                      : "bg-slate-100 border-slate-200 hover:border-indigo-200 hover:bg-slate-50 text-indigo-600"
                  }`}
                >
                  <ArrowLeftRight className="w-4.5 h-4.5" />
                </button>

                {/* Target Selection Panel */}
                <div className="relative w-full md:w-auto flex-1 flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-15 md:w-auto shrink-0">Target</span>
                  
                  <div className="relative w-full">
                    <button
                      onClick={() => {
                        setShowTargetDropdown(!showTargetDropdown);
                        setShowSourceDropdown(false);
                      }}
                      className={`w-full md:w-64 flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all ${
                        isDarkMode
                          ? "bg-slate-950 border-slate-800 text-slate-100 hover:border-slate-700"
                          : "bg-indigo-50 border-indigo-100 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span>{getLangFlag(targetLang)}</span>
                        <span>{targetLang}</span>
                      </span>
                      <span className="text-slate-400 text-[10px]">▼</span>
                    </button>

                    {/* Search filter dropdown list */}
                    {showTargetDropdown && (
                      <div
                        className={`absolute left-0 mt-2 w-full md:w-72 rounded-2xl shadow-xl z-50 border p-3 flex flex-col gap-2 ${
                          isDarkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-slate-400">
                            <Search className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            placeholder="Search Target Language..."
                            value={searchTargetQuery}
                            onChange={(e) => setSearchTargetQuery(e.target.value)}
                            className={`w-full text-xs rounded-xl pl-9 pr-4 py-2 focus:outline-hidden ${
                              isDarkMode ? "bg-slate-950 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-850"
                            }`}
                          />
                        </div>

                        <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 mt-1">
                          {filteredTargetLangs.map((lang) => (
                            <button
                              key={lang.name}
                              onClick={() => {
                                setTargetLang(lang.name);
                                setSearchTargetQuery("");
                                setShowTargetDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center justify-between ${
                                targetLang === lang.name
                                  ? "bg-indigo-600 text-white"
                                  : isDarkMode
                                  ? "hover:bg-slate-800 text-slate-300"
                                  : "hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="truncate">
                                {lang.flag} {lang.name}
                              </span>
                              {targetLang === lang.name && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* DUAL WORKSPACE PANELS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* INPUT BOX */}
              <div
                className={`relative flex flex-col rounded-3xl border p-5 md:p-8 min-h-[380px] transition-all ${
                  isDarkMode
                    ? "bg-slate-900 border-slate-800 shadow-xl shadow-slate-950/20"
                    : "bg-white border-slate-200 shadow-lg shadow-slate-200/40"
                }`}
              >
                <textarea
                  value={sourceText}
                  onChange={(e) => setSourceText(e.target.value.slice(0, 5000))}
                  placeholder="Type or paste any text to translate..."
                  className={`flex-1 w-full min-h-[220px] resize-none text-xl md:text-2xl placeholder-slate-400 focus:outline-hidden leading-relaxed font-sans ${
                    isDarkMode ? "text-slate-100" : "text-slate-800"
                  }`}
                />

                {/* Left tools controls */}
                <div className="flex flex-wrap items-center justify-between mt-4 pt-4 border-t border-slate-800/10 dark:border-slate-800 gap-4">
                  <div className="flex items-center gap-1.5">
                    {sourceText.trim() && (
                      <>
                        <button
                          onClick={() => runVoiceSynthesize(sourceText, sourceLang === "Auto Detect" ? (translationResult?.detectedLanguage || "English") : sourceLang, true)}
                          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                            isSpeakingSource
                              ? isDarkMode
                                ? "bg-indigo-500/20 text-indigo-300"
                                : "bg-indigo-100 text-indigo-700"
                              : "text-slate-400 hover:text-indigo-500 hover:bg-slate-800/40"
                          }`}
                          title="Pronounce original text"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => handleCopyToClipboard(sourceText, true)}
                          className="p-2.5 text-slate-400 hover:text-indigo-500 rounded-xl transition-all hover:bg-slate-800/40 cursor-pointer"
                          title="Copy input text"
                        >
                          {copiedInput ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        </button>

                        <button
                          onClick={() => {
                            setSourceText("");
                            setTranslationResult(null);
                          }}
                          className="p-2.5 text-slate-400 hover:text-rose-500 rounded-xl transition-all hover:bg-rose-500/10 cursor-pointer"
                          title="Clear original text"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800/20 px-2.5 py-1 rounded-md">
                    {sourceText.length} / 5000 chars
                  </span>
                </div>
              </div>

              {/* TRANSLATED RESULT WINDOW */}
              <div
                className={`relative flex flex-col rounded-3xl p-5 md:p-8 min-h-[380px] transition-colors duration-300 shadow-xl ${
                  isDarkMode
                    ? "bg-slate-900 border border-slate-850 shadow-slate-950/30 text-white"
                    : "bg-gradient-to-br from-indigo-600 to-violet-800 text-white shadow-indigo-300/30"
                }`}
              >
                {isTranslating ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                    <div className="w-9 h-9 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
                    <p className="text-sm font-semibold opacity-90 animate-pulse tracking-wide">
                      Translating using Neural Gemini AI models...
                    </p>
                  </div>
                ) : translationResult ? (
                  <div className="flex-1 flex flex-col justify-between">
                    
                    <div>
                      {/* Language badges header */}
                      <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4 text-xs">
                        <div className="font-bold flex items-center gap-1.5 opacity-90">
                          <span>{getLangFlag(targetLang)} Translated To {targetLang}</span>
                        </div>
                        {sourceLang === "Auto Detect" && translationResult.detectedLanguage && (
                          <span className="bg-white/15 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                            Detected: {translationResult.detectedLanguage}
                          </span>
                        )}
                      </div>

                      {/* Prime Result Text */}
                      <div className="text-xl md:text-2xl font-light leading-relaxed select-text break-words whitespace-pre-wrap mb-4">
                        {translationResult.translatedText}
                      </div>

                      {/* IPA Phonetic spelling */}
                      {translationResult.pronunciation && (
                        <div className="mt-4 p-3 bg-white/10 rounded-xl text-xs flex items-start gap-2 border border-white/5 font-mono select-text">
                          <span className="font-black text-indigo-200 shrink-0 uppercase tracking-widest text-[9px] mt-0.5">Phonetics:</span>
                          <span className="opacity-95">{translationResult.pronunciation}</span>
                        </div>
                      )}

                      {/* Linguistic Tip breakdown */}
                      {translationResult.explanations && (
                        <div className="mt-4 text-xs opacity-85 leading-relaxed bg-black/15 rounded-xl p-3.5 border border-white/5 select-text">
                          <div className="font-bold text-indigo-200 flex items-center gap-1 mb-1">
                            <Sparkle className="w-3.5 h-3.5 text-amber-300 fill-amber-300 animate-spin" />
                            <span>Cultural & Grammar Insight:</span>
                          </div>
                          <p className="italic font-light">{translationResult.explanations}</p>
                        </div>
                      )}
                    </div>

                    {/* Bottom controls panel */}
                    <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-white/15 gap-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => runVoiceSynthesize(translationResult.translatedText, targetLang, false)}
                          className={`flex items-center gap-2 px-3 py-1.5 bg-white/15 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-xs font-semibold ${
                            isSpeakingTarget ? "bg-white text-indigo-900 ring-2 ring-indigo-300" : ""
                          }`}
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Speak</span>
                        </button>

                        <button
                          onClick={() => handleCopyToClipboard(translationResult.translatedText, false)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white/15 hover:bg-white/20 rounded-xl transition-all cursor-pointer text-xs font-semibold"
                        >
                          {copiedOutput ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedOutput ? "Copied!" : "Copy"}</span>
                        </button>

                        <button
                          onClick={handleSaveCurrent}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all cursor-pointer text-xs font-semibold ${
                            isStarred
                              ? "bg-amber-400 text-slate-900 font-bold"
                              : "bg-white/15 hover:bg-white/20"
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${isStarred ? "fill-slate-900" : ""}`} />
                          <span>{isStarred ? "Starred" : "Star"}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 opacity-80">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[10px] uppercase font-bold tracking-widest">Neural V4 Engine</span>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-12 opacity-55">
                    <Globe className="w-16 h-16 stroke-1.2 mb-4 text-white/70" />
                    <p className="text-2xl font-light">Your translated output will appear instantly here.</p>
                    <p className="text-xs opacity-75 mt-2">Just pick your formats, edit characters, and hit Translate!</p>
                  </div>
                )}
              </div>
            </div>

            {/* PRESET HIGHLIGHT CHIPS AND MAIN CATALYST BUTTON (Translates instantly) */}
            <div
              className={`p-5 rounded-3xl border flex flex-col md:flex-row items-center justify-between gap-6 transition-colors duration-300 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              {/* Style tone presets */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Select Linguistic Persona or Tone
                </span>
                <div className="flex flex-wrap gap-2">
                  {TONE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setSelectedTone(preset.name)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        selectedTone === preset.name
                          ? isDarkMode
                            ? "bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-950/40"
                            : "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                          : isDarkMode
                          ? "bg-slate-950 block text-slate-300 hover:text-slate-100 border-slate-800 hover:bg-slate-850"
                          : "bg-slate-50 text-slate-600 hover:text-slate-800 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-sm">{preset.icon}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Huge Catalyst Translate Button */}
              <button
                onClick={() => triggerTranslation()}
                disabled={isTranslating || !sourceText.trim()}
                className={`w-full md:w-auto group relative flex items-center justify-center gap-3 px-12 py-4.5 rounded-2xl text-white font-black text-lg shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500`}
              >
                <span>{isTranslating ? "Processing..." : "Translate Text"}</span>
                <Sparkles className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* KEY VOCABULARY SECTION (DYNAMIC FROM API PAYLOAD) */}
            {translationResult?.vocabulary && translationResult.vocabulary.length > 0 && (
              <div
                className={`p-6 md:p-8 rounded-3xl border transition-colors duration-300 ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-6 border-b border-slate-800/10 dark:border-slate-800 pb-4">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-lg font-bold">Generated Word-by-Word Vocabulary Breakdown</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {translationResult.vocabulary.map((vocab, i) => (
                    <div
                      key={i}
                      onClick={() => triggerDictionaryLookup(vocab.word)}
                      title="Click word to launch details in Linguistic Dictionary"
                      className={`p-4.5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
                        isDarkMode
                          ? "bg-slate-950 border-slate-850 hover:bg-slate-800/50 hover:border-indigo-500/30"
                          : "bg-slate-50 border-slate-200 hover:bg-indigo-50/50 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-base font-bold text-indigo-400 group-hover:text-indigo-300">
                          {vocab.word}
                        </span>
                        {vocab.partOfSpeech && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-md">
                            {vocab.partOfSpeech}
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-3 font-bold text-sm block">
                        → {vocab.translation}
                      </div>

                      {vocab.explanation && (
                        <p className="mt-2 text-xs text-slate-400 leading-relaxed italic border-t border-slate-800/20 dark:border-slate-800 pt-2 text-slate-500 font-light">
                          {vocab.explanation}
                        </p>
                      )}

                      <div className="mt-2 text-[10px] text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                        <Search className="w-3 h-3" />
                        <span>Interactive Lookup</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* B. LINGUISTIC DICTIONARY TAB */}
        {activeTab === "dictionary" && (
          <div className="flex flex-col gap-6">
            
            <div
              className={`p-6 md:p-8 rounded-3xl border transition-colors duration-300 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <div className="max-w-xl">
                <h2 className="text-xl md:text-2xl font-bold">Linguistic Context Dictionary</h2>
                <p className="text-xs text-slate-400 mt-1 mb-5 leading-relaxed">
                  Lookup idiomatic phrases, complex verbs, terms or sayings. Get detailed definitions, conjugation parts-of-speech, and authentic bilingual conversation parameters.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    triggerDictionaryLookup(dicQuery);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-3.5 text-slate-400">
                      <Search className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={dicQuery}
                      onChange={(e) => setDicQuery(e.target.value)}
                      placeholder="Type a word or phrase, e.g., 'Gratitude', 'C'est la vie'..."
                      className={`w-full border rounded-2xl py-3 pl-12 pr-4 font-semibold text-sm focus:outline-hidden ${
                        isDarkMode
                          ? "bg-slate-950 border-slate-800 focus:border-indigo-500 text-white placeholder-slate-500"
                          : "bg-slate-50 border-slate-200 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingDic || !dicQuery.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 rounded-2xl transition-all cursor-pointer disabled:opacity-50 text-xs uppercase tracking-wider shrink-0"
                  >
                    {isSearchingDic ? "Searching..." : "Lookup"}
                  </button>
                </form>
              </div>
            </div>

            {/* RESPONSE CONTAINER */}
            {isSearchingDic ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-white animate-spin"></div>
                <p className="text-xs text-slate-400 animate-pulse font-mono block">Querying system linguist index servers...</p>
              </div>
            ) : dicError ? (
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                <p className="font-bold text-sm text-slate-300">Context could not be retrieved</p>
                <p className="mt-1 leading-relaxed">Please try translating standard texts in the editor first.</p>
              </div>
            ) : dicResult ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Information Card */}
                <div
                  className={`p-6 rounded-3xl border flex flex-col justify-between transition-colors duration-300 ${
                    isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md">
                      {dicResult.partOfSpeech || "Vocabulary Term"}
                    </span>

                    <h3 className="text-3xl font-black mt-4 font-mono text-indigo-400">
                      {dicResult.word}
                    </h3>
                    
                    <div className="mt-4 pt-4 border-t border-slate-800/10 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                        Contextual Translation
                      </span>
                      <p className="text-xl font-bold">{dicResult.directTranslation}</p>
                    </div>

                    {dicResult.definition && (
                      <div className="mt-4 pt-4 border-t border-slate-800/10 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">
                          Semantic Definition
                        </span>
                        <p className="text-xs text-slate-400 leading-relaxed font-light">{dicResult.definition}</p>
                      </div>
                    )}
                  </div>

                  {dicResult.synonyms && dicResult.synonyms.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-slate-800/10 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-2">
                        Alternative Synonyms
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {dicResult.synonyms.map((syn, idx) => (
                          <span
                            key={idx}
                            onClick={() => {
                              setDicQuery(syn);
                              triggerDictionaryLookup(syn);
                            }}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-semibold cursor-pointer transition-all ${
                              isDarkMode
                                ? "bg-slate-950 border-slate-850 text-slate-300 hover:text-white hover:border-indigo-500"
                                : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
                            }`}
                          >
                            {syn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Rich conversational examples */}
                <div
                  className={`p-6 rounded-3xl border lg:col-span-2 flex flex-col justify-between transition-colors duration-300 ${
                    isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200 shadow-sm"
                  }`}
                >
                  <div>
                    <h4 className="text-lg font-bold flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      <span>Authentic Interactive Phrases</span>
                    </h4>
                    <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                      Observe how to integrate this term organically inside realistic bilingual conversation flows:
                    </p>

                    <div className="flex flex-col gap-4">
                      {dicResult.examples.map((ex, k) => (
                        <div
                          key={k}
                          className={`p-4 rounded-2xl border ${
                            isDarkMode ? "bg-slate-950 border-slate-850" : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <CornerDownRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-mono text-sm font-semibold text-slate-300 dark:text-slate-150 select-text">"{ex.original}"</p>
                              <p className="text-xs text-indigo-400 font-bold mt-1 max-w-xl select-text">→ "{ex.translation}"</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-6 pt-3 border-t border-slate-800/10 dark:border-slate-800 leading-normal font-mono">
                    Analysis verified by Linguistic Engine, using deep dictionary grounding.
                  </p>
                </div>

              </div>
            ) : (
              <div
                className={`p-12 rounded-3xl border text-center py-20 transition-colors duration-300 ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <Compass className="w-16 h-16 stroke-1 text-indigo-500/45 mx-auto mb-4" />
                <h4 className="text-base font-bold">Linguistic Deep Explorer</h4>
                <p className="text-xs text-indigo-400/90 mt-1 max-w-sm mx-auto leading-relaxed">
                  Start searching a word above, or trigger lookup instantly from any of the vocabulary cards below translated texts!
                </p>
              </div>
            )}

          </div>
        )}

        {/* C. SAVED STARRED LIST VIEW */}
        {activeTab === "saved" && (
          <div className="flex flex-col gap-6">
            
            <div
              className={`p-6 rounded-3xl border flex items-center justify-between gap-4 transition-colors duration-300 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Linguistic Starred Shelf</h2>
                <p className="text-xs text-slate-400 mt-1 leading-normal">
                  Your bookmarked terms and phrases, ready to restore into the active translation workspace.
                </p>
              </div>

              <span className="bg-indigo-500/10 text-indigo-400 font-bold font-mono text-xs md:text-sm px-4 py-2 rounded-xl border border-indigo-500/25 shrink-0">
                Starred: {savedList.length}
              </span>
            </div>

            {!currentUser && (
              <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
                isDarkMode ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50 border-indigo-150 shadow-xs"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">☁️</span>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-550">Cloud Sync Available</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Connect your Google Account to back up, sync, and access your starred phrases from any device.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignIn}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Connect Now</span>
                </button>
              </div>
            )}

            {savedList.length === 0 ? (
              <div
                className={`p-12 rounded-3xl border text-center py-20 transition-colors duration-300 ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <Bookmark className="w-12 h-12 text-slate-650 mx-auto mb-3" />
                <h3 className="text-lg font-bold">No starred phrases found</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tap the Star/Bookmark button in translated results to add items here.
                </p>
                <button
                  onClick={() => setActiveTab("translation")}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Open Editor Workspace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {savedList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-6 rounded-3xl border relative flex flex-col justify-between hover:shadow-md transition-all ${
                      isDarkMode ? "bg-slate-900 border-slate-800/80" : "bg-white border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Language badge headers */}
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-4 uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span>{getLangFlag(item.sourceLang)} {item.sourceLang}</span>
                          <span>→</span>
                          <span>{getLangFlag(item.targetLang)} {item.targetLang}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSaved(item.id)}
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-xl transition-colors cursor-pointer"
                          title="Remove bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Source text */}
                      <p className="text-sm font-medium opacity-80 mb-3 select-text">
                        "{item.sourceText}"
                      </p>

                      {/* Output Translated Code */}
                      <div
                        className={`p-4 rounded-2xl text-base font-bold break-words select-text ${
                          isDarkMode
                            ? "bg-slate-950 text-indigo-300 border border-slate-850"
                            : "bg-indigo-50/70 text-indigo-700"
                        }`}
                      >
                        "{item.translatedText}"
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-3.5 border-t border-slate-800/10 dark:border-slate-800/50">
                      <button
                        onClick={() => handleLoadHistoryItem(item)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Languages className="w-3.5 h-3.5" />
                        <span>Restore in main panel</span>
                      </button>

                      <div className="flex gap-2.5">
                        <button
                          onClick={() => runVoiceSynthesize(item.translatedText, item.targetLang, false)}
                          className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer"
                          title="Pronounce"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyToClipboard(item.translatedText, false)}
                          className="p-1 text-slate-400 hover:text-indigo-400 cursor-pointer"
                          title="Copy translation text"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

        {/* D. WORKSPACE HISTORY LIST */}
        {activeTab === "history" && (
          <div className="flex flex-col gap-6">
            
            <div
              className={`p-6 rounded-3xl border flex items-center justify-between gap-4 flex-wrap transition-colors duration-300 ${
                isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
              }`}
            >
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Calculated Translation History</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Access your most recent translation operations. Review grammatical adjustments and load text instantly back.
                </p>
              </div>

              {historyList.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Wipe All Logs</span>
                </button>
              )}
            </div>

            {!currentUser && (
              <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all ${
                isDarkMode ? "bg-indigo-950/20 border-indigo-900/40" : "bg-indigo-50 border-indigo-150 shadow-xs"
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">☁️</span>
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-550">Cloud Sync Available</h4>
                    <p className="text-xs opacity-90 mt-0.5">
                      Connect your Google Account to back up, sync, and access your translation history logs securely.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleSignIn}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <span>Connect Now</span>
                </button>
              </div>
            )}

            {historyList.length === 0 ? (
              <div
                className={`p-12 rounded-3xl border text-center py-20 transition-colors duration-300 ${
                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <History className="w-12 h-12 text-slate-650 mx-auto mb-3" />
                <h3 className="text-lg font-bold">History log archive empty</h3>
                <p className="text-xs text-slate-400 mt-1">
                  New translations will record log entries automatically.
                </p>
                <button
                  onClick={() => setActiveTab("translation")}
                  className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Start Translating
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {historyList.map((item) => (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl border flex flex-col md:flex-row items-start justify-between gap-4 hover:border-indigo-500/20 transition-all duration-300 ${
                      isDarkMode ? "bg-slate-900 border-slate-800/80" : "bg-white border-slate-200"
                    }`}
                  >
                    <div className="flex-1 flex flex-col gap-2.5">
                      {/* Language flags and timings */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {getLangFlag(item.sourceLang)} {item.sourceLang}
                        </span>
                        <span className="text-slate-500 text-xs">→</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                          {getLangFlag(item.targetLang)} {item.targetLang}
                        </span>
                        <span className="text-slate-650 font-light text-xs">•</span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Source and Target content views */}
                      <p className="text-sm font-medium text-slate-450 select-text">
                        "{item.sourceText}"
                      </p>
                      <p className="text-sm font-bold text-slate-250 dark:text-slate-100 select-text">
                        {item.translatedText}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center border-t border-slate-800/10 dark:border-slate-850 md:border-t-0 pt-3 md:pt-0 w-full md:w-auto justify-end">
                      <button
                        onClick={() => handleLoadHistoryItem(item)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isDarkMode ? "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25" : "bg-indigo-50 text-indigo-700"
                        }`}
                      >
                        Restore Panel
                      </button>
                      <button
                        onClick={() => handleRemoveHistory(item.id)}
                        className="p-1.5 hover:bg-rose-500/10 rounded-xl text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                        title="Delete log entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* 3. SYSTEM STATUS AND FOOTER */}
      <footer
        className={`mt-12 border-t transition-colors duration-300 ${
          isDarkMode ? "bg-slate-900 border-slate-850 text-slate-400" : "bg-white border-slate-200 text-slate-500"
        }`}
      >
        <div className="max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col md:flex-row items-center justify-between text-xs gap-4 font-mono">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
            <strong>Cloud Core Endpoint Status: Active Node (London-1)</strong>
          </div>
          <div className="flex gap-6 font-semibold">
            <span>Security Secured</span>
            <span>Real-time Sync Enabled</span>
            <span>100+ Languages</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
