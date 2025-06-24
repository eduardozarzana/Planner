
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppData } from '../contexts/AppDataContext';
import { ROUTES, APP_NAME } from '../constants';
import Card from '../components/shared/Card';
import Alert from '../components/shared/Alert'; // Added Alert
import { WrenchScrewdriverIcon, SupplementBottleIcon, ListIcon, CalendarIcon } from '../components/icons';
import { ScheduledProductionRun, Product, ProductionLine, ScheduleStatus } from '../types';
import GanttChart from '../components/gantt/GanttChart'; // Import the new GanttChart component

const DashboardPage: React.FC = () => {
  const { 
    equipment, 
    products, 
    productionLines, 
    schedules, 
    getProductById, 
    getProductionLineById,
    updateSchedule,
    addWorkingTime, // Added
    calculateEffectiveWorkDuration // Added
  } = useAppData();
  const [currentTimeForGantt, setCurrentTimeForGantt] = useState(new Date()); // For Gantt's current time indicator
  const [ganttFeedback, setGanttFeedback] = useState<{message: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    // This timer is now only for updating the visual current time indicator in Gantt
    const timer = setInterval(() => {
      setCurrentTimeForGantt(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []); // No dependencies needed for this visual timer if it only sets local state

  const summaryItems = [
    { title: 'Total de Equipamentos', count: equipment.length, link: ROUTES.EQUIPMENT, icon: <WrenchScrewdriverIcon className="w-8 h-8 text-yellow-500" /> },
    { title: 'Total de Produtos', count: products.length, link: ROUTES.PRODUCTS, icon: <SupplementBottleIcon className="w-8 h-8 text-yellow-500" /> },
    { title: 'Linhas de Produção', count: productionLines.length, link: ROUTES.LINES, icon: <ListIcon className="w-8 h-8 text-yellow-500" /> },
    { title: 'Produções Agendadas (Total)', count: schedules.length, link: ROUTES.SCHEDULING, icon: <CalendarIcon className="w-8 h-8 text-yellow-500" /> },
  ];

  const ganttViewStartDate = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 2); // Start 2 days ago
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const ganttViewEndDate = useMemo(() => {
    const end = new Date(ganttViewStartDate);
    end.setDate(ganttViewStartDate.getDate() + 6); // Show 6 days (exclusive end for filtering)
    return end;
  }, [ganttViewStartDate]);
  
  const ganttDisplayEndDate = useMemo(() => {
    const end = new Date(ganttViewStartDate);
    end.setDate(ganttViewStartDate.getDate() + 5); // Last day displayed is start_date + 5 (Today+3)
    end.setHours(23,59,59,999);
    return end;
  }, [ganttViewStartDate]);


  const schedulesForGanttView = useMemo(() => {
    return schedules
      .filter(s => {
        const scheduleStartTime = new Date(s.startTime);
        const scheduleEndTime = new Date(s.endTime);
        // Check for overlap: schedule starts before view ends AND schedule ends after view starts
        return scheduleStartTime < ganttViewEndDate && scheduleEndTime > ganttViewStartDate;
      })
      .map(s => { 
        const product = getProductById(s.productId);
        const line = getProductionLineById(s.lineId);
        return {
          ...s,
          productName: product?.name || "Desconhecido",
          productClassification: product?.classification || 'Normal',
          lineName: line?.name || "Desconhecida",
        };
      });
  }, [schedules, ganttViewStartDate, ganttViewEndDate, getProductById, getProductionLineById]);


  const agendaDoDia = useMemo(() => {
    const todayActual = new Date();
    todayActual.setHours(0,0,0,0);
    const tomorrowActual = new Date(todayActual);
    tomorrowActual.setDate(todayActual.getDate() + 1);

    return schedules
      .filter(s => {
        const startTime = new Date(s.startTime);
        return startTime >= todayActual && startTime < tomorrowActual;
      })
      .map(s => ({
        ...s,
        productName: getProductById(s.productId)?.name || "Desconhecido",
        lineName: getProductionLineById(s.lineId)?.name || "Desconhecida",
      }))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  },[schedules, getProductById, getProductionLineById]);


  const linhasOcupadas = useMemo(() => {
    const nowForFilter = new Date(); // Use a fresh 'now' for filtering occupied lines
    return schedules.filter(s => {
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      return s.status === 'Em Progresso' && nowForFilter >= start && nowForFilter < end;
    });
  }, [schedules, currentTimeForGantt]); // currentTimeForGantt can trigger re-check for display
  
  const getStatusColor = (status: ScheduledProductionRun['status']) => {
    switch(status) {
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      case 'Em Progresso': return 'bg-sky-100 text-sky-800';
      case 'Concluído': return 'bg-emerald-100 text-emerald-800';
      case 'Cancelado': return 'bg-red-100 text-red-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const handleGanttUpdateFeedback = (message: string, type: 'success' | 'error' | 'info') => {
    setGanttFeedback({ message, type });
    setTimeout(() => setGanttFeedback(null), 5000); 
  };
  
  const ganttChartTitle = `Planejamento de Produção - ${ganttViewStartDate.toLocaleDateString('pt-BR')} a ${ganttDisplayEndDate.toLocaleDateString('pt-BR')}`;


  return (
    <div className="space-y-8">
      <p className="text-lg text-green-700">
        Bem-vindo ao {APP_NAME}!
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryItems.map((item) => (
          <Link to={item.link} key={item.title} className="block hover:shadow-xl transition-shadow duration-200">
            <Card className="h-full">
              <div className="flex items-center space-x-4">
                <div className="p-3 rounded-full bg-lime-100">
                  {item.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-green-600">{item.title}</p>
                  <p className="text-2xl font-semibold text-green-900">{item.count}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card title={ganttChartTitle}>
        {ganttFeedback && (
          <Alert type={ganttFeedback.type} message={ganttFeedback.message} onClose={() => setGanttFeedback(null)} />
        )}
        {productionLines.length > 0 && schedulesForGanttView.length > 0 ? (
          <GanttChart
            schedules={schedulesForGanttView}
            lines={productionLines.filter(line => schedulesForGanttView.some(s => s.lineId === line.id))} 
            day={ganttViewStartDate} 
            currentTime={currentTimeForGantt} 
            updateSchedule={updateSchedule}
            getProductById={getProductById}
            getProductionLineById={getProductionLineById}
            onUpdateFeedback={handleGanttUpdateFeedback}
            addWorkingTime={addWorkingTime} // Added
            calculateEffectiveWorkDuration={calculateEffectiveWorkDuration} // Added
          />
        ) : (
          <p className="text-green-600 py-4">
            {productionLines.length === 0 ? "Nenhuma linha de produção cadastrada." : "Nenhuma produção agendada para o período visualizado."}
          </p>
        )}
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Resumo da Agenda do Dia">
          {agendaDoDia.length === 0 ? (
            <p className="text-green-600">Nenhuma produção agendada para hoje.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {agendaDoDia.map(s => (
                <li key={s.id} className="p-3 bg-lime-50 rounded-md shadow-sm">
                  <div className="font-medium text-green-800">{s.productName}</div>
                  <div className="text-sm text-green-600">
                    Linha: {s.lineName} <br/>
                    Horário: {new Date(s.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - {new Date(s.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="mt-1">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(s.status as ScheduleStatus)}`}>
                          {s.status}
                      </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Linhas Ocupadas Atualmente">
          {linhasOcupadas.length === 0 ? (
            <p className="text-green-600">Nenhuma linha ocupada no momento.</p>
          ) : (
            <ul className="space-y-3  max-h-96 overflow-y-auto">
              {linhasOcupadas.map(s => {
                const product = getProductById(s.productId);
                const line = getProductionLineById(s.lineId);
                return (
                  <li key={s.id} className="p-3 bg-yellow-50 rounded-md shadow-sm">
                    <div className="font-medium text-yellow-800">{line?.name || 'Linha desconhecida'}</div>
                    <div className="text-sm text-green-700">
                      Produto: {product?.name || 'Produto desconhecido'} <br/>
                      Prev. Fim: {new Date(s.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                     <div className="mt-1">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(s.status as ScheduleStatus)}`}>
                            {s.status}
                        </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
