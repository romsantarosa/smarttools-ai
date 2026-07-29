# ✅ Checklist de Implantação - PDF OCR com Gemini Vision

## 🔧 Setup Local (Desenvolvimento)

- [ ] Criar `.env.local` (copie `.env.local.example`)
- [ ] Adicionar `VITE_GEMINI_API_KEY` em `.env.local`
- [ ] Executar `npm install` (já deve ter pdfjs-dist)
- [ ] Verificar com `npm run lint` (sem erros)
- [ ] Testar com `npm run dev`

## 🧪 Testes Funcionais

### 1. PDF Normal (com texto)
- [ ] Upload de PDF com texto
- [ ] Verifica "📄 Texto Nativo (PDF)"
- [ ] Extrai texto corretamente
- [ ] Botões funcionam: Copiar, Exportar JSON, Ver Texto

### 2. PDF Scaneado (sem texto)
- [ ] Upload de PDF scaneado
- [ ] Mostra "🔍 OCR com Gemini Vision"
- [ ] Barra de progresso avança até 100%
- [ ] Exibe "OCR: X/Y páginas"
- [ ] Extrai texto visível

### 3. Funcionalidades Adicionais
- [ ] Modal "Ver Texto" mostra conteúdo
- [ ] Botão Copiar funciona
- [ ] Exportar JSON contém: fileName, extractionMethod, text, analysis, errors
- [ ] Análise automática acontece após extração
- [ ] Erros aparecem em Alert

## 📊 Performance

- [ ] PDF nativo (10 pgs): < 5 segundos
- [ ] PDF OCR (5 pgs): < 30 segundos
- [ ] PDF OCR (10 pgs): < 1 minuto
- [ ] Sem travamentos ou memory leaks

## 🔐 Segurança

- [ ] `.env.local` está em `.gitignore`
- [ ] API key nunca aparece em logs
- [ ] Dados não são enviados para servidor local
- [ ] PDFs processados apenas no navegador
- [ ] Nenhuma persistência de dados sensíveis

## 🐛 Troubleshooting

Se houver problemas:

### "API Key não configurada"
```bash
# Verificar se .env.local existe
cat .env.local

# Se não existe, criar:
cp .env.local.example .env.local
```

### "TypeError: Cannot read property 'env' of undefined"
```bash
# Reiniciar dev server
npm run dev
```

### "PDF.js worker error"
```javascript
// Verificar console (F12) por erro de worker
// Se aparecer erro de URL, pode ser problema de Vite resolve
// Tente limpar cache:
rm -rf node_modules/.vite
npm run dev
```

### "Gemini API error 403"
- Regenere a API key em https://makersuite.google.com/app/apikey
- Verifique se projeto está ativado

### "Lentidão ao processar"
- Limite a 100 páginas máximo
- Diminua qualidade: `renderPdfPageToImage(doc, i, 1.5)` em vez de 2.0
- Aumente throttling em geminiService.ts: `setTimeout(..., 1500)` para 1.5s

## 📝 Arquivos Modificados

### Criados:
- `src/services/geminiService.ts` - Novo (OCR com Gemini)
- `.env.local.example` - Novo (template de config)
- `PDF_OCR_SETUP.md` - Novo (documentação)
- `PDF_OCR_EXEMPLOS.ts` - Novo (exemplos de código)

### Modificados:
- `src/services/pdfService.ts` - Reescrito (OCR support)
- `src/pages/PlanejamentoSplit.tsx` - Atualizado (UI + novos estados)
- `src/services/aiService.ts` - Adicionados logs

## 🚀 Deploy em Produção

### Variáveis de Ambiente
```bash
# No seu provider (Vercel, Netlify, etc)
VITE_GEMINI_API_KEY=sua_chave_aqui
```

### Build
```bash
npm run build  # Produção
```

### Verificar
- [ ] Build completa sem erros
- [ ] Não há logs de debug
- [ ] API key não aparece no build

## 📈 Monitoramento

Adicione logs em produção:
```typescript
if (pdfResult.extractionMethod === 'ocr') {
  // Enviar métrica para analytics
  trackEvent('pdf_ocr_processed', {
    pages: pdfResult.totalPages,
    time: pdfResult.processingTime,
    success: pdfResult.errors.length === 0,
  });
}
```

## 🔄 Atualizações Futuras

### Melhorias Planejadas:
- [ ] Cache de PDFs processados
- [ ] Processamento em batch
- [ ] Fine-tuning do prompt
- [ ] Fallback para OCR.space
- [ ] Suporte a outros formatos (DOCX, TIFF, etc)

### Dependências a Monitorar:
- Google Gemini API (mudanças de pricing/rate limits)
- pdfjs-dist (atualizações de segurança)
- Material-UI v10+

## 📞 Rollback

Se algo der errado em produção:

1. Reverter commit:
```bash
git revert HEAD
git push
```

2. Ou desativar OCR temporariamente:
```typescript
// Em pdfService.ts comentar:
// if (nativeExtraction && nativeExtraction.hasText) { ... }
// Usar apenas método nativo
```

3. Remover VITE_GEMINI_API_KEY das env vars

---

## ✅ Pronto para Deploy!

Após completar todos os itens acima, o sistema está pronto para:
- ✅ Desenvolvimento
- ✅ Staging
- ✅ Produção

**Última atualização:** Janeiro 2025
