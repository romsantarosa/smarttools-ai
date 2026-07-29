/**
 * EXEMPLOS DE USO - Split PDF OCR com Gemini Vision
 * 
 * Este arquivo mostra como usar cada função do sistema separadamente
 */

// ============================================================================
// 1. USAR O SERVIÇO COMPLETO (RECOMENDADO)
// ============================================================================

import { processPdf } from './services/pdfService';
import { analyzeSplit } from './services/aiService';

async function exemploPrincipal() {
  const pdfFile = document.querySelector<HTMLInputElement>('#pdfInput')?.files?.[0];
  if (!pdfFile) return;

  try {
    // Processar PDF (detecta automaticamente entre nativo e OCR)
    const pdfResult = await processPdf(
      pdfFile,
      (progressPct) => {
        console.log(`Progresso: ${progressPct}%`);
      },
      (current, total) => {
        console.log(`OCR: ${current}/${total} páginas`);
      }
    );

    console.log('Texto extraído:', pdfResult.text);
    console.log('Método:', pdfResult.extractionMethod);
    console.log('Erros:', pdfResult.errors);

    // Analisar o texto extraído
    const parsed = {
      pages: pdfResult.pages,
      lines: pdfResult.pages.map((p) => p.split('\n')),
      text: pdfResult.text,
    };

    const analysis = await analyzeSplit(parsed);
    console.log('Análise:', analysis);
  } catch (error) {
    console.error('Erro:', error);
  }
}

// ============================================================================
// 2. APENAS EXTRAIR TEXTO NATIVO (PDF com texto)
// ============================================================================

import { extractPdfText } from './services/pdfService';

async function exemploApenasNativo() {
  const pdfFile = new File([...], 'split.pdf', { type: 'application/pdf' });

  const resultado = await extractPdfText(pdfFile, (pct) => {
    console.log(`Lendo: ${pct}%`);
  });

  if (resultado && resultado.hasText) {
    console.log('✓ Texto extraído com sucesso');
    console.log(resultado.text);
  } else {
    console.log('✗ PDF não contém texto - use OCR');
  }
}

// ============================================================================
// 3. APENAS OCR COM GEMINI (PDF scaneado)
// ============================================================================

import {
  renderPdfPageToImage,
  processPdf,
} from './services/pdfService';
import {
  extractTextFromImageWithGemini,
  extractTextFromPagesWithGemini,
} from './services/geminiService';
import * as pdfjsLib from 'pdfjs-dist';

async function exemploOCRCompleto() {
  const pdfFile = new File([...], 'split.pdf', { type: 'application/pdf' });

  // Carregar PDF
  const arrayBuffer = await pdfFile.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  console.log(`Total de páginas: ${doc.numPages}`);

  // Renderizar todas as páginas em PNG
  const imagemBlobs: Blob[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const blob = await renderPdfPageToImage(doc, i, 2.0);
    imagemBlobs.push(blob);
    console.log(`Página ${i} renderizada`);
  }

  // Enviar para OCR
  const ocrResult = await extractTextFromPagesWithGemini(
    imagemBlobs,
    (current, total) => {
      console.log(`OCR: ${current}/${total}`);
    }
  );

  console.log('Texto OCR:', ocrResult.combinedText);
  console.log('Erros:', ocrResult.errors);
}

// ============================================================================
// 4. OCR DE UMA ÚNICA PÁGINA
// ============================================================================

async function exemploOCRUmaPagina() {
  const pdfFile = new File([...], 'split.pdf', { type: 'application/pdf' });

  // Carregar e renderizar página 1
  const arrayBuffer = await pdfFile.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const paginaBlob = await renderPdfPageToImage(doc, 1, 2.0);

  // Converter para base64
  const reader = new FileReader();
  reader.readAsDataURL(paginaBlob);
  const base64 = await new Promise<string>((resolve) => {
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      resolve(b64);
    };
  });

  // Enviar para Gemini
  const resultado = await extractTextFromImageWithGemini(base64, 1, 'image/png');

  console.log('Texto da página 1:', resultado.text);
  console.log('Confiança:', resultado.confidence);
}

// ============================================================================
// 5. USAR EM UM COMPONENTE REACT
// ============================================================================

import React, { useState } from 'react';

