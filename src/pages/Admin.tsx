import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { LogOut, Upload, Video, Music, ClipboardCopy } from "lucide-react";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [currentConfig, setCurrentConfig] = useState<{
    video_url: string | null;
    audio_url: string | null;
    duration_seconds: number | null;
  } | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [generatorMinutes, setGeneratorMinutes] = useState<number | "">("");
  const [generatorSeconds, setGeneratorSeconds] = useState<number | "">("");
  const [generatorUrl, setGeneratorUrl] = useState<string>("");
  const [trialSeconds, setTrialSeconds] = useState<number | "">(10);
  const [trialUrl, setTrialUrl] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        loadCurrentConfig();
      }
      setCheckingAuth(false);
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadCurrentConfig = async () => {
    const { data, error } = await supabase
      .from("call_config")
      .select("video_url, audio_url, duration_seconds")
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .single();

    if (!error && data) {
      setCurrentConfig(data);
      setDurationMinutes(data.duration_seconds ? Math.round(data.duration_seconds / 60) : "");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/auth");
  };

  const buildCallUrl = (totalSeconds: number) => {
    const origin = window.location.origin;
    const url = new URL("/", origin);
    url.searchParams.set("seconds", String(totalSeconds));
    return url.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let videoUrl = currentConfig?.video_url || null;
      let audioUrl = currentConfig?.audio_url || null;
      const durationSeconds =
        typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes * 60 : null;

      // Upload do vídeo
      if (videoFile) {
        const videoFileName = `video-${Date.now()}.mp4`;
        const { error: videoError } = await supabase.storage
          .from("call-media")
          .upload(videoFileName, videoFile, { upsert: true });

        if (videoError) throw videoError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("call-media").getPublicUrl(videoFileName);

        videoUrl = publicUrl;
      }

      // Upload do áudio
      if (audioFile) {
        const audioFileName = `audio-${Date.now()}.mp3`;
        const { error: audioError } = await supabase.storage
          .from("call-media")
          .upload(audioFileName, audioFile, { upsert: true });

        if (audioError) throw audioError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("call-media").getPublicUrl(audioFileName);

        audioUrl = publicUrl;
      }

      // Atualizar configuração no banco
      const { error: updateError } = await supabase
        .from("call_config")
        .update({ video_url: videoUrl, audio_url: audioUrl, duration_seconds: durationSeconds })
        .eq("id", "00000000-0000-0000-0000-000000000000");

      if (updateError) throw updateError;

      toast({
        title: "Configuração salva!",
        description: "Vídeo, áudio e duração padrão atualizados com sucesso.",
      });

      setVideoFile(null);
      setAudioFile(null);
      loadCurrentConfig();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error.message,
      });
    }

    setLoading(false);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Verificando autenticação...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Painel Administrativo</h1>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração da Chamada</CardTitle>
            <CardDescription>
              Faça upload do vídeo (MP4) e áudio (MP3) para personalizar a experiência da chamada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="video" className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Vídeo de Fundo (MP4)
                </Label>
                <Input
                  id="video"
                  type="file"
                  accept="video/mp4"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                />
                {currentConfig?.video_url && (
                  <p className="text-sm text-muted-foreground">Vídeo atual configurado</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="audio" className="flex items-center gap-2">
                  <Music className="h-4 w-4" />
                  Áudio da Modelo (MP3)
                </Label>
                <Input
                  id="audio"
                  type="file"
                  accept="audio/mpeg,audio/mp3"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                />
                {currentConfig?.audio_url && (
                  <p className="text-sm text-muted-foreground">Áudio atual configurado</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duração padrão da chamada (minutos)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={120}
                  value={durationMinutes}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setDurationMinutes("");
                    } else {
                      const parsed = parseInt(value, 10);
                      setDurationMinutes(Number.isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  placeholder="Ex: 3"
                />
                <p className="text-xs text-muted-foreground">
                  Duração padrão usada quando o link não informar um tempo específico.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!videoFile && !audioFile && !durationMinutes)}
              >
                <Upload className="mr-2 h-4 w-4" />
                {loading ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gerar link de chamada</CardTitle>
            <CardDescription>
              Gere links individuais para cada cliente, com duração personalizada ou experimental.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Chamada normal (minutos e segundos)</Label>
              <div className="flex gap-3">
                <Input
                  type="number"
                  min={0}
                  max={120}
                  value={generatorMinutes}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setGeneratorMinutes("");
                    } else {
                      const parsed = parseInt(v, 10);
                      setGeneratorMinutes(Number.isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  placeholder="Minutos"
                />
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={generatorSeconds}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setGeneratorSeconds("");
                    } else {
                      const parsed = parseInt(v, 10);
                      setGeneratorSeconds(Number.isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  placeholder="Segundos"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const mins = typeof generatorMinutes === "number" ? generatorMinutes : 0;
                  const secs = typeof generatorSeconds === "number" ? generatorSeconds : 0;
                  const total = mins * 60 + secs;
                  if (total <= 0) {
                    toast({
                      variant: "destructive",
                      title: "Tempo inválido",
                      description: "Defina pelo menos 1 segundo de duração.",
                    });
                    return;
                  }
                  const url = buildCallUrl(total);
                  setGeneratorUrl(url);
                }}
              >
                Gerar link de chamada
              </Button>
              {generatorUrl && (
                <div className="space-y-2">
                  <Label>Link gerado</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={generatorUrl} className="text-xs" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(generatorUrl);
                        toast({
                          title: "Copiado",
                          description: "Link copiado para a área de transferência.",
                        });
                      }}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <Label>Chamada experimental (segundos)</Label>
              <div className="flex gap-3 items-center">
                <Input
                  type="number"
                  min={5}
                  max={60}
                  value={trialSeconds}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "") {
                      setTrialSeconds("");
                    } else {
                      const parsed = parseInt(v, 10);
                      setTrialSeconds(Number.isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  placeholder="Ex: 10"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const secs = typeof trialSeconds === "number" ? trialSeconds : 0;
                    if (secs <= 0) {
                      toast({
                        variant: "destructive",
                        title: "Tempo inválido",
                        description: "Defina ao menos alguns segundos.",
                      });
                      return;
                    }
                    const url = buildCallUrl(secs);
                    setTrialUrl(url);
                  }}
                >
                  Gerar link experimental
                </Button>
              </div>
              {trialUrl && (
                <div className="space-y-2">
                  <Label>Link experimental</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={trialUrl} className="text-xs" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(trialUrl);
                        toast({ title: "Copiado", description: "Link experimental copiado." });
                      }}
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
