import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Bot, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preferredModel, setPreferredModel] = useState('gemini');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchSettings();
    }
  }, [user, authLoading, navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_ai_model')
      .eq('user_id', user?.id)
      .single();

    if (!error && data) {
      setPreferredModel(data.preferred_ai_model || 'gemini');
    }
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_ai_model: preferredModel })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20 border border-primary/30">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Settings</h1>
              <p className="text-xs text-muted-foreground">Configure your preferences</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-2xl">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              AI Model Selection
            </CardTitle>
            <CardDescription>
              Choose which AI model to use for business analysis. You can switch anytime.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={preferredModel} onValueChange={setPreferredModel}>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <RadioGroupItem value="gemini" id="gemini" />
                <Label htmlFor="gemini" className="cursor-pointer flex-1">
                  <div className="font-medium">Google Gemini (Recommended)</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Fast, accurate analysis using Google's Gemini 3 Flash model via Lovable AI Gateway. 
                    No setup required.
                  </p>
                </Label>
              </div>
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-secondary/30 border border-border/50">
                <RadioGroupItem value="ollama" id="ollama" />
                <Label htmlFor="ollama" className="cursor-pointer flex-1">
                  <div className="font-medium">Ollama (Self-hosted)</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use your own Ollama server with models like LLaMA 3.2, Mistral, etc. 
                    Requires server URL configuration.
                  </p>
                </Label>
              </div>
            </RadioGroup>

            {preferredModel === 'ollama' && (
              <div className="p-4 rounded-lg bg-caution/10 border border-caution/30">
                <p className="text-sm text-caution">
                  <strong>Note:</strong> Ollama integration requires a running Ollama server. 
                  Contact support to configure your server URL.
                </p>
              </div>
            )}

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Settings
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card mt-6">
          <CardHeader>
            <CardTitle>Methodologies & Frameworks Used</CardTitle>
            <CardDescription>
              Technologies powering BizFeasibility AI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <h4 className="font-medium mb-2">Frontend</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• React 18 + TypeScript</li>
                  <li>• Vite (Build Tool)</li>
                  <li>• Tailwind CSS + shadcn/ui</li>
                  <li>• Recharts (Visualization)</li>
                  <li>• React Router DOM</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <h4 className="font-medium mb-2">Backend</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Lovable Cloud (Supabase)</li>
                  <li>• Edge Functions (Deno)</li>
                  <li>• PostgreSQL Database</li>
                  <li>• Row Level Security (RLS)</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <h4 className="font-medium mb-2">AI Integration</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Lovable AI Gateway</li>
                  <li>• Google Gemini 3 Flash</li>
                  <li>• Ollama (Optional)</li>
                  <li>• Structured JSON Output</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-secondary/30 border border-border/50">
                <h4 className="font-medium mb-2">Analysis Framework</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Market Sizing (TAM/SAM/SOM)</li>
                  <li>• Financial Projections</li>
                  <li>• Competition Analysis</li>
                  <li>• Risk Assessment Matrix</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
