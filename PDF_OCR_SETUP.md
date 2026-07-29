# 📄 Split PDF OCR com Google Gemini Vision

## 🎯 Funcionalidade

Sistema automático de extração de texto de PDFs com dois métodos:

1. **Texto Nativo** (PDF normal)
   - Extrai usando `pdf.js` getTextContent()
   - Rápido e eficiente

2. **OCR com Gemini Vision** (PDF escaneado)
   - Renderiza página em canvas
   - Converte para PNG
   - Envia para Google Gemini Vision AI
   - Extrai texto com análise de estrutura

## 🚀 Setup

### 1. Obter Google Gemini API Key

1. Acesse: https://makersuite.google.com/app/apikey
2. Clique em "Create API Key"
3. Escolha seu projeto ou crie um novo
4. Copie a chave gerada

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `.env.local` na raiz do projeto:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e adicione sua chave:

```
VITE_GEMINI_API_KEY=sua_chave_api_aqui
```

### 3. Verificar Instalação

```bash
npm run lint    # Validar TypeScript
npm run dev     # Iniciar dev server
```

## 📋 Como Usar

### Interface

1. **Selecionar PDF**
   - Arrastar e soltar ou clicar para selecionar
   - Suporta PDFs até 100 páginas

2. **Analisar Split**
   - Clique no botão "ANALISAR SPLIT"
   - Barra de progresso mostra o status
   - Se for PDF scaneado, verá "OCR com Gemini Vision" e indicador de progresso de páginas

3. **Visualizar Resultado**
   - Método de extração aparece no topo
   - Botões de ação disponíveis:
     - **Copiar Texto** - Copia o texto extraído para a área de transferência
     - **Exportar JSON** - Baixa arquivo JSON com texto + análise
     - **Ver Texto** - Abre modal com visualizador de texto

4. **Análise Automática**
   - Após extração, o sistema analisa automaticamente
   - Extrai:
     - Nome do navio
     - Voyage
     - Operador
     - ETA/ETB
     - Berço
     - Bays
     - Containers
     - Operações (Descarga, Embarque, Reefers, IMO, OOG, etc)

## 🏗️ Arquitetura

### Serviços

#### `pdfService.ts`
Gerencia extração de PDF com duas estratégias:

**Funções principais:**
- `extractPdfText(file)` - Tenta extração nativa
- `renderPdfPageToImage(pdfDoc, pageNumber)` - Renderiza página em PNG
- `processPdf(file)` - Orquestrador principal (detecção + extração)
- `parsePDF(file)` - Compatibilidade com código legado

#### `geminiService.ts`
Integração com Google Gemini Vision API:

**Funções principais:**
- `extractTextFromImageWithGemini(imageBase64, pageNumber)` - Extrai texto de 1 página
- `extractTextFromPagesWithGemini(imageBlobs)` - Processa múltiplas páginas com throttling

#### `aiService.ts`
Análise do Split extraído (sem mudanças na interface):

**Funções principais:**
- `analyzeSplit(parsed)` - Analisa texto e extrai dados estruturados

#### `PlanejamentoSplit.tsx`
Componente React com interface completa:

**Novos estados:**
- `extractedText` - Texto bruto extraído
- `extractionMethod` - 'native' | 'ocr'
- `extractionErrors` - Array de erros
- `ocrProgress` - { current, total } para páginas OCR
- `showTextViewer` - Modal de visualização

## 🔄 Fluxo de Processamento

```
PDF Selecionado
    ↓
Validar arquivo
    ↓
Tentar extração nativa (getTextContent)
    ↓
├─ Sucesso? → Usar texto nativo
└─ Falha? → Renderizar páginas em canvas
              ↓
           Converter para PNG
              ↓
           Enviar para Gemini Vision (com throttling)
              ↓
           Juntar texto de todas as páginas
              ↓
Mostrar resultado com método de extração
    ↓
Analisar com IA (aiService)
    ↓
Exibir resumo + opções de copiar/exportar
```

## 📊 Desempenho

- **PDF nativo**: 1-5 segundos (por arquivo)
- **PDF scaneado (1-10 páginas)**: 10-30 segundos
- **PDF scaneado (10-50 páginas)**: 1-3 minutos
- **PDF scaneado (50-100 páginas)**: 3-5 minutos

⏱️ Tempo controlado por rate limiting do Gemini (throttling de 1s entre requisições)

## 🛡️ Tratamento de Erros

Todos os erros são capturados e exibidos:

1. **Erros de Arquivo**
   - Arquivo inválido
   - Arquivo muito grande

2. **Erros de Extração**
   - Falha ao ler PDF
   - Falha ao renderizar página
   - Falha ao chamar Gemini

3. **Erros de API**
   - API key não configurada
   - Limite de requisições excedido
   - Erro de conexão

Mensagens de erro são mostradas em tempo real no componente.

## 🔍 Estrutura de Dados

### PDFExtractionResult (interface)
```typescript
{
  text: string;                    // Texto completo extraído
  pages: string[];                 // Texto por página
  lines?: string[][];              // Linhas por página (nativo)
  hasTextContent: boolean;         // Tinha texto nativo?
  extractionMethod: 'native'|'ocr'; // Método usado
  totalPages: number;              // Número de páginas
  processingTime: number;          // Tempo em ms
  errors: string[];                // Erros durante processamento
}
```

### Resultado JSON (Exportar)
```json
{
  "fileName": "split.pdf",
  "extractionMethod": "ocr",
  "extractionTime": "2024-01-29T12:00:00Z",
  "text": "...",
  "errors": [],
  "analysis": {
    "shipName": "...",
    "bays": [...],
    ...
  }
}
```

## 📱 Compatibilidade

- ✅ React 19+
- ✅ TypeScript 5.8+
- ✅ Vite 6+
- ✅ Material-UI 9+
- ✅ pdf.js-dist 6.1+
- ✅ Google Gemini 2.0 Flash

## 🔐 Segurança

⚠️ **Importante:**
- A API key é enviada apenas ao servidor da Google
- PDFs são processados no navegador (client-side)
- Não há armazenamento de dados no servidor deste projeto
- Nunca commit a `.env.local` no git (adicione ao `.gitignore`)

## 🐛 Troubleshooting

### "API Key não configurada"
→ Verifique se criou `.env.local` com `VITE_GEMINI_API_KEY`

### "PDF não renderiza / erro de worker"
→ Verifique console (F12) por erros do PDF.js worker

### "Gemini retorna erro 403"
→ API key pode estar inválida ou sem permissões
→ Regenere a chave em makersuite.google.com

### "OCR muito lento"
→ Verifique sua conexão de internet
→ Limite de 60 requisições por minuto da Gemini (throttling implementado)

### "Texto incompleto ou com erros"
→ Qualidade do PDF afeta resultado do OCR
→ PDFs com textos muito pequenos podem ter dificuldade

## 🚀 Próximos Passos (Opcional)

1. **Cache local**: Armazenar PDFs processados em IndexedDB
2. **Processamento de lote**: Upload de múltiplos PDFs simultaneamente
3. **Webhook**: Integrar com sistema externo após extração
4. **Fine-tuning**: Treinar modelo customizado para seu formato específico de Split
5. **Fallback**: Usar OCR.space como fallback se Gemini falhar

## 📞 Suporte

Para problemas com:
- **Google Gemini API**: https://support.google.com/makersuite
- **PDF.js**: https://mozilla.github.io/pdf.js/
- **Material-UI**: https://mui.com/material-ui/
- **TypeScript**: https://www.typescriptlang.org/

---

**Último update:** Janeiro 2025
**Status:** ✅ Produção