function meuComponentePDF() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [textoExtraido, setTextoExtraido] = useState('');
  const [metodo, setMetodo] = useState<'native' | 'ocr' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const handleAnalizar = async () => {
    if (!arquivo) return;

    try {
      setProgresso(0);
      setErro(null);

      const resultado = await processPdf(arquivo, setProgresso);

      setTextoExtraido(resultado.text);
      setMetodo(resultado.extractionMethod);

      if (resultado.errors.length > 0) {
        setErro(`⚠️ ${resultado.errors.join('\n')}`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  };

  const handleCopiar = async () => {
    if (!textoExtraido) return;
    await navigator.clipboard.writeText(textoExtraido);
    alert('Texto copiado!');
  };

  const handleExportar = () => {
    if (!textoExtraido) return;

    const json = JSON.stringify(
      {
        arquivo: arquivo?.name,
        metodo,
        texto: textoExtraido,
        data: new Date().toISOString(),
      },
      null,
      2
    );

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `split-${Date.now()}.json`;
    a.click();
  };

  return (
    <div>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setArquivo(e.target.files?.[0] || null)}
      />

      <button onClick={handleAnalizar} disabled={!arquivo}>
        Analisar Split
      </button>

      {progresso > 0 && progresso < 100 && <progress value={progresso} max="100" />}

      {erro && <div style={{ color: 'red' }}>{erro}</div>}

      {textoExtraido && (
        <div>
          <p>Método: {metodo === 'ocr' ? '🔍 Gemini Vision OCR' : '📄 Texto Nativo'}</p>

          <textarea value={textoExtraido} readOnly style={{ width: '100%', height: 300 }} />

          <button onClick={handleCopiar}>Copiar Texto</button>
          <button onClick={handleExportar}>Exportar JSON</button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. COMPARAR MÉTODOS (TESTE)
// ============================================================================

async function testarAmbosMetodos() {
  const pdfFile = new File([...], 'split.pdf', { type: 'application/pdf' });

  console.time('Nativo');
  const resultadoNativo = await extractPdfText(pdfFile);
  console.timeEnd('Nativo');

  if (!resultadoNativo?.hasText) {
    console.log('PDF sem texto nativo - testando OCR');

    console.time('OCR');
    const resultadoOCR = await processPdf(pdfFile);
    console.timeEnd('OCR');

    console.log('Comparação:');
    console.log('- Nativo: Não disponível');
    console.log('- OCR:', resultadoOCR.extractionMethod);
    console.log('- Caracteres:', resultadoOCR.text.length);
  }
}

// ============================================================================
// 7. CONFIGURAR RETRY COM FALLBACK
// ============================================================================

async function processPdfComFallback(pdfFile: File) {
  try {
    // Tentar método principal
    const resultado = await processPdf(pdfFile);
    return resultado;
  } catch (erro1) {
    console.warn('Falha no método principal:', erro1);

    try {
      // Fallback: tentar apenas OCR
      const arrayBuffer = await pdfFile.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const blobs: Blob[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
        // Limitar a 10 páginas
        const blob = await renderPdfPageToImage(doc, i);
        blobs.push(blob);
      }

      const ocrResult = await extractTextFromPagesWithGemini(blobs);
      return {
        text: ocrResult.combinedText,
        pages: ocrResult.pages.map((p) => p.text),
        hasTextContent: false,
        extractionMethod: 'ocr' as const,
        totalPages: ocrResult.totalPages,
        processingTime: 0,
        errors: ocrResult.errors,
      };
    } catch (erro2) {
      console.error('Ambos os métodos falharam:', erro2);
      throw new Error(`Falha ao processar PDF: ${erro2}`);
    }
  }
}

// ============================================================================
// 8. PROGRESSÃO DETALHADA
// ============================================================================

async function processPdfComLogsDetalhados(pdfFile: File) {
  console.log('📄 Iniciando processamento:', pdfFile.name);

  try {
    console.log('⏳ Etapa 1: Extração nativa...');
    const nativo = await extractPdfText(pdfFile, (pct) => {
      console.log(`  └─ ${pct}%`);
    });

    if (nativo?.hasText) {
      console.log('✅ Sucesso! Texto nativo encontrado');
      console.log(`   └─ Páginas: ${nativo.pages.length}`);
      console.log(`   └─ Caracteres: ${nativo.text.length}`);
      return nativo;
    }

    console.log('⚠️ Nenhum texto nativo - iniciando OCR');

    const arrayBuffer = await pdfFile.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    console.log(`⏳ Etapa 2: Renderizando ${doc.numPages} páginas...`);
    const blobs: Blob[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const blob = await renderPdfPageToImage(doc, i);
      blobs.push(blob);
      console.log(`  └─ Página ${i}/${doc.numPages} renderizada`);
    }

    console.log('⏳ Etapa 3: Enviando para Gemini Vision...');
    const ocr = await extractTextFromPagesWithGemini(blobs, (curr, total) => {
      console.log(`  └─ ${curr}/${total} páginas processadas`);
    });

    console.log('✅ OCR concluído');
    console.log(`   └─ Páginas: ${ocr.totalPages}`);
    console.log(`   └─ Caracteres: ${ocr.combinedText.length}`);
    console.log(`   └─ Erros: ${ocr.errors.length}`);

    return {
      text: ocr.combinedText,
      pages: ocr.pages.map((p) => p.text),
      hasTextContent: false,
      extractionMethod: 'ocr' as const,
      totalPages: ocr.totalPages,
      processingTime: 0,
      errors: ocr.errors,
    };
  } catch (error) {
    console.error('❌ Erro:', error);
    throw error;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  exemploPrincipal,
  exemploApenasNativo,
  exemploOCRCompleto,
  exemploOCRUmaPagina,
  meuComponentePDF,
  testarAmbosMetodos,
  processPdfComFallback,
  processPdfComLogsDetalhados,
};
