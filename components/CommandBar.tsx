


import React, { useState, useRef, useEffect } from 'react';
import { Tool, Selection, AspectRatio } from '../types';
import Icon from './Icon';

interface CommandBarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  onImageUpload: (file: File) => void;
  onSecondImageUpload: (file: File | null) => void;
  secondImageFile?: File | null;
  hasImage: boolean;
  selection: Selection | null;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
}

const toolOptions = [
    { id: Tool.GENERATE_IMAGE, icon: <Icon type="generate" className="h-5 w-5"/>, label: 'Gerar Imagem' },
    { id: Tool.MAGIC_EDIT, icon: <Icon type="magic" className="h-5 w-5"/>, label: 'Edição Mágica' },
    { id: Tool.CROP, icon: <Icon type="edit" className="h-5 w-5"/>, label: 'Recortar' },
    { id: Tool.MERGE, icon: <Icon type="merge" className="h-5 w-5"/>, label: 'Montagem' },
    { id: Tool.REMOVE_BACKGROUND, icon: <Icon type="background" className="h-5 w-5"/>, label: 'Remover Fundo' },
    { id: Tool.UPSCALE, icon: <Icon type="upscale" className="h-5 w-5"/>, label: 'Upscale' },
]

const aspectRatios: { id: AspectRatio, label: string }[] = [
    { id: '1:1', label: '1:1' },
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '4:3', label: '4:3' },
    { id: '3:4', label: '3:4' },
];

const CommandBar: React.FC<CommandBarProps> = ({
  activeTool,
  onToolChange,
  prompt,
  onPromptChange,
  onSubmit,
  onImageUpload,
  onSecondImageUpload,
  secondImageFile,
  hasImage,
  selection,
  aspectRatio,
  onAspectRatioChange,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const secondUploadInputRef = useRef<HTMLInputElement>(null);
  const [secondImagePreview, setSecondImagePreview] = useState<string | null>(null);

  const selectedTool = toolOptions.find(t => t.id === activeTool);

  const needsPrompt = activeTool === Tool.MAGIC_EDIT || activeTool === Tool.MERGE || activeTool === Tool.GENERATE_IMAGE;
  
  const isSubmitDisabled = 
    (activeTool === Tool.GENERATE_IMAGE && !prompt) ||
    (activeTool !== Tool.GENERATE_IMAGE && !hasImage) ||
    (needsPrompt && !prompt && activeTool !== Tool.GENERATE_IMAGE) ||
    (activeTool === Tool.MAGIC_EDIT && (!selection || selection.length < 3)) ||
    (activeTool === Tool.CROP && (!selection || selection.length < 3)) ||
    (activeTool === Tool.MERGE && !secondImageFile);


  useEffect(() => {
    if (secondImageFile) {
        const objectUrl = URL.createObjectURL(secondImageFile);
        setSecondImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    } else {
        setSecondImagePreview(null);
    }
  }, [secondImageFile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUploadClick = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, callback: (file: File) => void) => {
    if (event.target.files && event.target.files[0]) {
      callback(event.target.files[0]);
    }
    event.target.value = '';
  };
  
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          if(!isSubmitDisabled) onSubmit();
      }
  }

  const getPlaceholder = () => {
    switch (activeTool) {
      case Tool.GENERATE_IMAGE:
        return hasImage ? "Descreva como você quer alterar a imagem inteira..." : "Descreva a imagem que você quer criar...";
      case Tool.MAGIC_EDIT:
        return hasImage ? "Selecione uma área e descreva sua edição..." : "Carregue uma imagem para começar...";
      case Tool.MERGE:
        return hasImage ? "Descreva como unir as imagens..." : "Carregue uma imagem para começar...";
      case Tool.CROP:
        return hasImage ? "Clique ponto a ponto para criar uma área de recorte." : "Carregue uma imagem para começar...";
      default:
        return hasImage ? "Esta ferramenta não precisa de um comando de texto." : "Carregue uma imagem para começar...";
    }
  };

  return (
    <div className="w-full flex justify-center p-4">
        <div className="w-full max-w-4xl bg-gray-800 border border-gray-700 rounded-2xl p-4 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
                {/* Tool Selector Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        {selectedTool?.icon}
                        <span>{selectedTool?.label}</span>
                        <Icon type="chevron-down" className="h-4 w-4" />
                    </button>
                    {isDropdownOpen && (
                        <div className="absolute bottom-full mb-2 w-56 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-20">
                            {toolOptions.filter(tool => hasImage || tool.id === Tool.GENERATE_IMAGE).map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => {
                                        onToolChange(tool.id);
                                        setIsDropdownOpen(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                >
                                    {tool.icon}
                                    <span className="text-sm font-medium">{tool.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                 {/* Aspect Ratio Selector */}
                {activeTool === Tool.GENERATE_IMAGE && !hasImage && (
                    <div className="flex items-center gap-1 bg-gray-700 p-1 rounded-lg">
                        {aspectRatios.map(ratio => (
                            <button
                                key={ratio.id}
                                onClick={() => onAspectRatioChange(ratio.id)}
                                className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors ${
                                    aspectRatio === ratio.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-600'
                                }`}
                                title={`Proporção ${ratio.label}`}
                            >
                                {ratio.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Main Input Area */}
            <div className="flex items-start gap-4">
                <div className="flex-1 flex flex-col gap-2">
                    <textarea 
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!needsPrompt}
                        placeholder={getPlaceholder()}
                        className="w-full bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none resize-none disabled:cursor-not-allowed"
                        rows={1}
                    />
                     {activeTool === Tool.MERGE && hasImage && (
                        <div className="flex items-center gap-2">
                            <input type="file" ref={secondUploadInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, (file) => onSecondImageUpload(file))} />
                            {secondImagePreview ? (
                                <div className="relative group">
                                    <img src={secondImagePreview} alt="Prévia da segunda imagem" className="h-12 w-auto rounded-lg object-contain" />
                                    <button 
                                        onClick={() => onSecondImageUpload(null)}
                                        className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                        title="Remover segunda imagem"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => handleUploadClick(secondUploadInputRef)} className="flex items-center justify-center h-12 w-12 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors" title="Adicionar segunda imagem">
                                    <Icon type="plus" className="h-6 w-6" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-end h-full gap-2">
                    <input type="file" ref={uploadInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, onImageUpload)} />
                    {!hasImage && (
                        <button onClick={() => handleUploadClick(uploadInputRef)} className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white" title="Abrir imagem do computador">
                            <Icon type="edit" className="h-4 w-4" />
                            <span>Abrir</span>
                        </button>
                    )}
                    <button 
                        onClick={onSubmit}
                        disabled={isSubmitDisabled}
                        className="p-2.5 bg-gray-700 rounded-full hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                        title="Enviar (Enter)"
                    >
                        <Icon type="send" className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    </div>
  )
}

export default CommandBar;