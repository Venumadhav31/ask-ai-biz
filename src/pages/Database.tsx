import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Database as DatabaseIcon, RefreshCw, Table, History, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface BusinessAnalysisRow {
  id: string;
  business_idea: string;
  location: string | null;
  budget: string | null;
  verdict: string | null;
  score: number | null;
  ai_model_used: string | null;
  created_at: string;
}

interface MarketTrendRow {
  id: string;
  year: number;
  month: number;
  sector: string;
  market_size: number | null;
  growth_rate: number | null;
  investment_volume: number | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  preferred_ai_model: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function Database() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<BusinessAnalysisRow[]>([]);
  const [trends, setTrends] = useState<MarketTrendRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchData();
    }
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch user's analyses
      const { data: analysesData, error: analysesError } = await supabase
        .from('business_analyses')
        .select('id, business_idea, location, budget, verdict, score, ai_model_used, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (analysesError) throw analysesError;
      setAnalyses(analysesData || []);

      // Fetch market trends
      const { data: trendsData, error: trendsError } = await supabase
        .from('market_trends')
        .select('*')
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (trendsError) throw trendsError;
      setTrends(trendsData || []);

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (!profileError) {
        setProfile(profileData);
      }

      toast.success('Data loaded successfully');
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getVerdictBadge = (verdict: string | null) => {
    switch (verdict) {
      case 'GO':
        return <Badge className="bg-go/20 text-go border-go/30">GO</Badge>;
      case 'CAUTION':
        return <Badge className="bg-caution/20 text-caution border-caution/30">CAUTION</Badge>;
      case 'AVOID':
        return <Badge className="bg-avoid/20 text-avoid border-avoid/30">AVOID</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value}`;
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30">
                <DatabaseIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Database Explorer</h1>
                <p className="text-xs text-muted-foreground">View your stored data</p>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </header>

      <main className="container py-6">
        <Tabs defaultValue="analyses" className="space-y-6">
          <TabsList className="bg-secondary/30 border border-border/50">
            <TabsTrigger value="analyses" className="gap-2">
              <History className="w-4 h-4" />
              My Analyses
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Market Trends
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <Table className="w-4 h-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyses">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Business Analyses History</CardTitle>
              </CardHeader>
              <CardContent>
                {analyses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No analyses yet. Start by analyzing a business idea in the Chat tab.
                  </p>
                ) : (
                  <UITable>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business Idea</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Verdict</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyses.map((analysis) => (
                        <TableRow key={analysis.id}>
                          <TableCell className="max-w-[200px] truncate">
                            {analysis.business_idea}
                          </TableCell>
                          <TableCell>{analysis.location || '-'}</TableCell>
                          <TableCell>{analysis.budget || '-'}</TableCell>
                          <TableCell>{getVerdictBadge(analysis.verdict)}</TableCell>
                          <TableCell>{analysis.score ?? '-'}/100</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {analysis.ai_model_used || 'gemini'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(analysis.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </UITable>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Historical Market Trends (2019-2025)</CardTitle>
              </CardHeader>
              <CardContent>
                <UITable>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Market Size</TableHead>
                      <TableHead>Growth Rate</TableHead>
                      <TableHead>Investment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trends.map((trend) => (
                      <TableRow key={trend.id}>
                        <TableCell>{trend.year}</TableCell>
                        <TableCell>
                          {new Date(2000, trend.month - 1).toLocaleString('default', { month: 'short' })}
                        </TableCell>
                        <TableCell>{trend.sector}</TableCell>
                        <TableCell>{formatCurrency(trend.market_size)}</TableCell>
                        <TableCell className={trend.growth_rate && trend.growth_rate > 0 ? 'text-go' : 'text-avoid'}>
                          {trend.growth_rate ? `${trend.growth_rate > 0 ? '+' : ''}${trend.growth_rate}%` : '-'}
                        </TableCell>
                        <TableCell>{formatCurrency(trend.investment_volume)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </UITable>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
              </CardHeader>
              <CardContent>
                {profile ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Display Name</p>
                        <p className="font-medium">{profile.display_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avatar</p>
                        <p className="font-medium">{profile.avatar_url ? 'Set' : 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Preferred AI Model</p>
                        <Badge variant="outline">{profile.preferred_ai_model || 'gemini'}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Member Since</p>
                        <p className="font-medium">{formatDate(profile.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Profile not found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
