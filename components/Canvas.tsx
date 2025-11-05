

import React, { useState, useRef, useEffect } from 'react';
import { ImageState, Selection, Tool } from '../types';
import Icon from './Icon';

interface CanvasProps {
  currentImage: ImageState | null;
  activeTool: Tool | null;
  onImageUpload: (file: File) => void;
  selection: Selection | null;
  onSelectionChange: (selection: Selection | null) => void;
}

const CLOSING_THRESHOLD = 15; // pixels

const Canvas = React.forwardRef<HTMLImageElement, CanvasProps>(
  (
    {
      currentImage,
      activeTool,
      onImageUpload,
      selection,
      onSelectionChange,
    },
    ref,
  ) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const imageContainerRef = useRef<HTMLDivElement>(null);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

    const points = selection || [];
    const isPolygonClosed = points.length > 2 && 
        points[0].x === points[points.length - 1].x && 
        points[0].y === points[points.length - 1].y;

    useEffect(() => {
      let objectUrl: string | undefined;
      if (currentImage?.file) {
        objectUrl = URL.createObjectURL(currentImage.file);
        setImageUrl(objectUrl);
      } else {
        setImageUrl(null);
      }
      return () => {
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
        }
      };
    }, [currentImage]);
    
     useEffect(() => {
        const handleMouseUp = () => {
            setDraggingPointIndex(null);
        };
        // Adiciona o ouvinte se um ponto estiver sendo arrastado
        if (draggingPointIndex !== null) {
            window.addEventListener('mouseup', handleMouseUp);
        }
        // Limpeza: remove o ouvinte quando o componente for desmontado ou o estado de arrasto mudar
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingPointIndex]);

    const getRelativeCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
        const imgElement = (ref as React.RefObject<HTMLImageElement>)?.current;
        if (!imgElement) return null;

        const viewRect = imgElement.getBoundingClientRect();
        if (
            e.clientX < viewRect.left || e.clientX > viewRect.right ||
            e.clientY < viewRect.top || e.clientY > viewRect.bottom
        ) {
            return null;
        }
        return {
            x: e.clientX - viewRect.left,
            y: e.clientY - viewRect.top,
        };
    }

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const coords = getRelativeCoords(e);
        if (!coords) return;

        if (draggingPointIndex !== null && selection) {
            const newSelection = [...selection];
            newSelection[draggingPointIndex] = coords;

            // Se for um polígono fechado e o primeiro ponto for arrastado, atualize o último também
            if (isPolygonClosed && draggingPointIndex === 0) {
                newSelection[newSelection.length - 1] = coords;
            }
            // Se for um polígono fechado e o último ponto for arrastado, atualize o primeiro também
            if (isPolygonClosed && draggingPointIndex === newSelection.length - 1) {
                newSelection[0] = coords;
            }
            onSelectionChange(newSelection);
        } else {
            setMousePos(coords);
        }
    };
    
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (draggingPointIndex !== null) return; // Não adicione pontos durante o arrasto
        if (activeTool !== Tool.MAGIC_EDIT && activeTool !== Tool.CROP) return;
        const coords = getRelativeCoords(e);
        if (!coords) return;

        if (isPolygonClosed) {
            onSelectionChange(null);
            return;
        }

        const currentPoints = selection || [];

        // Verifica se o usuário está fechando o polígono
        if (currentPoints.length > 1) {
            const firstPoint = currentPoints[0];
            const distance = Math.hypot(firstPoint.x - coords.x, firstPoint.y - coords.y);
            if (distance < CLOSING_THRESHOLD) {
                onSelectionChange([...currentPoints, firstPoint]); // Fecha o polígono adicionando o primeiro ponto no final
                return;
            }
        }
        
        onSelectionChange([...currentPoints, coords]);
    };
    
    const handleUploadClick = () => {
      uploadInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files[0]) {
        onImageUpload(event.target.files[0]);
      }
      event.target.value = '';
    };

    const imageElement = (ref as React.RefObject<HTMLImageElement>)?.current;
    const imgRect = imageElement?.getBoundingClientRect();
    const containerRect = imageContainerRef.current?.getBoundingClientRect();

    const getCursorStyle = () => {
        if (draggingPointIndex !== null) return 'grabbing';
        if (activeTool === Tool.MAGIC_EDIT || activeTool === Tool.CROP) return 'crosshair';
        return 'default';
    }

    return (
      <>
        {imageUrl ? (
          <div
            ref={imageContainerRef}
            className="relative w-full h-full flex items-center justify-center select-none"
            onMouseMove={handleMouseMove}
            onClick={handleClick}
            style={{ cursor: getCursorStyle() }}
          >
            <img
              ref={ref}
              src={imageUrl}
              alt="Conteúdo do usuário"
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              draggable={false}
            />
            {(activeTool === Tool.MAGIC_EDIT || activeTool === Tool.CROP) && imgRect && containerRect && (
                <svg
                    className="absolute pointer-events-none"
                    style={{
                        left: imgRect.left - containerRect.left,
                        top: imgRect.top - containerRect.top,
                        width: imgRect.width,
                        height: imgRect.height,
                    }}
                    viewBox={`0 0 ${imgRect.width} ${imgRect.height}`}
                >
                    {/* Polígono preenchido para seleção fechada */}
                    {isPolygonClosed && (
                         <polygon
                            points={points.map(p => `${p.x},${p.y}`).join(' ')}
                            className="fill-cyan-500/30"
                        />
                    )}

                    {/* Linhas conectando os pontos */}
                    <polyline
                        points={points.map(p => `${p.x},${p.y}`).join(' ')}
                        className="fill-none stroke-cyan-400"
                        strokeWidth="2"
                        strokeDasharray={isPolygonClosed ? "" : "4 4"}
                    />
                    
                    {/* Linha de pré-visualização do último ponto para o cursor */}
                    {!isPolygonClosed && points.length > 0 && (
                        <line
                            x1={points[points.length - 1].x}
                            y1={points[points.length - 1].y}
                            x2={mousePos.x}
                            y2={mousePos.y}
                            className="stroke-cyan-400/70"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                        />
                    )}

                    {/* Pontos (vértices) */}
                    {points.map((point, index) => (
                        <circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r={index === 0 ? 6 : 4}
                            className={`stroke-cyan-400 ${index === 0 ? 'fill-cyan-300' : 'fill-gray-900'}`}
                            strokeWidth="2"
                            style={{ pointerEvents: 'auto', cursor: 'grab' }}
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setDraggingPointIndex(index);
                            }}
                        />
                    ))}
                </svg>
            )}

          </div>
        ) : (
          <div className="text-center text-gray-500">
            <input
              type="file"
              ref={uploadInputRef}
              className="hidden"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
            />
            <h2 className="text-2xl font-semibold text-gray-400">Digite na caixa de comando para começar</h2>
            <p className="mt-2">ou <button onClick={handleUploadClick} className="text-blue-400 hover:underline">carregue uma imagem</button>.</p>
          </div>
        )}
      </>
    );
  },
);

export default React.memo(Canvas);