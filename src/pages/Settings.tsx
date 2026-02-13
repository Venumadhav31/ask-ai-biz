import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings as SettingsIcon, Bot, Save, Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function Settings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [preferredModel, setPreferredModel] = useState('gemini');
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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


        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your account password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10 pr-10 bg-secondary/30 border-border/50"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-secondary/30 border-border/50"
                />
              </div>
            </div>

            <Button
              onClick={async () => {
                if (newPassword.length < 6) {
                  toast.error('Password must be at least 6 characters');
                  return;
                }
                if (newPassword !== confirmPassword) {
                  toast.error('Passwords do not match');
                  return;
                }
                setChangingPassword(true);
                try {
                  const { error } = await supabase.auth.updateUser({ password: newPassword });
                  if (error) {
                    toast.error(error.message);
                  } else {
                    toast.success('Password updated successfully');
                    setNewPassword('');
                    setConfirmPassword('');
                  }
                } catch {
                  toast.error('Failed to update password');
                } finally {
                  setChangingPassword(false);
                }
              }}
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {changingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Lock className="w-4 h-4 mr-2" />
              )}
              Update Password
            </Button>
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
