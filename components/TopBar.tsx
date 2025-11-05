
import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { HistoryEntry } from '../types';

interface TopBarProps {
  // FIX: Corrected function type syntax
  onUndo: () => void;
  // FIX: Corrected function type syntax
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // FIX: Corrected function type syntax
  onDownload: () => void;
  onHighResDownload: () => void;
  history: HistoryEntry[];
  currentHistoryIndex: number;
  // FIX: Corrected function type syntax
  onHistorySelect: (index: number) => void;
  hasImage: boolean;
}

const HistoryPopover: React.FC<{
  history: HistoryEntry[];
  currentIndex: number;
  onSelect: (index: number) => void;
  // FIX: Corrected function type syntax
  onClose: () => void;
}> = ({ history, currentIndex, onSelect, onClose }) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div ref={popoverRef} className="absolute top-12 right-0 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-20">
      <div className="p-2">
        <h3 className="px-2 pt-1 pb-2 text-sm font-semibold text-gray-300">Histórico</h3>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {history.map((entry, index) => (
            <button
              key={index}
              onClick={() => {
                onSelect(index);
                onClose();
              }}
              className={`w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors duration-150 flex items-center gap-3 ${
                index === currentIndex
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              <span className="font-mono text-xs">{index}</span>
              <span className="truncate flex-1">{entry.action}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const TopBar: React.FC<TopBarProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDownload,
  onHighResDownload,
  history,
  currentHistoryIndex,
  onHistorySelect,
  hasImage
}) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (!hasImage) return null;

  return (
    <header className="absolute top-0 right-0 p-4 z-10">
      <div className="flex items-center gap-2 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 p-1.5 rounded-full">
        <div className="relative">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            title="Histórico de Edições"
          >
            <Icon type="history" className="h-5 w-5" />
          </button>
          {isHistoryOpen && (
            <HistoryPopover
              history={history}
              currentIndex={currentHistoryIndex}
              onSelect={onHistorySelect}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}
        </div>
        <div className="h-5 w-px bg-gray-600"></div>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-full hover:bg-gray-700 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          title="Desfazer (Ctrl+Z)"
        >
          <Icon type="undo" className="h-5 w-5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-full hover:bg-gray-700 disabled:text-gray-600 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
          title="Refazer (Ctrl+Y)"
        >
          <Icon type="redo" className="h-5 w-5" />
        </button>
         <div className="h-5 w-px bg-gray-600"></div>
        <button
          onClick={onDownload}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          title="Baixar Imagem"
        >
          <Icon type="download" className="h-5 w-5" />
        </button>
        <button
          onClick={onHighResDownload}
          className="p-2 rounded-full hover:bg-gray-700 transition-colors"
          title="Baixar em Alta Resolução"
        >
          <Icon type="save-high-res" className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};

export default TopBar;