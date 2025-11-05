
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Tool, ImageState, Selection, HistoryEntry, AspectRatio } from './types';
import * as geminiService from './services/geminiService';
import Loader from './components/Loader';
import CommandBar from './components/CommandBar';
import Canvas from './components/Canvas';
import TopBar from './components/TopBar';
import LandingPage from './components/LandingPage';


const dataUrlToFile = async (dataUrl: string, filename: string): Promise<File> => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const mimeType = blob.type || 'image/png';
    const newFilename = filename.replace(/\.[^/.]+$/, "") + `-${Date.now()}.png`;
    return new File([blob], newFilename, { type: mimeType });
};

const scalePolygon = (selection: Selection, imageElement: HTMLImageElement, imageState: ImageState): Selection => {
    const viewRect = imageElement.getBoundingClientRect();
    const originalWidth = imageState.width;
    const originalHeight = imageState.height;
  
    const widthScale = originalWidth / viewRect.width;
    const heightScale = originalHeight / viewRect.height;
  
    return selection.map(point => ({
      x: point.x * widthScale,
      y: point.y * heightScale,
    }));
  };

const App: React.FC = () => {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.GENERATE_IMAGE);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processando...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [secondImage, setSecondImage] = useState<File | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  
  const imageRef = useRef<HTMLImageElement>(null);
  
  const currentImage = history[currentHistoryIndex] || null;
  const canUndo = currentHistoryIndex > 0;
  const canRedo = currentHistoryIndex < history.length - 1;

  useEffect(() => {
    setSelection(null);
  }, [activeTool, currentHistoryIndex]);

  const addHistoryEntry = (imageState: ImageState, action: string) => {
    const newEntry: HistoryEntry = { ...imageState, action };
    const newHistory = [...history.slice(0, currentHistoryIndex + 1), newEntry];
    setHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  };

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const imageState: ImageState = {
          src: e.target?.result as string,
          width: img.width,
          height: img.height,
          file,
        };
        setHistory([{ ...imageState, action: 'Imagem Original' }]);
        setCurrentHistoryIndex(0);
        setActiveTool(Tool.MAGIC_EDIT);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);
  
  const handleSubmit = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    let newImageSrc: string | null = null;
    let actionName: string = activeTool;

    try {
        // Caso 1: Geração de imagem pura de texto para imagem (nenhuma imagem carregada)
        if (activeTool === Tool.GENERATE_IMAGE && !currentImage) {
            if (!prompt) {
                setErrorMessage("Por favor, digite um comando para gerar a imagem.");
                setIsLoading(false);
                return;
            }
            setLoadingMessage('Gerando imagem...');
            actionName = `Geração: ${prompt}`;
            newImageSrc = await geminiService.generateImage(prompt, aspectRatio);
        } 
        // Caso 2: Todas as outras operações que modificam uma imagem existente
        else {
            if (!currentImage) {
                setIsLoading(false);
                return; // Salvaguarda, a UI deve prevenir isso
            }

            const imageToProcess = currentImage.file;
            
            // Lógica principal: Se a ferramenta for "Gerar Imagem" mas uma imagem EXISTE,
            // trate-a como uma "Edição Mágica" de imagem inteira.
            if (activeTool === Tool.GENERATE_IMAGE) {
                 if (!prompt) {
                    setErrorMessage("Por favor, digite um comando para editar a imagem.");
                    setIsLoading(false);
                    return;
                }
                setLoadingMessage('Editando imagem com IA...');
                actionName = `Edição: ${prompt}`;
                // Chama magicEdit sem seleção para editar a imagem inteira
                newImageSrc = await geminiService.magicEdit(imageToProcess, prompt, null);
            } else {
                 // Lógica original para todas as outras ferramentas
                switch (activeTool) {
                    case Tool.REMOVE_BACKGROUND:
                        setLoadingMessage('Removendo fundo...');
                        newImageSrc = await geminiService.removeBackground(imageToProcess);
                        break;
                    case Tool.UPSCALE:
                        setLoadingMessage('Aplicando upscale...');
                        newImageSrc = await geminiService.upscaleImage(imageToProcess);
                        break;
                    case Tool.MAGIC_EDIT:
                        if (!prompt) {
                            setErrorMessage("Por favor, digite um comando para a edição mágica.");
                            setIsLoading(false);
                            return;
                        }
                        if (!selection || selection.length < 3) {
                            setErrorMessage("Por favor, desenhe uma área fechada na imagem para editar.");
                            setIsLoading(false);
                            return;
                        }
                        setLoadingMessage('Aplicando edição mágica...');
                        actionName = `Edição: ${prompt}`;

                        const scaledSelection = imageRef.current ? scalePolygon(selection, imageRef.current, currentImage) : null;
                        if (!scaledSelection) {
                            throw new Error("Não foi possível calcular a área de seleção na imagem.");
                        }

                        newImageSrc = await geminiService.magicEdit(imageToProcess, prompt, scaledSelection);
                        break;
                    case Tool.CROP:
                        if (!selection || selection.length === 0) {
                            setErrorMessage("Por favor, selecione uma área para recortar.");
                            setIsLoading(false);
                            return;
                        }
                        setLoadingMessage('Recortando imagem...');
                        actionName = 'Recorte';

                        const [minX, maxX] = selection.reduce(([min, max], p) => [Math.min(min, p.x), Math.max(max, p.x)], [Infinity, -Infinity]);
                        const [minY, maxY] = selection.reduce(([min, max], p) => [Math.min(min, p.y), Math.max(max, p.y)], [Infinity, -Infinity]);

                        const cropRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };

                        const scaledCorners = imageRef.current ? scalePolygon([
                            { x: cropRect.x, y: cropRect.y },
                            { x: cropRect.x + cropRect.width, y: cropRect.y + cropRect.height }
                        ], imageRef.current, currentImage) : null;

                        if (!scaledCorners || scaledCorners.length < 2) {
                            throw new Error("Não foi possível calcular a área de recorte na imagem.");
                        }

                        const scaledBoundingBox = scaledCorners.reduce((acc, p) => {
                            return {
                                minX: Math.min(acc.minX, p.x),
                                minY: Math.min(acc.minY, p.y),
                                maxX: Math.max(acc.maxX, p.x),
                                maxY: Math.max(acc.maxY, p.y),
                            }
                        }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

                        const scaledCrop = {
                            x: scaledBoundingBox.minX,
                            y: scaledBoundingBox.minY,
                            width: scaledBoundingBox.maxX - scaledBoundingBox.minX,
                            height: scaledBoundingBox.maxY - scaledBoundingBox.minY,
                        };

                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        await new Promise(resolve => {
                            img.onload = resolve;
                            img.src = currentImage.src;
                        });

                        canvas.width = scaledCrop.width;
                        canvas.height = scaledCrop.height;
                        ctx?.drawImage(img, scaledCrop.x, scaledCrop.y, scaledCrop.width, scaledCrop.height, 0, 0, scaledCrop.width, scaledCrop.height);
                        newImageSrc = canvas.toDataURL('image/png');
                        break;
                    case Tool.MERGE:
                        if (!prompt || !secondImage) {
                            setErrorMessage("É necessário um comando e uma segunda imagem para a montagem.");
                            setIsLoading(false);
                            return;
                        }
                        setLoadingMessage('Criando montagem...');
                        actionName = `Montagem: ${prompt}`;
                        newImageSrc = await geminiService.mergeImages(imageToProcess, secondImage, prompt);
                        break;
                }
            }
        }


        if (newImageSrc) {
            const imageFileName = currentImage?.file.name ?? 'generated-image.png';
            const newFile = await dataUrlToFile(newImageSrc, imageFileName);
            const img = new Image();
            img.onload = () => {
                addHistoryEntry({
                    src: newImageSrc as string,
                    width: img.width,
                    height: img.height,
                    file: newFile,
                }, actionName);
            };
            img.src = newImageSrc;
            setPrompt('');
            setSecondImage(null);
            setSelection(null);
            if (activeTool === Tool.GENERATE_IMAGE) {
                setActiveTool(Tool.MAGIC_EDIT);
            }
        }
    } catch (error) {
        console.error(error);
        setErrorMessage(error instanceof Error ? error.message : "Ocorreu um erro desconhecido.");
    } finally {
        setIsLoading(false);
    }
};


  const handleDownload = () => {
    if (currentImage) {
      const link = document.createElement('a');
      link.href = currentImage.src;
      link.download = `edited-image-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleHighResDownload = async () => {
    if (!currentImage) return;

    setIsLoading(true);
    setLoadingMessage('Melhorando a resolução...');
    setErrorMessage(null);

    try {
        const highResSrc = await geminiService.upscaleImage(currentImage.file);

        const link = document.createElement('a');
        link.href = highResSrc;
        const originalName = currentImage.file.name.replace(/\.[^/.]+$/, "");
        link.download = `${originalName}-alta-resolucao.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error(error);
        setErrorMessage(error instanceof Error ? error.message : "Não foi possível baixar a imagem em alta resolução.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleUndo = () => {
    if (canUndo) setCurrentHistoryIndex(currentHistoryIndex - 1);
  };

  const handleRedo = () => {
    if (canRedo) setCurrentHistoryIndex(currentHistoryIndex + 1);
  };

  const handleHistorySelection = (index: number) => {
    setCurrentHistoryIndex(index);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canUndo, canRedo, currentHistoryIndex]);
  
  if (showLandingPage) {
    return <LandingPage onAccess={() => setShowLandingPage(false)} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950 flex-col">
       {isLoading && <Loader message={loadingMessage} />}
       {errorMessage && (
            <div className="absolute top-4 right-4 bg-red-800 border border-red-600 text-white p-4 rounded-lg shadow-lg z-50 animate-pulse">
                <p className="font-bold">Erro</p>
                <p>{errorMessage}</p>
                <button onClick={() => setErrorMessage(null)} className="absolute top-2 right-2 text-white font-bold">&times;</button>
            </div>
        )}
      
      <TopBar 
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onDownload={handleDownload}
        onHighResDownload={handleHighResDownload}
        history={history}
        currentHistoryIndex={currentHistoryIndex}
        onHistorySelect={handleHistorySelection}
        hasImage={!!currentImage}
      />
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 relative overflow-auto">
           <Canvas 
              ref={imageRef}
              currentImage={currentImage}
              activeTool={activeTool}
              onImageUpload={handleImageUpload}
              selection={selection}
              onSelectionChange={setSelection}
           />
      </main>
      
      <CommandBar 
        activeTool={activeTool}
        onToolChange={setActiveTool}
        prompt={prompt}
        onPromptChange={setPrompt}
        onSubmit={handleSubmit}
        onImageUpload={handleImageUpload}
        onSecondImageUpload={setSecondImage}
        secondImageFile={secondImage}
        hasImage={!!currentImage}
        selection={selection}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
      />
    </div>
  );
};

export default App;
