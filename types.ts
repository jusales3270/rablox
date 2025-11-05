export enum Tool {
  REMOVE_BACKGROUND = 'Remover Fundo',
  MAGIC_EDIT = 'Edição Mágica',
  UPSCALE = 'Upscale',
  MERGE = 'Montagem',
  CROP = 'Recortar',
  GENERATE_IMAGE = 'Gerar Imagem',
}

export interface ImageState {
  src: string;
  width: number;
  height: number;
  file: File;
}

export type Selection = { x: number; y: number }[];


export interface HistoryEntry extends ImageState {
  action: string;
}

export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
