import React, { useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  Share2,
  FileSpreadsheet,
  Building2,
  CheckCircle2,
  Clock,
  User,
  Ship,
  Sparkles,
  Users,
  Anchor,
  Package,
  Wrench,
  ShoppingCart,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { M3Card } from '../components/ui/M3Card';
import { ShipDatabaseInfoCard } from '../components/ui/ShipDatabaseInfoCard';
import { ShiftTurn } from '../types';

export const Relatorios: React.FC = () => {
  const { tools, maintenances, purchases, aiLogs, config, berthTurnUpdates, saveBerthTurnUpdate, ships } = useApp();

  const todayStr = new Date().toISOString().split('T')[0];

  // Report Type:
  // 1. 'ship_equipments': Equipamentos a Bordo dos Navios por Turno e Ponto
  // 2. 'inventory_purchases': Materiais em Estoque, Manutenção e Compras
  const [reportType, setReportType] = useState<'ship_equipments' | 'inventory_purchases'>('ship_equipments');

  // Common Filter States
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTurn, setSelectedTurn] = useState<ShiftTurn>('07-13');
  const [selectedBerth, setSelectedBerth] = useState<string>('Ponto 1');
  const [selectedTurma, setSelectedTurma] = useState<'Turma A' | 'Turma B' | 'Turma C' | 'Turma D' | 'Turma E'>('Turma A');
  const [selectedFacilitador, setSelectedFacilitador] = useState<string>('Bolacha');
  const [selectedShip, setSelectedShip] = useState<string>('Cap San Augustin');
  const [supervisorName, setSupervisorName] = useState<string>('Carlos Eduardo Santos');
  const [shareCopied, setShareCopied] = useState(false);

  // Approval Status for Report 2
  const [approvalStatus, setApprovalStatus] = useState<'Aprovado' | 'Aguardando Aprovação' | 'Reprovado'>('Aprovado');

  // Sync selectedShip with current berth's saved shipName for selectedDate and selectedTurn
  React.useEffect(() => {
    if (selectedBerth !== 'Todos') {
      const rec = berthTurnUpdates.find(
        u => u.date === selectedDate && u.turn === selectedTurn && u.berth === selectedBerth
      );
      if (rec && rec.shipName) {
        setSelectedShip(rec.shipName);
      } else {
        setSelectedShip('Sem Navio Atracado');
      }
    }
  }, [selectedBerth, selectedTurn, selectedDate, berthTurnUpdates]);

  // Handler to update selectedShip and save it to the current berth for selectedDate and selectedTurn
  const handleShipNameChange = (newShip: string) => {
    setSelectedShip(newShip);
    if (selectedBerth !== 'Todos') {
      const existing = berthTurnUpdates.find(
        u => u.date === selectedDate && u.turn === selectedTurn && u.berth === selectedBerth
      );
      if (existing) {
        saveBerthTurnUpdate({
          ...existing,
          shipName: newShip,
        });
      } else {
        saveBerthTurnUpdate({
          date: selectedDate,
          turn: selectedTurn,
          berth: selectedBerth as 'Ponto 1' | 'Ponto 2' | 'Ponto 3',
          shipName: newShip,
          numTernos: 2,
          gangs: [
            { gangNumber: 1, materials: [], totalMaterialsCount: 0 },
            { gangNumber: 2, materials: [], totalMaterialsCount: 0 },
          ],
          totalMaterials: 0,
          observations: 'Atualizado via filtro de relatório.',
          updatedBy: selectedFacilitador || 'Operador BTP',
        });
      }
    }
  };

  // Turma to Facilitador Mapping
  const turmaOptions: { turma: 'Turma A' | 'Turma B' | 'Turma C' | 'Turma D' | 'Turma E'; name: string }[] = [
    { turma: 'Turma A', name: 'Bolacha' },
    { turma: 'Turma B', name: 'Thiago' },
    { turma: 'Turma C', name: 'Conde' },
    { turma: 'Turma D', name: 'Gasolina' },
    { turma: 'Turma E', name: 'XTudo' },
  ];

  const handleTurmaChange = (turmaStr: string) => {
    const found = turmaOptions.find(t => t.turma === turmaStr);
    if (found) {
      setSelectedTurma(found.turma);
      setSelectedFacilitador(found.name);
    }
  };

  const handleFacilitadorChange = (nameStr: string) => {
    const found = turmaOptions.find(t => t.name === nameStr);
    if (found) {
      setSelectedFacilitador(found.name);
      setSelectedTurma(found.turma);
    }
  };

  // Helper to aggregate total materials for a point across all its gangs
  const getPointMaterialTotals = (rec: any) => {
    const aggregatedMap: { [toolName: string]: number } = {};
    let calculatedTotal = 0;

    if (rec.gangs && rec.gangs.length > 0) {
      rec.gangs.forEach((g: any) => {
        if (g.materials) {
          g.materials.forEach((m: any) => {
            aggregatedMap[m.toolName] = (aggregatedMap[m.toolName] || 0) + m.quantity;
            calculatedTotal += m.quantity;
          });
        }
      });
    }

    const descritivoStr = Object.entries(aggregatedMap)
      .map(([name, qty]) => `${name}: ${qty}un`)
      .join(', ') || 'Nenhum material alocado';

    return {
      aggregatedMap,
      descritivoStr,
      totalPieces: rec.totalMaterials || calculatedTotal,
    };
  };

  // Find berth update record matching current parameters strictly for selectedDate and selectedTurn
  const currentBerthRecord = berthTurnUpdates.find(
    u => u.date === selectedDate && u.turn === selectedTurn && u.berth === selectedBerth
  );

  // Strictly filter / build records for Report 1 ONLY for selectedDate and selectedTurn
  const targetBerths: ('Ponto 1' | 'Ponto 2' | 'Ponto 3')[] =
    selectedBerth === 'Todos'
      ? ['Ponto 1', 'Ponto 2', 'Ponto 3']
      : [selectedBerth as 'Ponto 1' | 'Ponto 2' | 'Ponto 3'];

  const displayRecords = targetBerths.map(b => {
    const found = berthTurnUpdates.find(
      u => u.date === selectedDate && u.turn === selectedTurn && u.berth === b
    );
    if (found) return found;

    return {
      id: `empty-${selectedDate}-${selectedTurn}-${b}`,
      date: selectedDate,
      turn: selectedTurn,
      berth: b,
      shipName: 'Sem Navio Atracado',
      numTernos: 0,
      gangs: [],
      totalMaterials: 0,
      observations: 'Nenhuma atualização cadastrada no Dashboard para este turno/data.',
      updatedAt: '',
      updatedBy: '-',
    };
  });

  const latestAIOpinion = aiLogs[0]?.opinion || 'O estoque atual atende com estabilidade a demanda das operações nos pontos do terminal.';

  // Format Date to Brazilian Format DD/MM/YYYY
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Status Badge Colors & Icons Helper
  const getApprovalBadge = (status: 'Aprovado' | 'Aguardando Aprovação' | 'Reprovado') => {
    switch (status) {
      case 'Aprovado':
        return {
          bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
          icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
          label: 'APROVADO',
        };
      case 'Aguardando Aprovação':
        return {
          bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700',
          icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
          label: 'AGUARDANDO APROVAÇÃO',
        };
      case 'Reprovado':
        return {
          bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-700',
          icon: <XCircle className="w-4 h-4 text-rose-600" />,
          label: 'REPROVADO',
        };
    }
  };

  // PDF Generator using jsPDF and autoTable
  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    const currentDate = formatDateBR(selectedDate) || new Date().toLocaleDateString('pt-BR');
    const currentTime = new Date().toLocaleTimeString('pt-BR').substring(0, 5);

    if (reportType === 'ship_equipments') {
      // -------------------------------------------------------------
      // REPORT 1: RELATÓRIO DE EQUIPAMENTOS A BORDO DOS NAVIOS POR PONTO
      // -------------------------------------------------------------
      // Header Banner
      doc.setFillColor(0, 85, 150); // BTP Blue
      doc.rect(0, 0, 210, 35, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('BTP SmartTools AI — RELATÓRIO OPERACIONAL', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO DE FERRAMENTAS E EQUIPAMENTOS A BORDO DOS NAVIOS', 14, 24);
      doc.text(`${config.companyName} | ${config.terminalName}`, 14, 29);

      // Metadata Section
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DADOS DA OPERAÇÃO DO NAVIO E PONTO', 14, 43);

      const shipNameDisplay = selectedBerth !== 'Todos'
        ? (selectedShip.trim() || currentBerthRecord?.shipName || 'Não especificado')
        : 'Diversos (Ver Pontos)';

      const metaData = [
        [`Data do Serviço: ${currentDate}`, `Hora da Emissão: ${currentTime}`, `Turno: ${selectedTurn}`],
        [`Turma: ${selectedTurma}`, `Facilitador: ${selectedFacilitador}`, `Ponto Operacional: ${selectedBerth}`],
        [`Navio em Operação: ${shipNameDisplay}`, `Viagem: BTP-2026-092`, `CNPJ: ${config.cnpj}`],
      ];

      autoTable(doc, {
        startY: 46,
        body: metaData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
      });

      // Table: Aggregated equipment totals by Point
      const lastY0 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. QUANTIDADES TOTAIS DE MATERIAIS PELOS RESPECTIVOS PONTOS', 14, lastY0);

      const pointTableRows: string[][] = [];

      displayRecords.forEach(rec => {
        const { descritivoStr, totalPieces } = getPointMaterialTotals(rec);
        const pointShip = rec.shipName || 'Sem Navio Atracado';

        pointTableRows.push([
          rec.berth,
          pointShip,
          rec.turn,
          descritivoStr,
          `${totalPieces} un`,
        ]);
      });

      autoTable(doc, {
        startY: lastY0 + 3,
        head: [['Ponto', 'Navio em Operação', 'Turno', 'Quantidade Total de Materiais no Ponto', 'Total Peças']],
        body: pointTableRows.length > 0 ? pointTableRows : [['Sem dados', '-', '-', 'Nenhum material alocado', '0 un']],
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 40 },
          2: { cellWidth: 18 },
          3: { cellWidth: 77 },
          4: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
        },
      });

      // AI Parecer
      const lastY1 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('3. PARECER TÉCNICO E OBSERVAÇÕES OPERACIONAIS', 14, lastY1);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      const splitOpinion = doc.splitTextToSize(`"${latestAIOpinion}"`, 180);
      doc.text(splitOpinion, 14, lastY1 + 5);

      // Signatures
      const sigY = lastY1 + 28;
      doc.setFont('helvetica', 'bold');
      doc.line(14, sigY, 90, sigY);
      doc.text(`Facilitador: ${selectedFacilitador} (${selectedTurma})`, 14, sigY + 5);

      doc.line(110, sigY, 186, sigY);
      doc.text(`Supervisor de Operações: ${supervisorName}`, 110, sigY + 5);

      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(
        `BTP SmartTools AI — Relatório de Equipamentos a Bordo emitido em ${currentDate} às ${currentTime}. Terminal BTP Santos.`,
        14,
        285
      );

      doc.save(`BTP_Relatorio_Equipamentos_Navio_${selectedDate}_${selectedTurn}.pdf`);
    } else {
      // -------------------------------------------------------------
      // REPORT 2: RELATÓRIO DE ESTOQUE, MANUTENÇÃO E COMPRAS
      // -------------------------------------------------------------
      doc.setFillColor(30, 41, 59); // Dark Slate Header
      doc.rect(0, 0, 210, 35, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('BTP SmartTools AI — GESTÃO DE MATERIAIS', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('RELATÓRIO DE ESTOQUE, MANUTENÇÃO E PROCESSOS DE COMPRA', 14, 24);
      doc.text(`${config.companyName} | ${config.terminalName}`, 14, 29);

      // Metadata Block
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DADOS DE CONTROLE DE ESTOQUE E RESPONSÁVEIS', 14, 43);

      const metaData = [
        [`Data do Serviço: ${currentDate}`, `Hora da Emissão: ${currentTime}`, `Turno: ${selectedTurn}`],
        [`Turma: ${selectedTurma}`, `Facilitador: ${selectedFacilitador}`, `Supervisor: ${supervisorName}`],
        [`Status de Aprovação: ${approvalStatus.toUpperCase()}`, `Terminal: BTP Santos`, `CNPJ: ${config.cnpj}`],
      ];

      autoTable(doc, {
        startY: 46,
        body: metaData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
      });

      // Table 1: Inventory Table
      const lastY0 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. MATERIAIS EM ESTOQUE DISPONÍVEL NO ALMOXARIFADO', 14, lastY0);

      const toolRows = tools.map(t => [
        t.name,
        t.category,
        t.available.toString(),
        t.inMaintenance.toString(),
        (t.available + t.inMaintenance).toString(),
        t.minStock.toString(),
        t.available <= t.minStock ? 'ATENÇÃO (CRÍTICO)' : 'NORMAL',
      ]);

      autoTable(doc, {
        startY: lastY0 + 3,
        head: [['Ferramenta / Equipamento', 'Categoria', 'Disponível', 'Manutenção', 'Estoque Total', 'Estoque Mín.', 'Status']],
        body: toolRows,
        theme: 'striped',
        headStyles: { fillColor: [0, 85, 150], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
      });

      // Table 2: Maintenance Items
      const lastY1 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('3. MATERIAIS EM PROCESSO DE MANUTENÇÃO', 14, lastY1);

      const maintRows = maintenances.map(m => [
        m.toolName,
        m.quantity.toString(),
        m.reason,
        m.responsible,
        m.date,
        m.status,
      ]);

      autoTable(doc, {
        startY: lastY1 + 3,
        head: [['Equipamento', 'Qtd', 'Avaria / Motivo', 'Responsável', 'Data Entrada', 'Status Reparativo']],
        body: maintRows.length > 0 ? maintRows : [['Nenhum item em manutenção', '-', '-', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [180, 110, 0], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      // Table 3: Purchase Requests
      const lastY2 = (doc as any).lastAutoTable.finalY + 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('4. MATERIAIS EM PROCESSO DE COMPRA E REQUISIÇÕES', 14, lastY2);

      const purchaseRows = purchases.map(p => [
        p.toolName,
        p.quantity.toString(),
        p.urgency,
        p.reason,
        p.requestedBy,
        p.estimatedCost ? `R$ ${p.estimatedCost.toLocaleString('pt-BR')}` : 'Sob cotação',
        p.status,
      ]);

      autoTable(doc, {
        startY: lastY2 + 3,
        head: [['Item Solicitado', 'Qtd', 'Urgência', 'Justificativa', 'Solicitante', 'Custo Est.', 'Status Compra']],
        body: purchaseRows.length > 0 ? purchaseRows : [['Nenhuma solicitação de compra em andamento', '-', '-', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
      });

      // Approval Stamp
      const lastY3 = (doc as any).lastAutoTable.finalY + 8;
      doc.setFillColor(245, 247, 250);
      doc.rect(14, lastY3, 182, 16, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(`PARECER DA SUPERVISÃO: STATUS DE APROVAÇÃO -> ${approvalStatus.toUpperCase()}`, 18, lastY3 + 10);

      // Signatures
      const sigY = lastY3 + 30;
      doc.setFont('helvetica', 'bold');
      doc.line(14, sigY, 90, sigY);
      doc.text(`Facilitador: ${selectedFacilitador} (${selectedTurma})`, 14, sigY + 5);

      doc.line(110, sigY, 186, sigY);
      doc.text(`Supervisor de Operações: ${supervisorName} [${approvalStatus.toUpperCase()}]`, 110, sigY + 5);

      // Footer
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(
        `BTP SmartTools AI — Relatório de Estoque e Compras emitido em ${currentDate} às ${currentTime}. Terminal BTP Santos.`,
        14,
        285
      );

      doc.save(`BTP_Relatorio_Estoque_Compras_${selectedDate}.pdf`);
    }
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    if (reportType === 'ship_equipments') {
      const pointSheetData: any[] = [];
      displayRecords.forEach(rec => {
        const { descritivoStr, totalPieces } = getPointMaterialTotals(rec);
        const pointShip = rec.shipName || 'Sem Navio Atracado';

        pointSheetData.push({
          'Ponto Operacional': rec.berth,
          'Navio em Operação': pointShip,
          'Turno Operacional': rec.turn,
          'Data': rec.date,
          'Qtd de Ternos': rec.numTernos,
          'Quantidade Total de Materiais no Ponto': descritivoStr,
          'Total de Peças': totalPieces,
          'Facilitador': selectedFacilitador,
          'Turma': selectedTurma,
          'Supervisor': supervisorName,
        });
      });

      const wsPoints = XLSX.utils.json_to_sheet(pointSheetData.length > 0 ? pointSheetData : [{ 'Info': 'Sem dados de pontos' }]);
      XLSX.utils.book_append_sheet(wb, wsPoints, 'Materiais por Ponto');
      XLSX.writeFile(wb, `BTP_Relatorio_Equipamentos_Pontos_${selectedDate}.xlsx`);
    } else {
      const toolsSheetData = tools.map(t => ({
        'Ferramenta': t.name,
        'Categoria': t.category,
        'Quantidade Disponível': t.available,
        'Quantidade em Manutenção': t.inMaintenance,
        'Estoque Total': t.available + t.inMaintenance,
        'Estoque Mínimo': t.minStock,
        'Status do Estoque': t.available <= t.minStock ? 'CRÍTICO' : 'OK',
      }));

      const maintSheetData = maintenances.map(m => ({
        'Equipamento': m.toolName,
        'Quantidade': m.quantity,
        'Motivo / Avaria': m.reason,
        'Responsável': m.responsible,
        'Status Manutenção': m.status,
        'Data Entrada': m.date,
      }));

      const purchaseSheetData = purchases.map(p => ({
        'Item Solicitado': p.toolName,
        'Quantidade Solicitada': p.quantity,
        'Nível Urgência': p.urgency,
        'Justificativa': p.reason,
        'Solicitante': p.requestedBy,
        'Custo Estimado (R$)': p.estimatedCost || 0,
        'Status da Compra': p.status,
        'Data Solicitada': p.date,
      }));

      const metaSheetData = [{
        'Data do Serviço': selectedDate,
        'Turno': selectedTurn,
        'Turma': selectedTurma,
        'Facilitador': selectedFacilitador,
        'Supervisor': supervisorName,
        'Status Aprovação': approvalStatus,
      }];

      const wsTools = XLSX.utils.json_to_sheet(toolsSheetData);
      const wsMaint = XLSX.utils.json_to_sheet(maintSheetData);
      const wsPurch = XLSX.utils.json_to_sheet(purchaseSheetData);
      const wsMeta = XLSX.utils.json_to_sheet(metaSheetData);

      XLSX.utils.book_append_sheet(wb, wsTools, 'Estoque de Ferramentas');
      XLSX.utils.book_append_sheet(wb, wsMaint, 'Ferramentas em Manutenção');
      XLSX.utils.book_append_sheet(wb, wsPurch, 'Processos de Compra');
      XLSX.utils.book_append_sheet(wb, wsMeta, 'Controle e Aprovações');

      XLSX.writeFile(wb, `BTP_Relatorio_Estoque_Manutencao_Compras_${selectedDate}.xlsx`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(
        `BTP SmartTools AI - Relatório (${reportType === 'ship_equipments' ? 'Equipamentos a Bordo do Navio' : 'Estoque, Manutenção e Compras'}) | Data: ${formatDateBR(selectedDate)} | Turno: ${selectedTurn} | Turma: ${selectedTurma} | Facilitador: ${selectedFacilitador} | Supervisor: ${supervisorName} | Status: ${approvalStatus}.`
      );
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    }
  };

  const currentBadge = getApprovalBadge(approvalStatus);

  return (
    <div className="space-y-6 animate-fade-in print:p-0 print:m-0">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Relatórios Operacionais BTP SmartTools
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Selecione o tipo de relatório desejado e personalize dados, navios, responsável e parecer de aprovação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleGeneratePDF}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Gerar PDF Oficial</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handleShare}
            className="px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{shareCopied ? 'Link Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
        <button
          onClick={() => setReportType('ship_equipments')}
          className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 cursor-pointer ${
            reportType === 'ship_equipments'
              ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-600 dark:border-blue-500 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
            <Ship className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider block">
              Relatório Tipo 1
            </span>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Equipamentos a Bordo dos Navios
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exibe quantidades totais de materiais alocados em cada ponto operacional e navio
            </p>
          </div>
        </button>

        <button
          onClick={() => setReportType('inventory_purchases')}
          className={`p-4 rounded-2xl border-2 transition-all text-left flex items-start gap-3 cursor-pointer ${
            reportType === 'inventory_purchases'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-600 dark:border-emerald-500 shadow-md'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-70 hover:opacity-100'
          }`}
        >
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
              Relatório Tipo 2
            </span>
            <h3 className="font-black text-sm text-slate-900 dark:text-white">
              Estoque, Manutenção e Compras
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controle geral de ferramentas em estoque, itens em manutenção e requisições com aprovação
            </p>
          </div>
        </button>
      </div>

      {/* Filters Card */}
      <M3Card className="space-y-4 print:hidden border-l-4 border-l-blue-600">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            <span>Filtros e Configuração do Relatório ({reportType === 'ship_equipments' ? 'Equipamentos no Navio' : 'Estoque / Compras'})</span>
          </h3>
          <span className="text-[11px] font-bold text-slate-500">
            Terminal BTP Santos
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Data do Serviço */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Data do Serviço</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
            />
          </div>

          {/* Turno Operacional */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Turno Operacional</span>
            </label>
            <select
              value={selectedTurn}
              onChange={e => setSelectedTurn(e.target.value as ShiftTurn)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
            >
              <option value="07-13">Turno 1 (07:00 - 13:00)</option>
              <option value="13-19">Turno 2 (13:00 - 19:00)</option>
              <option value="19-01">Turno 3 (19:00 - 01:00)</option>
              <option value="01-07">Turno 4 (01:00 - 07:00)</option>
            </select>
          </div>

          {/* Turma (A, B, C, D, E) */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-purple-600" />
              <span>Turma</span>
            </label>
            <select
              value={selectedTurma}
              onChange={e => handleTurmaChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-purple-700 dark:text-purple-300"
            >
              <option value="Turma A">Turma A</option>
              <option value="Turma B">Turma B</option>
              <option value="Turma C">Turma C</option>
              <option value="Turma D">Turma D</option>
              <option value="Turma E">Turma E</option>
            </select>
          </div>

          {/* Facilitador */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Facilitador (Nome)</span>
            </label>
            <select
              value={selectedFacilitador}
              onChange={e => handleFacilitadorChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-emerald-700 dark:text-emerald-300"
            >
              <option value="Bolacha">Bolacha (Turma A)</option>
              <option value="Thiago">Thiago (Turma B)</option>
              <option value="Conde">Conde (Turma C)</option>
              <option value="Gasolina">Gasolina (Turma D)</option>
              <option value="XTudo">XTudo (Turma E)</option>
            </select>
          </div>
        </div>

        {/* Dynamic Filters depending on Report Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
          {reportType === 'ship_equipments' ? (
            <>
              {/* Ponto Operacional */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Anchor className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ponto Operacional</span>
                </label>
                <select
                  value={selectedBerth}
                  onChange={e => setSelectedBerth(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                >
                  <option value="Ponto 1">Ponto 1</option>
                  <option value="Ponto 2">Ponto 2</option>
                  <option value="Ponto 3">Ponto 3</option>
                  <option value="Todos">Todos os Pontos</option>
                </select>
              </div>

              {/* Navio em Operação (Puxa do Banco de Navios) */}
              <div className="sm:col-span-2 space-y-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5 text-blue-600" />
                    <span>Navio em Operação no {selectedBerth}</span>
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    {ships.length} Cadastrados na Base de Dados
                  </span>
                </label>
                <input
                  type="text"
                  list="ships-datalist"
                  value={selectedShip}
                  onChange={e => handleShipNameChange(e.target.value)}
                  placeholder="Digite ou selecione o navio (ex: Cap San Augustin, AMERICO VESPUCIO...)"
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold text-blue-700 dark:text-blue-300"
                />
                <datalist id="ships-datalist">
                  {ships.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} • Castanha: {s.castanha} • {s.hasPeDeGalinha ? 'Com Pé de Galinha' : 'Sem Pé de Galinha'}
                    </option>
                  ))}
                  <option value="Sem Navio Atracado" />
                </datalist>

                {/* Exibição dinâmica das especificações técnicas do navio do Banco */}
                {selectedShip && selectedShip !== 'Sem Navio Atracado' && (
                  <ShipDatabaseInfoCard shipName={selectedShip} />
                )}
              </div>
            </>
          ) : (
            <>
              {/* Supervisor Responsável */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Supervisor Responsável</span>
                </label>
                <input
                  type="text"
                  value={supervisorName}
                  onChange={e => setSupervisorName(e.target.value)}
                  placeholder="Nome do Supervisor..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-extrabold"
                />
              </div>

              {/* Status de Aprovação */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Status de Aprovação do Relatório</span>
                </label>
                <select
                  value={approvalStatus}
                  onChange={e => setApprovalStatus(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-black text-slate-900 dark:text-white"
                >
                  <option value="Aprovado">Aprovado</option>
                  <option value="Aguardando Aprovação">Aguardando Aprovação</option>
                  <option value="Reprovado">Reprovado</option>
                </select>
              </div>

              {/* Status Preview Badge */}
              <div className="flex items-end">
                <div className={`w-full p-2.5 rounded-xl border flex items-center gap-2 font-black text-xs ${currentBadge.bg}`}>
                  {currentBadge.icon}
                  <span>{currentBadge.label}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </M3Card>

      {/* DOCUMENT PREVIEW CARD */}
      <M3Card className="p-6 md:p-8 space-y-6 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 shadow-xl">
        {/* Document Header */}
        <div className="border-b-2 border-slate-800 dark:border-slate-700 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
              BTP
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {reportType === 'ship_equipments'
                  ? 'Relatório Operacional de Ferramentas a Bordo dos Navios'
                  : 'Relatório de Gestão de Estoque, Manutenção e Compras'}
              </h1>
              <p className="text-xs text-slate-500 font-bold">{config.companyName} | {config.terminalName}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <p><span className="font-bold">Data do Serviço:</span> {formatDateBR(selectedDate)}</p>
            <p><span className="font-bold">Turno:</span> {selectedTurn}</p>
          </div>
        </div>

        {/* Operational Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px]">Data</span>
            <span className="font-black text-slate-900 dark:text-white text-sm">{formatDateBR(selectedDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px]">Turno</span>
            <span className="font-black text-slate-900 dark:text-white text-sm">{selectedTurn}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px]">Facilitador</span>
            <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">{selectedFacilitador}</span>
          </div>
          <div>
            <span className="text-slate-400 font-bold block uppercase text-[10px]">Turma</span>
            <span className="font-black text-purple-700 dark:text-purple-300 text-sm">{selectedTurma}</span>
          </div>

          {reportType === 'ship_equipments' ? (
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Navio em Operação</span>
              <span className="font-black text-blue-700 dark:text-blue-300 text-sm truncate block">
                {selectedBerth !== 'Todos' ? (selectedShip || 'Não informado') : 'Ver por Ponto'}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-slate-400 font-bold block uppercase text-[10px]">Status Aprovação</span>
              <span className={`px-2 py-0.5 rounded-md font-black text-xs inline-block mt-0.5 border ${currentBadge.bg}`}>
                {currentBadge.label}
              </span>
            </div>
          )}
        </div>

        {/* PREVIEW CONTENT FOR REPORT 1: SHIP EQUIPMENTS */}
        {reportType === 'ship_equipments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="font-black text-xs text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-600" />
                <span>Quantidades Totais de Materiais pelos Respectivos Pontos ({selectedBerth})</span>
              </h4>
              <span className="text-xs font-bold text-slate-500">
                Turno: {selectedTurn} | Data: {formatDateBR(selectedDate)}
              </span>
            </div>

            <div className="space-y-4">
              {displayRecords.map((rec, idx) => {
                const totals = getPointMaterialTotals(rec);
                const currentPointShip = rec.shipName || 'Sem Navio Atracado';

                return (
                  <div key={rec.id || idx} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    {/* Header bar per point */}
                    <div className="bg-slate-100 dark:bg-slate-800/90 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span className="px-3 py-1 bg-amber-600 text-white font-black rounded-lg text-xs">
                          {rec.berth}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Navio: <span className="text-blue-600 dark:text-blue-400 font-black text-sm">{currentPointShip}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 font-semibold">
                        <span>{rec.numTernos} Ternos de Trabalho</span>
                        <span>•</span>
                        <span className="font-black text-blue-700 dark:text-blue-300 px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 rounded-md">
                          {totals.totalPieces} Peças Totais no Ponto
                        </span>
                      </div>
                    </div>

                    {/* Point Material Aggregated Total Section */}
                    <div className="p-4 bg-white dark:bg-slate-900 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-amber-600" />
                          <span>Quantidade Total de Materiais Alocados no {rec.berth}:</span>
                        </h5>
                        <span className="text-[10px] text-slate-400 font-mono">Consolidado do Ponto</span>
                      </div>

                      {Object.keys(totals.aggregatedMap).length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {Object.entries(totals.aggregatedMap).map(([toolName, qty]) => (
                            <div
                              key={toolName}
                              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 shadow-2xs"
                            >
                              <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{toolName}:</span>
                              <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-xs font-mono">
                                {qty} un
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Nenhum material alocado para este ponto no turno selecionado.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI Parecer Box */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 space-y-1">
              <span className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Parecer do Facilitador IA (Gemini Engine)
              </span>
              <p className="text-xs italic text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                "{latestAIOpinion}"
              </p>
            </div>
          </div>
        )}

        {/* PREVIEW CONTENT FOR REPORT 2: INVENTORY & PURCHASES */}
        {reportType === 'inventory_purchases' && (
          <div className="space-y-6">
            {/* Table 1: Inventory */}
            <div className="space-y-2">
              <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>1. Quantidade de Materiais em Estoque Disponível no Almoxarifado</span>
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Ferramenta / Equipamento</th>
                      <th className="p-2.5">Categoria</th>
                      <th className="p-2.5 text-center">Disponível</th>
                      <th className="p-2.5 text-center">Em Manutenção</th>
                      <th className="p-2.5 text-center">Estoque Total</th>
                      <th className="p-2.5 text-center">Estoque Mín.</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {tools.map(t => (
                      <tr key={t.id}>
                        <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{t.name}</td>
                        <td className="p-2.5 text-slate-500 font-medium">{t.category}</td>
                        <td className="p-2.5 text-center font-black text-emerald-600">{t.available}</td>
                        <td className="p-2.5 text-center font-black text-amber-600">{t.inMaintenance}</td>
                        <td className="p-2.5 text-center font-black text-slate-900 dark:text-white">{t.available + t.inMaintenance}</td>
                        <td className="p-2.5 text-center text-slate-500">{t.minStock}</td>
                        <td className="p-2.5 text-center">
                          {t.available <= t.minStock ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 font-black text-[10px]">
                              ATENÇÃO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-[10px]">
                              NORMAL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 2: Maintenance */}
            <div className="space-y-2">
              <h4 className="font-black text-xs text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>2. Materiais e Equipamentos em Manutenção / Reparo</span>
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Equipamento</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5">Motivo / Avaria</th>
                      <th className="p-2.5">Responsável</th>
                      <th className="p-2.5 text-center">Data Entrada</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {maintenances.length > 0 ? (
                      maintenances.map(m => (
                        <tr key={m.id}>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{m.toolName}</td>
                          <td className="p-2.5 text-center font-black text-amber-600">{m.quantity}</td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{m.reason}</td>
                          <td className="p-2.5 text-slate-500">{m.responsible}</td>
                          <td className="p-2.5 text-center text-slate-500">{formatDateBR(m.date)}</td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-black text-[10px]">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="p-3 text-center text-slate-400 italic">
                          Nenhum material em processo de manutenção no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Table 3: Purchase Requests */}
            <div className="space-y-2">
              <h4 className="font-black text-xs text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
                <span>3. Materiais em Processo de Compra e Requisição</span>
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Item Solicitado</th>
                      <th className="p-2.5 text-center">Qtd</th>
                      <th className="p-2.5 text-center">Urgência</th>
                      <th className="p-2.5">Justificativa</th>
                      <th className="p-2.5">Solicitante</th>
                      <th className="p-2.5 text-right">Custo Est. (R$)</th>
                      <th className="p-2.5 text-center">Status Compra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {purchases.length > 0 ? (
                      purchases.map(p => (
                        <tr key={p.id}>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">{p.toolName}</td>
                          <td className="p-2.5 text-center font-black text-emerald-600">{p.quantity}</td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                p.urgency === 'Alta'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {p.urgency}
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-300">{p.reason}</td>
                          <td className="p-2.5 text-slate-500">{p.requestedBy}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {p.estimatedCost ? `R$ ${p.estimatedCost.toLocaleString('pt-BR')}` : 'Sob cotação'}
                          </td>
                          <td className="p-2.5 text-center">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-black text-[10px]">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="p-3 text-center text-slate-400 italic">
                          Nenhum processo de compra atrelado no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Approval Banner */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${currentBadge.bg}`}>
              <div className="flex items-center gap-2">
                {currentBadge.icon}
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block">Parecer da Supervisão</span>
                  <p className="font-black text-sm">Status de Aprovação: {currentBadge.label}</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold">
                Data do Parecer: {formatDateBR(selectedDate)}
              </span>
            </div>
          </div>
        )}

        {/* Signatures Footer */}
        <div className="pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-center text-xs font-bold text-slate-600 dark:text-slate-400">
          <div className="space-y-1">
            <div className="border-t-2 border-slate-400 dark:border-slate-600 pt-2" />
            <p className="font-extrabold text-slate-900 dark:text-white">Assinatura do Facilitador</p>
            <p className="text-emerald-600 dark:text-emerald-400">{selectedFacilitador} ({selectedTurma})</p>
            <p className="text-[10px] text-slate-400 font-mono">Data: {formatDateBR(selectedDate)}</p>
          </div>

          <div className="space-y-1">
            <div className="border-t-2 border-slate-400 dark:border-slate-600 pt-2" />
            <p className="font-extrabold text-slate-900 dark:text-white">Assinatura do Supervisor de Operações</p>
            <p className="text-blue-600 dark:text-blue-400">{supervisorName}</p>
            <p className="text-[10px] text-slate-400 font-mono">Status: {approvalStatus}</p>
          </div>
        </div>
      </M3Card>
    </div>
  );
};
