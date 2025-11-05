


import { GoogleGenAI, Modality } from "@google/genai";
import { Selection, AspectRatio } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const imageEditModel = 'gemini-2.5-flash-image';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

const fileToGenerativePart = async (file: File) => {
  const base64Data = await fileToBase64(file);
  return {
    inlineData: {
      mimeType: file.type,
      data: base64Data,
    },
  };
};

const processImageResponse = async (responsePromise: Promise<any>): Promise<string> => {
  const response = await responsePromise;
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      const base64ImageBytes: string = part.inlineData.data;
      const mimeType = part.inlineData.mimeType;
      return `data:${mimeType};base64,${base64ImageBytes}`;
    }
  }
  throw new Error("Nenhuma imagem foi retornada pela API.");
};

export const generateImage = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: aspectRatio,
        },
    });

    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64ImageBytes}`;
};

export const removeBackground = async (imageFile: File): Promise<string> => {
  // Etapa 1: Solicitar à IA uma máscara de segmentação precisa.
  const imagePart = await fileToGenerativePart(imageFile);
  const maskResponsePromise = ai.models.generateContent({
    // Usa o modelo de edição de imagem, que é o correto para esta tarefa.
    model: imageEditModel, 
    contents: {
      parts: [
        imagePart,
        { text: "Sua única e exclusiva tarefa é gerar uma máscara de segmentação em preto e branco. O objeto principal da imagem deve ser renderizado como uma silhueta perfeitamente branca (#FFFFFF). Todo o resto, incluindo o fundo, deve ser perfeitamente preto (#000000). A saída não deve conter NENHUMA cor, textura ou pixel da imagem original. A imagem resultante deve ser apenas uma forma branca sobre um fundo preto." },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  
  const maskDataUrl = await processImageResponse(maskResponsePromise);

  // Etapa 2: Usar a máscara para criar uma imagem transparente no lado do cliente.
  return new Promise((resolve, reject) => {
    const originalImg = new Image();
    const maskImg = new Image();
    
    let originalLoaded = false;
    let maskLoaded = false;

    const applyMask = () => {
      if (!originalLoaded || !maskLoaded) return;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error("Não foi possível criar o contexto do canvas."));
      }

      canvas.width = originalImg.naturalWidth;
      canvas.height = originalImg.naturalHeight;

      // Desenha a imagem original
      ctx.drawImage(originalImg, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Cria um canvas temporário para a máscara para obter seus dados de pixel
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = originalImg.naturalWidth;
      maskCanvas.height = originalImg.naturalHeight;
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
          return reject(new Error("Não foi possível criar o contexto do canvas da máscara."));
      }
      maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
      const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Itera através dos pixels e aplica a máscara
      for (let i = 0; i < imageData.data.length; i += 4) {
        // Verifica o canal vermelho da máscara. Se for próximo de preto, torna o pixel transparente.
        if (maskData[i] < 128) { 
          imageData.data[i + 3] = 0; // Define o alfa como 0 (transparente)
        }
      }

      // Coloca os dados modificados de volta
      ctx.putImageData(imageData, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };

    originalImg.onload = () => {
      originalLoaded = true;
      applyMask();
    };
    maskImg.onload = () => {
      maskLoaded = true;
      applyMask();
    };

    originalImg.onerror = reject;
    maskImg.onerror = reject;

    // Usa um Object URL para o arquivo de imagem original para melhor desempenho
    originalImg.src = URL.createObjectURL(imageFile);
    maskImg.src = maskDataUrl;
  });
};


export const magicEdit = async (
  imageFile: File,
  prompt: string,
  selection: Selection | null,
): Promise<string> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const parts: any[] = [imagePart];
  let finalPrompt: string;

  if (selection && selection.length > 2) {
    const maskCanvas = document.createElement('canvas');
    const image = new Image();
    
    await new Promise<void>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(imageFile);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve();
      };
      image.onerror = reject;
      image.src = objectUrl;
    });

    maskCanvas.width = image.naturalWidth;
    maskCanvas.height = image.naturalHeight;
    const ctx = maskCanvas.getContext('2d');

    if (!ctx) {
        throw new Error("Não foi possível obter o contexto 2D para criar a máscara.");
    }

    // Preenche tudo com preto (área a ser preservada)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Desenha o polígono branco (área a ser editada)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(selection[0].x, selection[0].y);
    for (let i = 1; i < selection.length; i++) {
        ctx.lineTo(selection[i].x, selection[i].y);
    }
    ctx.closePath();
    ctx.fill();
    
    const maskDataUrl = maskCanvas.toDataURL('image/png');
    const maskBase64 = maskDataUrl.split(',')[1];
    
    const maskPart = {
      inlineData: {
        mimeType: 'image/png',
        data: maskBase64,
      },
    };
    parts.push(maskPart);
    finalPrompt = `Usando a máscara fornecida, aplique a seguinte edição APENAS na área branca da imagem: ${prompt}`;
  } else {
    finalPrompt = `Reimagine e edite a imagem inteira com base na seguinte instrução, mantendo o máximo possível do contexto original que não entre em conflito com o pedido. A edição deve ser fotorealista e perfeitamente integrada. Instrução: "${prompt}"`;
  }

  parts.push({ text: finalPrompt });

  const response = ai.models.generateContent({
    model: imageEditModel,
    contents: {
      parts: parts,
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  return processImageResponse(response);
};

export const upscaleImage = async (imageFile: File): Promise<string> => {
  const imagePart = await fileToGenerativePart(imageFile);
  const response = ai.models.generateContent({
    model: imageEditModel,
    contents: {
      parts: [
        imagePart,
        { text: "Faça o upscale desta imagem, aumentando sua resolução e melhorando a nitidez e os detalhes de forma realista." },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  return processImageResponse(response);
};

export const mergeImages = async (baseImageFile: File, secondImageFile: File, prompt: string): Promise<string> => {
  const baseImagePart = await fileToGenerativePart(baseImageFile);
  const secondImagePart = await fileToGenerativePart(secondImageFile);
  
  const response = ai.models.generateContent({
    model: imageEditModel,
    contents: {
      parts: [
        { text: `Sua tarefa é realizar uma edição fotográfica de alta qualidade. Você receberá uma imagem base, uma imagem de inserção e uma instrução. Sua missão é integrar perfeitamente o sujeito da imagem de inserção na imagem base, seguindo a instrução do usuário. O resultado final deve ser uma única imagem fotorrealista, coesa e crível, como se tivesse sido capturada por uma única câmera. Evite a todo custo qualquer aparência de colagem artificial.` },
        { text: `INSTRUÇÃO DO USUÁRIO: "${prompt}"` },
        { text: "--- IMAGEM BASE (PLANO DE FUNDO) ---" },
        baseImagePart,
        { text: "--- IMAGEM DE INSERÇÃO (OBJETO A SER ADICIONADO) ---" },
        secondImagePart,
        { text: `REGRAS CRÍTICAS PARA A EDIÇÃO:
1.  **Contexto e Interação:** Analise a instrução e as imagens. O objeto inserido deve interagir de forma lógica e fisicamente correta com o ambiente da imagem base. Preste atenção à perspectiva, escala e posicionamento (ex: sobre, atrás, dentro).
2.  **Iluminação e Sombras:** A iluminação no objeto inserido deve corresponder EXATAMENTE à da imagem base (direção, cor, intensidade da luz). Projete sombras realistas e precisas do objeto no ambiente.
3.  **Consistência Visual:** O objeto inserido deve ter o mesmo estilo, granulação, balanço de branco, foco e profundidade de campo da imagem base.
4.  **Resultado Final:** A imagem de saída deve ser APENAS a imagem final composta, sem texto, bordas ou artefatos.` }
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  return processImageResponse(response);
};