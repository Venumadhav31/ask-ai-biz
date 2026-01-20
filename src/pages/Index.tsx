import { useState } from 'react';
import { Header } from '@/components/Header';
import { ChatTab } from '@/components/ChatTab';
import { CompetitionTab } from '@/components/CompetitionTab';
import { BudgetTab } from '@/components/BudgetTab';
import { RoadmapTab } from '@/components/RoadmapTab';
import { DashboardTab } from '@/components/DashboardTab';
import { TestSuiteModal } from '@/components/TestSuiteModal';
import { BusinessAnalysis } from '@/types/analysis';

const Index = () => {
  const [activeTab, setActiveTab] = useState('chat');
  const [currentAnalysis, setCurrentAnalysis] = useState<BusinessAnalysis | null>(null);
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState(false);

  const handleAnalysisComplete = (analysis: BusinessAnalysis) => {
    setCurrentAnalysis(analysis);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenTestSuite={() => setIsTestSuiteOpen(true)}
      />

      <main className="container py-6">
        {activeTab === 'chat' && (
          <ChatTab onAnalysisComplete={handleAnalysisComplete} />
        )}
        {activeTab === 'competition' && (
          <CompetitionTab analysis={currentAnalysis} />
        )}
        {activeTab === 'budget' && (
          <BudgetTab analysis={currentAnalysis} />
        )}
        {activeTab === 'roadmap' && (
          <RoadmapTab analysis={currentAnalysis} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab analysis={currentAnalysis} />
        )}
      </main>

      <TestSuiteModal
        open={isTestSuiteOpen}
        onOpenChange={setIsTestSuiteOpen}
      />
    </div>
  );
};

export default Index;
