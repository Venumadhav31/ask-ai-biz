import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { ChatTab } from '@/components/ChatTab';
import { CompetitionTab } from '@/components/CompetitionTab';
import { ProfitLossTab } from '@/components/ProfitLossTab';
import { RoadmapTab } from '@/components/RoadmapTab';
import { DashboardTab } from '@/components/DashboardTab';
import { MarketTab } from '@/components/MarketTab';
import { BusinessAnalysis } from '@/types/analysis';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [currentAnalysis, setCurrentAnalysis] = useState<BusinessAnalysis | null>(null);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleAnalysisComplete = (analysis: BusinessAnalysis) => {
    setCurrentAnalysis(analysis);
  };

  // Show nothing while checking auth
  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="container py-6">
        {activeTab === 'chat' && (
          <ChatTab onAnalysisComplete={handleAnalysisComplete} />
        )}
        {activeTab === 'dashboard' && (
          <DashboardTab analysis={currentAnalysis} />
        )}
        {activeTab === 'market' && (
          <MarketTab analysis={currentAnalysis} />
        )}
        {activeTab === 'competition' && (
          <CompetitionTab analysis={currentAnalysis} />
        )}
        {activeTab === 'profitloss' && (
          <ProfitLossTab analysis={currentAnalysis} />
        )}
        {activeTab === 'roadmap' && (
          <RoadmapTab analysis={currentAnalysis} />
        )}
      </main>

    </div>
  );
};

export default Index;
