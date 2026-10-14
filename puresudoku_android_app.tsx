import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RotateCcw, 
  Eraser, 
  Pencil, 
  Lightbulb, 
  Play, 
  Pause, 
  Settings, 
  Smartphone, 
  CheckCircle2, 
  Sparkles, 
  Moon, 
  Sun, 
  PlusCircle, 
  Trophy, 
  Eye, 
  EyeOff,
  HelpCircle,
  X,
  Grid,
  Wand2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

// ==========================================
// SUDOKU ENGINE (Generator, Solver, Logic)
// ==========================================

const BLANK = 0;

// Get row, col, and 3x3 box index from 0-80 index
const getRow = (i) => Math.floor(i / 9);
const getCol = (i) => i % 9;
const getBox = (i) => Math.floor(getRow(i) / 3) * 3 + Math.floor(getCol(i) / 3);

// Get all peer indices (same row, col, or box) for a given cell index
const PEERS = Array.from({ length: 81 }, (_, i) => {
  const r = getRow(i);
  const c = getCol(i);
  const b = getBox(i);
  const peers = new Set();
  for (let j = 0; j < 81; j++) {
    if (j !== i && (getRow(j) === r || getCol(j) === c || getBox(j) === b)) {
      peers.add(j);
    }
  }
  return Array.from(peers);
});

// Check if placing `num` at `idx` on `board` is valid according to standard Sudoku rules
function isValidMove(board, idx, num) {
  for (let peer of PEERS[idx]) {
    if (board[peer] === num) return false;
  }
  return true;
}

// Shuffle array in-place (Fisher-Yates)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Fill a board completely using randomized backtracking
function generateSolvedBoard() {
  const board = Array(81).fill(BLANK);

  function fillCell(idx) {
    if (idx === 81) return true;
    if (board[idx] !== BLANK) return fillCell(idx + 1);

    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let num of nums) {
      if (isValidMove(board, idx, num)) {
        board[idx] = num;
        if (fillCell(idx + 1)) return true;
        board[idx] = BLANK;
      }
    }
    return false;
  }

  fillCell(0);
  return board;
}

// Count number of solutions up to `limit` (default 2 to verify uniqueness)
// Uses MRV (Minimum Remaining Values) heuristic for fast execution
function countSolutions(boardState, limit = 2) {
  const board = [...boardState];
  let count = 0;

  function solve() {
    if (count >= limit) return;

    // Find empty cell with fewest valid candidates (MRV heuristic)
    let bestIdx = -1;
    let bestCandidates = null;

    for (let i = 0; i < 81; i++) {
      if (board[i] === BLANK) {
        const candidates = [];
        for (let n = 1; n <= 9; n++) {
          if (isValidMove(board, i, n)) candidates.push(n);
        }
        if (candidates.length === 0) return; // Dead end
        if (bestCandidates === null || candidates.length < bestCandidates.length) {
          bestCandidates = candidates;
          bestIdx = i;
          if (candidates.length === 1) break; // Optimal choice
        }
      }
    }

    // No empty cells left -> found a valid solution
    if (bestIdx === -1) {
      count++;
      return;
    }

    for (let num of bestCandidates) {
      board[bestIdx] = num;
      solve();
      board[bestIdx] = BLANK;
      if (count >= limit) return;
    }
  }

  solve();
  return count;
}

// Generate a puzzle with a guaranteed unique solution
function generateSudokuPuzzle(difficulty = 'Medium') {
  const solution = generateSolvedBoard();
  const puzzle = [...solution];

  // Target number of clues to leave based on difficulty
  const targetCluesMap = {
    Easy: 42,
    Medium: 34,
    Hard: 28,
    Expert: 24,
  };
  const targetClues = targetCluesMap[difficulty] || 34;

  // Create randomized list of indices to attempt removing
  const indices = shuffle(Array.from({ length: 81 }, (_, i) => i));
  let cluesRemaining = 81;

  for (let idx of indices) {
    if (cluesRemaining <= targetClues) break;

    const backup = puzzle[idx];
    puzzle[idx] = BLANK;

    // Verify the puzzle still has a strictly unique solution
    const solutions = countSolutions(puzzle, 2);
    if (solutions !== 1) {
      puzzle[idx] = backup; // Put it back if removing breaks uniqueness
    } else {
      cluesRemaining--;
    }
  }

  return { puzzle, solution, cluesRemaining };
}

