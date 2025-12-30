import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Video, PhoneOff, Mic, MicOff, Camera, CameraOff } from "lucide-react";
import remoteVideoSrc from "@/assets/fake-call-remote.mp4";
import { supabase } from "@/integrations/supabase/client";

interface MediaState {
  micOn: boolean;
  camOn: boolean;
}

interface PackageOption {
  id: string;
  label: string;
  minutes: number;
  price: number;
}

const CALL_DURATION_LIMIT_MINUTES = 30;

const PACKAGES: PackageOption[] = [
  { id: "p3", label: "3 minutos", minutes: 3, price: 9.9 },
  { id: "p5", label: "5 minutos", minutes: 5, price: 14.9 },
  { id: "p10", label: "10 minutos", minutes: 10, price: 24.9 },
];

const Index = () => {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mediaState, setMediaState] = useState<MediaState>({ micOn: true, camOn: true });
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [configVideoUrl, setConfigVideoUrl] = useState<string | null>(null);
  const [configAudioUrl, setConfigAudioUrl] = useState<string | null>(null);
  const [durationLimitSeconds, setDurationLimitSeconds] = useState<number | null>(null);
  const [hasDurationParam, setHasDurationParam] = useState(false);

  const [chatStep, setChatStep] = useState<"intro" | "minutes" | "contact" | "summary" | "finished">("intro");
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [contactChannel, setContactChannel] = useState<"whatsapp" | "telegram" | "email" | null>(null);
  const [contactValue, setContactValue] = useState("");


  const selfVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const selfStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    document.title = "Chamada de Vídeo Privada";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      const meta = document.createElement("meta");
      meta.name = "description";
      meta.content = "Sala de chamada de vídeo privada para seus atendimentos personalizados.";
      document.head.appendChild(meta);
    } else {
      metaDescription.setAttribute(
        "content",
        "Sala de chamada de vídeo privada com visual profissional, ideal para atendimentos individuais.",
      );
    }

    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement("link");
      link.rel = "canonical";
      link.href = window.location.href;
      document.head.appendChild(link);
    }

    // Verificar se a URL já traz uma duração específica (em segundos)
    const params = new URLSearchParams(window.location.search);
    const secondsFromUrl = params.get("seconds");
    if (secondsFromUrl) {
      const parsed = parseInt(secondsFromUrl, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        setDurationLimitSeconds(parsed);
        setHasDurationParam(true);
      }
    } else {
      setHasDurationParam(false);
    }

    // Buscar configuração de vídeo, áudio e duração do banco
    const loadConfig = async () => {
      const host = window.location.host;
      const { data } = await supabase
        .from("call_config")
        .select("video_url, audio_url, duration_seconds")
        .eq("site_id", host)
        .maybeSingle();

      if (data) {
        setConfigVideoUrl(data.video_url);
        setConfigAudioUrl(data.audio_url);
        setDurationLimitSeconds((prev) => (prev !== null ? prev : data.duration_seconds ?? null));
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    if (!inCall) return;

    const effectiveLimitSeconds = durationLimitSeconds ?? CALL_DURATION_LIMIT_MINUTES * 60;

    timerRef.current = window.setInterval(() => {
      setDuration((prev) => {
        if (prev + 1 >= effectiveLimitSeconds) {
          // Encerra a chamada silenciosamente quando o tempo máximo é atingido
          endCall();
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCall, durationLimitSeconds]);

  const requestMedia = async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360 },
        audio: true,
      });
      selfStreamRef.current = stream;

      if (selfVideoRef.current) {
        selfVideoRef.current.srcObject = stream;
        selfVideoRef.current.muted = true;
        await selfVideoRef.current.play().catch(() => undefined);
      }

      return true;
    } catch (error) {
      console.error("Erro ao acessar câmera/microfone", error);
      const humanMessage =
        "Não foi possível acessar sua câmera ou microfone. Verifique as permissões do navegador.";
      setPermissionError(humanMessage);
      toast({
        variant: "destructive",
        title: "Permissão necessária",
        description: humanMessage,
      });
      return false;
    }
  };

  const startCall = async () => {
    setConnecting(true);
    const ok = await requestMedia();
    if (!ok) {
      setConnecting(false);
      return;
    }

    setDuration(0);
    setInCall(true);
    setConnecting(false);
  };

  // Garantir que o vídeo da sua câmera apareça assim que a chamada estiver ativa
  useEffect(() => {
    if (!inCall) return;

    if (selfVideoRef.current && selfStreamRef.current) {
      selfVideoRef.current.srcObject = selfStreamRef.current;
      selfVideoRef.current.muted = true;
      selfVideoRef.current.play().catch(() => undefined);
    }
  }, [inCall]);

  useEffect(() => {
    // Inicia a chamada automaticamente apenas quando houver duração na URL (modo sala)
    const params = new URLSearchParams(window.location.search);
    if (params.get("seconds")) {
      startCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Sincronizar áudio com o vídeo remoto quando disponível
    if (remoteVideoRef.current && remoteAudioRef.current && configAudioUrl) {
      const video = remoteVideoRef.current;
      const audio = remoteAudioRef.current;

      const syncAudio = () => {
        audio.currentTime = video.currentTime;
        if (!video.paused) {
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      };

      video.addEventListener("play", () => audio.play().catch(() => {}));
      video.addEventListener("pause", () => audio.pause());
      video.addEventListener("timeupdate", syncAudio);

      return () => {
        video.removeEventListener("play", syncAudio);
        video.removeEventListener("pause", syncAudio);
        video.removeEventListener("timeupdate", syncAudio);
      };
    }
  }, [configAudioUrl]);

  const stopMediaTracks = () => {
    if (selfStreamRef.current) {
      selfStreamRef.current.getTracks().forEach((track) => track.stop());
      selfStreamRef.current = null;
    }
  };

  const endCall = (reason?: string) => {
    setInCall(false);
    setDuration(0);
    stopMediaTracks();
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopMediaTracks();
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  const toggleMic = () => {
    const next = !mediaState.micOn;
    setMediaState((prev) => ({ ...prev, micOn: next }));
    if (selfStreamRef.current) {
      selfStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
    }
  };

  const toggleCam = () => {
    const next = !mediaState.camOn;
    setMediaState((prev) => ({ ...prev, camOn: next }));
    if (selfStreamRef.current) {
      selfStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = next));
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--call-surface))] text-foreground relative overflow-hidden">
      <main className="fixed inset-0 flex items-center justify-center overflow-hidden px-4">
        {/* Fluxo de chat guiado para venda quando não há duração na URL */}
        {!hasDurationParam && !inCall && (
          <div className="max-w-xl w-full space-y-6">
            <Card className="bg-[hsl(var(--call-surface-soft))] border-border/60 shadow-[var(--shadow-soft)] p-6 space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Fluxo guiado</p>
                <h1 className="text-2xl font-semibold leading-tight">
                  Escolha sua chamada de vídeo privada em poucos passos
                </h1>
                <p className="text-sm text-muted-foreground">
                  Responda rapidamente às perguntas abaixo, escolha a minutagem da chamada e receba o link pronto
                  para entrar na sala.
                </p>
              </div>

              {/* Passo: escolha de pacote */}
              {(chatStep === "intro" || chatStep === "minutes") && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="inline-flex rounded-2xl bg-[hsl(var(--call-surface))] px-3 py-2 text-sm">
                      <span>Quantos minutos você quer de chamada?</span>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PACKAGES.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setChatStep("contact");
                        }}
                        className="flex flex-col items-start rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left shadow-sm transition hover:border-primary/70 hover:shadow-[var(--shadow-soft)]"
                      >
                        <span className="text-sm font-medium">{pkg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          Aproximadamente {pkg.minutes} minutos
                        </span>
                        <span className="mt-1 text-sm font-semibold text-primary">
                          R$ {pkg.price.toFixed(2).replace(".", ",")}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Valores de exemplo para testes — depois podemos ajustar os preços e pacotes no painel.
                  </p>
                </div>
              )}

              {/* Passo: contato */}
              {chatStep === "contact" && selectedPackage && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="inline-flex rounded-2xl bg-[hsl(var(--call-surface))] px-3 py-2 text-sm">
                      <span>
                        Perfeito, chamada de {selectedPackage.minutes} minutos. Onde você quer receber o link da
                        sala?
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={contactChannel === "whatsapp" ? "call-primary" : "call"}
                      onClick={() => setContactChannel("whatsapp")}
                    >
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={contactChannel === "telegram" ? "call-primary" : "call"}
                      onClick={() => setContactChannel("telegram")}
                    >
                      Telegram
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={contactChannel === "email" ? "call-primary" : "call"}
                      onClick={() => setContactChannel("email")}
                    >
                      E-mail
                    </Button>
                  </div>
                  {contactChannel && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">
                        {contactChannel === "email" ? "Digite seu e-mail" : "Digite seu número com DDD"}
                      </label>
                      <Input
                        value={contactValue}
                        onChange={(e) => setContactValue(e.target.value)}
                        placeholder={
                          contactChannel === "email"
                            ? "seuemail@exemplo.com"
                            : "(11) 99999-9999"
                        }
                        className="bg-background/80 border-border/70"
                      />
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setChatStep("minutes");
                        setContactChannel(null);
                        setContactValue("");
                      }}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      variant="call-primary"
                      disabled={!contactChannel || !contactValue.trim()}
                      onClick={() => setChatStep("summary")}
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              )}

              {/* Passo: resumo e geração de link de teste */}
              {chatStep === "summary" && selectedPackage && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="inline-flex rounded-2xl bg-[hsl(var(--call-surface))] px-3 py-2 text-sm">
                      <span>Revise os detalhes antes de ir para a chamada.</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Pacote escolhido:</span>{" "}
                      <span className="font-medium">{selectedPackage.label}</span> —
                      <span className="text-primary font-semibold"> R$ {selectedPackage.price.toFixed(2).replace(".", ",")}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Contato:</span>{" "}
                      <span className="font-medium capitalize">{contactChannel}</span>{" "}
                      <span className="text-muted-foreground">•</span>{" "}
                      <span>{contactValue}</span>
                    </p>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>
                      Nesta primeira versão, o pagamento ainda não está integrado. O botão abaixo gera um link de
                      teste da chamada com a minutagem escolhida.
                    </p>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setChatStep("contact")}
                    >
                      Voltar
                    </Button>
                    <Button
                      type="button"
                      variant="call-primary"
                      onClick={() => {
                        const seconds = selectedPackage.minutes * 60;
                        const url = `${window.location.origin}/?seconds=${seconds}`;
                        window.open(url, "_blank");
                        setChatStep("finished");
                        toast({
                          title: "Sala de chamada aberta",
                          description:
                            "Abrimos a sala de chamada em uma nova aba com a duração escolhida. Depois podemos conectar o pagamento aqui.",
                        });
                      }}
                    >
                      Gerar link de teste da chamada
                    </Button>
                  </div>
                </div>
              )}

              {chatStep === "finished" && (
                <div className="space-y-3 text-sm">
                  <div className="inline-flex rounded-2xl bg-[hsl(var(--call-surface))] px-3 py-2">
                    <span>
                      Link gerado e sala aberta em outra aba. Assim que integrarmos o gateway brasileiro, este passo
                      vai gerar a cobrança automaticamente.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="call"
                    onClick={() => {
                      setChatStep("minutes");
                      setSelectedPackage(null);
                      setContactChannel(null);
                      setContactValue("");
                    }}
                  >
                    Criar outra chamada de teste
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Layout da sala de chamada (modo direto com ?seconds=) */}
        {hasDurationParam && (
          <>
            {inCall && (
              <>
                <video
                  ref={remoteVideoRef}
                  className="absolute inset-0 h-full w-full object-cover bg-black"
                  src={configVideoUrl || remoteVideoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                />

                {configAudioUrl && <audio ref={remoteAudioRef} src={configAudioUrl} loop />}

                <div className="pointer-events-none absolute right-3 top-3 z-20 h-32 w-24 overflow-hidden rounded-2xl border border-[hsl(var(--call-surface-soft))] bg-[hsl(var(--call-surface-soft))] shadow-[0_10px_28px_hsl(210_80%_2%/0.85)] sm:right-5 sm:top-5 sm:h-40 sm:w-32">
                  <video
                    ref={selfVideoRef}
                    className="h-full w-full object-cover"
                    autoPlay
                    playsInline
                    muted
                  />
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(var(--call-surface)/0.96)] via-[hsl(var(--call-surface)/0.7)] to-transparent" />

                <div className="absolute inset-x-0 bottom-4 z-30 flex justify-center pb-2">
                  <div className="flex items-center gap-3 rounded-full bg-[hsl(var(--call-surface-soft)/0.92)] px-4 py-2 shadow-[0_18px_40px_hsl(210_80%_2%/0.95)] backdrop-blur-md">
                    <Button
                      size="icon"
                      variant="call"
                      aria-label={mediaState.micOn ? "Desativar microfone" : "Ativar microfone"}
                      onClick={toggleMic}
                    >
                      {mediaState.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="call"
                      aria-label={mediaState.camOn ? "Desativar câmera" : "Ativar câmera"}
                      onClick={toggleCam}
                    >
                      {mediaState.camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="call-danger"
                      aria-label="Encerrar chamada"
                      onClick={() => endCall("Você encerrou a chamada.")}
                    >
                      <PhoneOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Index;