// Calculate valid candidate numbers (1-9) for an empty cell on the current board
function getValidCandidates(board, idx) {
  if (board[idx] !== BLANK) return [];
  const candidates = [];
  for (let n = 1; n <= 9; n++) {
    if (isValidMove(board, idx, n)) candidates.push(n);
  }
  return candidates;
}

// Find a logical hint (Naked Single, Hidden Single, or Target Reveal)
function findSmartHint(userBoard, solution) {
  // 1. Check if the user has any incorrect entries currently on the board
  for (let i = 0; i < 81; i++) {
    if (userBoard[i] !== BLANK && userBoard[i] !== solution[i]) {
      return {
        idx: i,
        num: solution[i],
        type: 'Error Correction',
        message: `Row ${getRow(i) + 1}, Col ${getCol(i) + 1} has an incorrect number (${userBoard[i]}). Let's clear or fix that first!`
      };
    }
  }

  // 2. Look for a "Naked Single" (a cell with only 1 possible valid candidate based on current board)
  for (let i = 0; i < 81; i++) {
    if (userBoard[i] === BLANK) {
      const candidates = getValidCandidates(userBoard, i);
      if (candidates.length === 1 && candidates[0] === solution[i]) {
        return {
          idx: i,
          num: candidates[0],
          type: 'Naked Single',
          message: `Row ${getRow(i) + 1}, Col ${getCol(i) + 1} can only be ${candidates[0]} because all other numbers (1-9) already appear in its row, column, or 3×3 block.`
        };
      }
    }
  }

  // 3. Look for a "Hidden Single" in a Row, Column, or 3x3 Box
  const units = [];
  for (let r = 0; r < 9; r++) {
    units.push({ name: `Row ${r + 1}`, cells: Array.from({ length: 9 }, (_, c) => r * 9 + c) });
  }
  for (let c = 0; c < 9; c++) {
    units.push({ name: `Column ${c + 1}`, cells: Array.from({ length: 9 }, (_, r) => r * 9 + c) });
  }
  for (let b = 0; b < 9; b++) {
    const startR = Math.floor(b / 3) * 3;
    const startC = (b % 3) * 3;
    const cells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells.push((startR + r) * 9 + (startC + c));
      }
    }
    units.push({ name: `Block ${b + 1}`, cells });
  }

  for (let unit of units) {
    for (let num = 1; num <= 9; num++) {
      // If `num` is already placed in this unit, skip
      if (unit.cells.some(idx => userBoard[idx] === num)) continue;

      const possibleCells = unit.cells.filter(
        idx => userBoard[idx] === BLANK && isValidMove(userBoard, idx, num)
      );
      if (possibleCells.length === 1) {
        const targetIdx = possibleCells[0];
        if (solution[targetIdx] === num) {
          return {
            idx: targetIdx,
            num,
            type: 'Hidden Single',
            message: `In ${unit.name}, the number ${num} can only fit in Row ${getRow(targetIdx) + 1}, Col ${getCol(targetIdx) + 1}.`
          };
        }
      }
    }
  }

  // 4. Fallback: Find the empty cell with the fewest candidates and reveal it
  let bestIdx = -1;
  let minCount = 10;
  for (let i = 0; i < 81; i++) {
    if (userBoard[i] === BLANK) {
      const cands = getValidCandidates(userBoard, i);
      if (cands.length < minCount) {
        minCount = cands.length;
        bestIdx = i;
      }
    }
  }

  if (bestIdx !== -1) {
    return {
      idx: bestIdx,
      num: solution[bestIdx],
      type: 'Logical Deduction',
      message: `Tough spot! Try placing ${solution[bestIdx]} at Row ${getRow(bestIdx) + 1}, Col ${getCol(bestIdx) + 1}.`
    };
  }

  return null;
}

// Format seconds as MM:SS
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ==========================================
// MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  // Theme & Settings State
  const [darkMode, setDarkMode] = useState(true);
  const [difficulty, setDifficulty] = useState('Medium');
  const [checkOnEntry, setCheckOnEntry] = useState(true);
  const [highlightDuplicates, setHighlightDuplicates] = useState(true);

  // Game Board State
  const [initialBoard, setInitialBoard] = useState(() => Array(81).fill(0));
  const [userBoard, setUserBoard] = useState(() => Array(81).fill(0));
  const [solution, setSolution] = useState(() => Array(81).fill(0));
  const [notes, setNotes] = useState(() => Array.from({ length: 81 }, () => []));
  const [history, setHistory] = useState([]);

  // Interaction State
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [hintInfo, setHintInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);

  // Timer & Modals State
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [mistakesCount, setMistakesCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showAndroidModal, setShowAndroidModal] = useState(false);
  const [showNewGameMenu, setShowNewGameMenu] = useState(false);

  // Start a new Sudoku game
  const startNewGame = useCallback((diff = difficulty) => {
    setIsGenerating(true);
    setHintInfo(null);
    setIsCompleted(false);
    setIsPaused(false);
    setShowNewGameMenu(false);

    // Run generator inside a short timeout so UI updates smoothly
    setTimeout(() => {
      const { puzzle, solution: sol } = generateSudokuPuzzle(diff);
      setDifficulty(diff);
      setInitialBoard([...puzzle]);
      setUserBoard([...puzzle]);
      setSolution([...sol]);
      setNotes(Array.from({ length: 81 }, () => []));
      setHistory([]);
      setTimer(0);
      setMistakesCount(0);
      setHintsUsed(0);
      
      // Select first empty cell by default
      const firstEmpty = puzzle.findIndex(v => v === 0);
      setSelectedIdx(firstEmpty !== -1 ? firstEmpty : 0);
      setIsGenerating(false);
    }, 40);
  }, [difficulty]);

  // Initialize game on first load
  useEffect(() => {
    startNewGame('Medium');
  }, []);

  // Game Timer Hook
  useEffect(() => {
    if (isPaused || isCompleted || isGenerating) return;
    const interval = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, isCompleted, isGenerating]);

  // Check if the board is completely and accurately solved
  useEffect(() => {
    if (isGenerating || solution[0] === 0) return;
    const isFull = userBoard.every((val) => val !== BLANK);
    if (isFull) {
      const isCorrect = userBoard.every((val, idx) => val === solution[idx]);
      if (isCorrect && !isCompleted) {
        setIsCompleted(true);
        setHintInfo(null);
      }
    }
  }, [userBoard, solution, isGenerating, isCompleted]);

  // Save current state to undo stack
  const pushToHistory = (currBoard, currNotes) => {
    setHistory((prev) => [
      ...prev.slice(-40), // Keep last 40 steps
      {
        userBoard: [...currBoard],
        notes: currNotes.map((n) => [...n]),
      },
    ]);
  };

  // Handle Undo Action
  const handleUndo = () => {
    if (history.length === 0 || isPaused || isCompleted) return;
    const lastState = history[history.length - 1];
    setUserBoard(lastState.userBoard);
    setNotes(lastState.notes);
    setHistory((prev) => prev.slice(0, -1));
    setHintInfo(null);
  };

  // Handle Erase Action
  const handleErase = () => {
    if (selectedIdx === null || isPaused || isCompleted) return;
    if (initialBoard[selectedIdx] !== BLANK) return; // Can't erase given clues

    if (userBoard[selectedIdx] === BLANK && notes[selectedIdx].length === 0) return;

    pushToHistory(userBoard, notes);
    const nextBoard = [...userBoard];
    nextBoard[selectedIdx] = BLANK;

    const nextNotes = notes.map((arr, idx) => (idx === selectedIdx ? [] : [...arr]));
    setUserBoard(nextBoard);
    setNotes(nextNotes);
    setHintInfo(null);
  };

  // Handle Number Input (1-9)
  const handleNumberInput = useCallback((num) => {
    if (selectedIdx === null || isPaused || isCompleted) return;
    // Cannot modify initial clues
    if (initialBoard[selectedIdx] !== BLANK) return;

    // 1. NOTE MODE: Toggle candidate pencil mark
    if (isNoteMode) {
      // If there's already a full number placed in this cell, clear it first or ignore
      if (userBoard[selectedIdx] !== BLANK) {
        pushToHistory(userBoard, notes);
        const nextBoard = [...userBoard];
        nextBoard[selectedIdx] = BLANK;
        const nextNotes = notes.map((arr, i) => (i === selectedIdx ? [num] : [...arr]));
        setUserBoard(nextBoard);
        setNotes(nextNotes);
        return;
      }

      pushToHistory(userBoard, notes);
      const currentCellNotes = notes[selectedIdx];
      const nextCellNotes = currentCellNotes.includes(num)
        ? currentCellNotes.filter((n) => n !== num)
        : [...currentCellNotes, num].sort((a, b) => a - b);

      const nextNotes = notes.map((arr, i) => (i === selectedIdx ? nextCellNotes : [...arr]));
      setNotes(nextNotes);
      return;
    }

    // 2. NORMAL ENTRY MODE: Place or toggle number
    pushToHistory(userBoard, notes);
    const nextBoard = [...userBoard];

    // Tapping the same number again removes it
    if (nextBoard[selectedIdx] === num) {
      nextBoard[selectedIdx] = BLANK;
      setUserBoard(nextBoard);
      return;
    }

    nextBoard[selectedIdx] = num;

    // Track mistake if Check on Entry is enabled and number doesn't match solution
    if (checkOnEntry && num !== solution[selectedIdx]) {
      setMistakesCount((m) => m + 1);
    }

    // Auto-clear pencil marks in this cell and remove `num` from peer cells' pencil marks
    const nextNotes = notes.map((arr, idx) => {
      if (idx === selectedIdx) return [];
      if (PEERS[selectedIdx].includes(idx)) {
        return arr.filter((n) => n !== num);
      }
      return [...arr];
    });

    setUserBoard(nextBoard);
    setNotes(nextNotes);
    if (hintInfo && hintInfo.idx === selectedIdx) {
      setHintInfo(null);
    }
  }, [selectedIdx, isPaused, isCompleted, initialBoard, isNoteMode, userBoard, notes, checkOnEntry, solution, hintInfo]);

  // Auto-fill valid candidate notes for all empty cells (helpful utility for tough puzzles)
  const handleAutoNotes = () => {
    if (isPaused || isCompleted) return;
    pushToHistory(userBoard, notes);
    const nextNotes = userBoard.map((val, idx) => {
      if (val !== BLANK) return [];
      return getValidCandidates(userBoard, idx);
    });
    setNotes(nextNotes);
  };

  // Trigger Hint
  const handleHint = () => {
    if (isPaused || isCompleted) return;

    // If a hint is already active and user clicks "Apply Hint" or clicks the hint button again, fill it!
    if (hintInfo) {
      applyHint(hintInfo);
      return;
    }

    const hint = findSmartHint(userBoard, solution);
    if (hint) {
      setSelectedIdx(hint.idx);
      setHintInfo(hint);
      setHintsUsed((h) => h + 1);
    }
  };

  // Apply the currently displayed hint directly onto the board
  const applyHint = (hint) => {
    if (!hint) return;
    pushToHistory(userBoard, notes);
    const nextBoard = [...userBoard];
    nextBoard[hint.idx] = hint.num;

    const nextNotes = notes.map((arr, idx) => {
      if (idx === hint.idx) return [];
      if (PEERS[hint.idx].includes(idx)) {
        return arr.filter((n) => n !== hint.num);
      }
      return [...arr];
    });

    setUserBoard(nextBoard);
    setNotes(nextNotes);
    setSelectedIdx(hint.idx);
    setHintInfo(null);
  };

  // Keyboard Support (for testing on desktop or Android keyboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isPaused || isCompleted || showAndroidModal || showNewGameMenu) return;

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleNumberInput(parseInt(e.key, 10));
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleErase();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsNoteMode((prev) => !prev);
      } else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleUndo();
      } else if (selectedIdx !== null && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        let r = getRow(selectedIdx);
        let c = getCol(selectedIdx);
        if (e.key === 'ArrowUp') r = (r + 8) % 9;
        if (e.key === 'ArrowDown') r = (r + 1) % 9;
        if (e.key === 'ArrowLeft') c = (c + 8) % 9;
        if (e.key === 'ArrowRight') c = (c + 1) % 9;
        setSelectedIdx(r * 9 + c);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumberInput, selectedIdx, isPaused, isCompleted, showAndroidModal, showNewGameMenu]);

  // Determine how many instances of each number 1-9 are currently placed on the board
  const numberCounts = Array(10).fill(0);
  userBoard.forEach((val, idx) => {
    if (val !== BLANK) {
      // Only count as completed if either checkOnEntry is off or the entry matches the solution
      if (!checkOnEntry || val === solution[idx]) {
        numberCounts[val]++;
      }
    }
  });

  // Check if a cell has a direct rule conflict (duplicate in same row, col, or box)
  const hasRuleConflict = (idx) => {
    const val = userBoard[idx];
    if (val === BLANK) return false;
    for (let peer of PEERS[idx]) {
      if (userBoard[peer] === val) return true;
    }
    return false;
  };

  // Active number currently highlighted across the board
  const activeNumber = selectedIdx !== null && userBoard[selectedIdx] !== BLANK 
    ? userBoard[selectedIdx] 
    : null;

  return (
    <div className={`min-h-screen flex flex-col select-none transition-colors duration-200 ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* TOP ANDROID-STYLE APP BAR */}
      <header className={`w-full max-w-md mx-auto px-4 pt-3 pb-2 flex items-center justify-between border-b ${
        darkMode ? 'border-slate-800/80 bg-slate-950/90' : 'border-slate-200 bg-white/90'
      } sticky top-0 z-20 backdrop-blur-md`}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Grid className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight leading-none">PureSudoku</h1>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Ad-Free
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Android Edition
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* New Game Button */}
          <button
            onClick={() => setShowNewGameMenu(true)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              darkMode 
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' 
                : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
            }`}
            title="Start New Game"
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>New</span>
          </button>

          {/* Sideload / Android APK Info Button */}
          <button
            onClick={() => setShowAndroidModal(true)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25' 
                : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
            }`}
            title="How to install or sideload on Android"
          >
            <Smartphone className="w-4 h-4" />
          </button>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-slate-800 text-amber-400' : 'hover:bg-slate-200 text-slate-700'
            }`}
            title="Toggle Dark/Light Theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-md mx-auto px-3 py-2 flex flex-col justify-between gap-2">
        
        {/* STATUS & SETTINGS BAR */}
        <div className="flex flex-col gap-2">
          {/* Top Row: Difficulty Selector & Timer */}
          <div className="flex items-center justify-between px-1">
            {/* Difficulty Pills */}
            <div className={`inline-flex p-0.5 rounded-xl border ${
              darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/80 border-slate-300'
            }`}>
              {['Easy', 'Medium', 'Hard', 'Expert'].map((level) => {
                const active = difficulty === level;
                return (
                  <button
                    key={level}
                    onClick={() => {
                      if (level !== difficulty) startNewGame(level);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : darkMode
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>

            {/* Timer & Pause Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-semibold transition-colors ${
                  darkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-amber-400" />}
                <span>{formatTime(timer)}</span>
              </button>
            </div>
          </div>

          {/* Second Row: "Check on Entry" Toggle & Stats */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
            darkMode ? 'bg-slate-900/70 border-slate-800/90' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            {/* Check on Entry Toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checkOnEntry}
                  onChange={() => setCheckOnEntry(!checkOnEntry)}
                />
                <div className={`w-9 h-5 rounded-full transition-colors ${
                  checkOnEntry ? 'bg-indigo-600' : darkMode ? 'bg-slate-700' : 'bg-slate-300'
                }`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                  checkOnEntry ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold flex items-center gap-1">
                  Check Guesses on Entry
                  {checkOnEntry ? (
                    <Eye className="w-3 h-3 text-indigo-400" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-slate-400" />
                  )}
                </span>
                <span className={`text-[10px] leading-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {checkOnEntry 
                    ? 'Highlights wrong guesses immediately' 
                    : 'Unchecked mode (no solution spoilers)'}
                </span>
              </div>
            </label>

            {/* Mistakes / Auto-Notes Quick Action */}
            <div className="flex items-center gap-3">
              {checkOnEntry && (
                <div className="text-right">
                  <span className={`text-[10px] uppercase tracking-wider block ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Mistakes
                  </span>
                  <span className={`text-xs font-bold ${mistakesCount > 0 ? 'text-rose-400' : ''}`}>
                    {mistakesCount}
                  </span>
                </div>
              )}

              <button
                onClick={handleAutoNotes}
                className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  darkMode
                    ? 'border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="Fill all valid pencil notes automatically"
              >
                <Wand2 className="w-3 h-3 text-indigo-400" />
                <span>Auto-Notes</span>
              </button>
            </div>
          </div>
        </div>

        {/* HINT BANNER (When active) */}
        {hintInfo && (
          <div className={`px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2 animate-fadeIn ${
            darkMode 
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-200' 
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-start gap-2 text-xs">
              <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-400 block">{hintInfo.type}:</span>
                <span className="leading-snug">{hintInfo.message}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => applyHint(hintInfo)}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-colors"
              >
                Fill {hintInfo.num}
              </button>
              <button
                onClick={() => setHintInfo(null)}
                className="p-1 rounded-lg hover:bg-amber-500/20 text-amber-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* 9x9 SUDOKU BOARD */}
        <div className="relative w-full aspect-square max-w-[420px] mx-auto my-auto">
          {/* Loading / Generating Overlay */}
          {isGenerating && (
            <div className="absolute inset-0 z-20 rounded-xl bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-indigo-300">
                Generating Unique {difficulty} Puzzle...
              </p>
            </div>
          )}

          {/* Paused Overlay */}
          {isPaused && !isGenerating && (
            <div className="absolute inset-0 z-20 rounded-xl bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 border-2 border-slate-800">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                <Pause className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-bold">Game Paused</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {difficulty} Mode • {formatTime(timer)}
                </p>
              </div>
              <button
                onClick={() => setIsPaused(false)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume Puzzle
              </button>
            </div>
          )}

          {/* Sudoku Grid Container */}
          <div
            className={`w-full h-full grid grid-cols-9 grid-rows-9 rounded-xl overflow-hidden border-[2.5px] shadow-xl ${
              darkMode ? 'border-slate-500 bg-slate-900' : 'border-slate-800 bg-white'
            }`}
          >
            {userBoard.map((val, idx) => {
              const r = getRow(idx);
              const c = getCol(idx);
              const isGiven = initialBoard[idx] !== BLANK;
              const isSelected = selectedIdx === idx;
              const isHintTarget = hintInfo && hintInfo.idx === idx;
              const isPeer = selectedIdx !== null && PEERS[selectedIdx].includes(idx);
              const isSameNumber = activeNumber !== null && val === activeNumber;

              // Determine if cell is in error state
              const isWrongGuess = !isGiven && val !== BLANK && (
                checkOnEntry 
                  ? val !== solution[idx] // Direct check against true solution
                  : (highlightDuplicates && hasRuleConflict(idx)) // Basic row/col/box duplicate check when Check on Entry is off
              );

              // 3x3 Block Thick Borders
              const borderRight = (c === 2 || c === 5)
                ? (darkMode ? 'border-r-[2.5px] border-r-slate-500' : 'border-r-[2.5px] border-r-slate-800')
                : (c !== 8 ? (darkMode ? 'border-r border-r-slate-800' : 'border-r border-r-slate-200') : '');

              const borderBottom = (r === 2 || r === 5)
                ? (darkMode ? 'border-b-[2.5px] border-b-slate-500' : 'border-b-[2.5px] border-b-slate-800')
                : (r !== 8 ? (darkMode ? 'border-b border-b-slate-800' : 'border-b border-b-slate-200') : '');

              // Cell Background Styling
              let bgClass = darkMode ? 'bg-slate-900' : 'bg-white';
              if (isHintTarget) {
                bgClass = darkMode ? 'bg-amber-500/30 ring-2 ring-inset ring-amber-400' : 'bg-amber-200 ring-2 ring-inset ring-amber-500';
              } else if (isSelected) {
                bgClass = darkMode ? 'bg-indigo-600/45 ring-2 ring-inset ring-indigo-400' : 'bg-indigo-200 ring-2 ring-inset ring-indigo-600';
              } else if (isWrongGuess) {
                bgClass = darkMode ? 'bg-rose-950/80' : 'bg-rose-100';
              } else if (isSameNumber) {
                bgClass = darkMode ? 'bg-indigo-500/25' : 'bg-indigo-100';
              } else if (isPeer) {
                bgClass = darkMode ? 'bg-slate-800/75' : 'bg-slate-100/90';
              }

              // Cell Text Color Styling
              let textClass = '';
              if (isGiven) {
                textClass = darkMode ? 'text-slate-100 font-bold' : 'text-slate-900 font-bold';
              } else if (isWrongGuess) {
                textClass = darkMode ? 'text-rose-400 font-bold' : 'text-rose-600 font-bold';
              } else {
                textClass = darkMode ? 'text-indigo-400 font-semibold' : 'text-indigo-600 font-semibold';
              }

              const cellNotes = notes[idx];

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedIdx(idx)}
                  className={`relative w-full h-full flex items-center justify-center transition-colors duration-75 focus:outline-none ${borderRight} ${borderBottom} ${bgClass}`}
                >
                  {val !== BLANK ? (
                    <span className={`text-xl sm:text-2xl leading-none ${textClass}`}>
                      {val}
                    </span>
                  ) : (
                    /* Render 3x3 Pencil Notes Grid inside empty cell */
                    cellNotes.length > 0 && (
                      <div className="w-full h-full grid grid-cols-3 grid-rows-3 p-[2px] pointer-events-none">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                          const hasNote = cellNotes.includes(n);
                          const isHighlightedNote = activeNumber === n;
                          return (
                            <span
                              key={n}
                              className={`flex items-center justify-center text-[9px] sm:text-[10px] leading-none font-medium ${
                                hasNote
                                  ? isHighlightedNote
                                    ? 'text-amber-400 font-extrabold scale-110'
                                    : darkMode
                                    ? 'text-slate-400'
                                    : 'text-slate-600'
                                  : 'opacity-0'
                              }`}
                            >
                              {n}
                            </span>
                          );
                        })}
                      </div>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTROLS: ACTION TOOLS & NUMBER PAD */}
        <div className="flex flex-col gap-2.5 pb-2">
          
          {/* Action Toolbar: Undo, Erase, Notes Toggle, Hint */}
          <div className="grid grid-cols-4 gap-2">
            {/* UNDO */}
            <button
              onClick={handleUndo}
              disabled={history.length === 0}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl border transition-all active:scale-95 ${
                history.length === 0
                  ? 'opacity-40 cursor-not-allowed'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm'
              }`}
            >
              <RotateCcw className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold">Undo</span>
            </button>

            {/* ERASE */}
            <button
              onClick={handleErase}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl border transition-all active:scale-95 ${
                darkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm'
              }`}
            >
              <Eraser className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold">Erase</span>
            </button>

            {/* NOTES (Pencil Mode) */}
            <button
              onClick={() => setIsNoteMode(!isNoteMode)}
              className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl border transition-all active:scale-95 ${
                isNoteMode
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-200'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700 shadow-sm'
              }`}
            >
              <span
                className={`absolute top-1.5 right-2 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full uppercase ${
                  isNoteMode
                    ? 'bg-white text-indigo-700'
                    : darkMode
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isNoteMode ? 'ON' : 'OFF'}
              </span>
              <Pencil className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold">Notes</span>
            </button>

            {/* HINT */}
            <button
              onClick={handleHint}
              className={`relative flex flex-col items-center justify-center py-2 px-3 rounded-xl border transition-all active:scale-95 ${
                hintInfo
                  ? 'bg-amber-500 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-amber-400'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-amber-600 shadow-sm'
              }`}
            >
              <Lightbulb className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-semibold">
                {hintInfo ? 'Apply Hint' : 'Hint'}
              </span>
            </button>
          </div>

          {/* 1-9 Touch Number Pad */}
          <div className="grid grid-cols-9 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const count = numberCounts[num];
              const isAllPlaced = count >= 9;
              const isHighlighted = activeNumber === num;

              return (
                <button
                  key={num}
                  onClick={() => handleNumberInput(num)}
                  className={`relative h-14 rounded-xl font-bold flex flex-col items-center justify-center transition-all active:scale-90 border ${
                    isNoteMode
                      ? darkMode
                        ? 'bg-slate-900 border-indigo-500/40 text-indigo-300 hover:bg-slate-800'
                        : 'bg-indigo-50/70 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                      : isHighlighted
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/25'
                      : isAllPlaced
                      ? darkMode
                        ? 'bg-slate-900/40 border-slate-800/50 text-slate-600'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                      : darkMode
                      ? 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-800'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  <span className="text-xl leading-none">{num}</span>
                  {/* Remaining count indicator */}
                  <span className={`text-[9px] mt-1 font-medium ${
                    isHighlighted 
                      ? 'text-indigo-200' 
                      : darkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    {Math.max(0, 9 - count)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* ==========================================
          MODAL: PUZZLE COMPLETED CELEBRATION
      ========================================== */}
      {isCompleted && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl text-center ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold">Puzzle Solved!</h2>
            <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Great job conquering this {difficulty} Sudoku!
            </p>

            <div className={`grid grid-cols-3 gap-2 my-5 p-3 rounded-xl border ${
              darkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Time</span>
                <span className="text-sm font-bold font-mono">{formatTime(timer)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Difficulty</span>
                <span className="text-sm font-bold text-indigo-400">{difficulty}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-slate-400 block">Hints Used</span>
                <span className="text-sm font-bold">{hintsUsed}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => startNewGame(difficulty)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition-colors"
              >
                Play Another {difficulty} Puzzle
              </button>
              <button
                onClick={() => {
                  setIsCompleted(false);
                  setShowNewGameMenu(true);
                }}
                className={`w-full py-2.5 rounded-xl font-semibold text-xs ${
                  darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-200 text-slate-700'
                }`}
              >
                Change Difficulty
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: NEW GAME DIFFICULTY SELECTOR
      ========================================== */}
      {showNewGameMenu && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-lg">Start New Puzzle</h3>
              <button
                onClick={() => setShowNewGameMenu(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className={`text-xs mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Every puzzle is generated on the fly and verified to have a single unique solution.
            </p>

            <div className="flex flex-col gap-2">
              {[
                { level: 'Easy', desc: '42 clues • Great for a quick warm-up' },
                { level: 'Medium', desc: '34 clues • Balanced logical challenge' },
                { level: 'Hard', desc: '28 clues • Requires pencil notes & focus' },
                { level: 'Expert', desc: '24 clues • Tough deductions for veterans' },
              ].map((item) => (
                <button
                  key={item.level}
                  onClick={() => startNewGame(item.level)}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    difficulty === item.level
                      ? 'border-indigo-500 bg-indigo-500/10'
                      : darkMode
                      ? 'border-slate-800 bg-slate-950/50 hover:bg-slate-800'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div>
                    <div className="font-bold text-sm">{item.level}</div>
                    <div className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {item.desc}
                    </div>
                  </div>
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          MODAL: ANDROID SIDELOAD / APK / PWA GUIDE
      ========================================== */}
      {showAndroidModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl p-5 border shadow-2xl ${
            darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Run & Sideload on Android</h3>
              </div>
              <button
                onClick={() => setShowAndroidModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4 text-xs leading-relaxed">
              <div className={`p-3 rounded-xl border ${
                darkMode ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}>
                <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  100% Offline, Zero Ads, Zero Tracking
                </div>
                Because all puzzle generation and solving happens directly in JavaScript on your device, this app works completely offline with no servers required.
              </div>

              <div>
                <h4 className="font-bold text-sm text-indigo-400 mb-1">
                  Option 1: Instant Home Screen Install (PWA)
                </h4>
                <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  If you host this single file on GitHub Pages, Netlify, or Vercel (for free):
                </p>
                <ol className="list-decimal list-inside mt-1.5 space-y-1 text-slate-400">
                  <li>Open the URL in <strong>Chrome for Android</strong>.</li>
                  <li>Tap the three-dot menu <strong>(⋮)</strong> in the top right.</li>
                  <li>Select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.</li>
                  <li>It launches full-screen like a native Android app and works offline!</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-sm text-indigo-400 mb-1">
                  Option 2: Build a Sideloadable APK with Capacitor
                </h4>
                <p className={darkMode ? 'text-slate-300' : 'text-slate-600'}>
                  To build a standalone <code>app-debug.apk</code> file you can copy to your phone and sideload:
                </p>
                <div className="mt-2 p-3 rounded-xl bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1 border border-slate-800">
                  <div># 1. Create a Vite React project & install Lucide</div>
                  <div className="text-indigo-400">npm create vite@latest puresudoku -- --template react</div>
                  <div className="text-indigo-400">cd puresudoku && npm install lucide-react</div>
                  <div className="pt-1"># 2. Replace src/App.jsx with this code & build</div>
                  <div className="text-indigo-400">npm run build</div>
                  <div className="pt-1"># 3. Wrap into an Android APK using Capacitor</div>
                  <div className="text-indigo-400">npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                  <div className="text-indigo-400">npx cap init PureSudoku com.myname.puresudoku --web-dir dist</div>
                  <div className="text-indigo-400">npx cap add android && npx cap sync</div>
                  <div className="pt-1"># 4. Build APK via Gradle or Android Studio</div>
                  <div className="text-indigo-400">cd android && ./gradlew assembleDebug</div>
                </div>
                <p className="mt-2 text-slate-400">
                  Your ready-to-sideload APK will be located at <code className="text-indigo-300">android/app/build/outputs/apk/debug/app-debug.apk</code>.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowAndroidModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
            >
              Got It, Back to Puzzle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}