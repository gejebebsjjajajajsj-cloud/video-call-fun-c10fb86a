import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
  { id: "p10", label: "10 minutos", minutes: 10, price: 49.9 },
  { id: "p20", label: "20 minutos", minutes: 20, price: 79.9 },
  { id: "p30", label: "30 minutos", minutes: 30, price: 99.9 },
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

  type ChatStep =
    | "intro"
    | "minutes"
    | "minutes_confirmed"
    | "contact_typing"
    | "contact"
    | "contact_confirmed"
    | "summary_typing"
    | "summary"
    | "finished";

  const [chatStep, setChatStep] = useState<ChatStep>("intro");
  const [selectedPackage, setSelectedPackage] = useState<PackageOption | null>(null);
  const [contactChannel, setContactChannel] = useState<"whatsapp" | "telegram" | "email" | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

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

  // Etapas intermediárias para simular digitação antes da próxima mensagem
  useEffect(() => {
    let timeout: number | undefined;

    if (chatStep === "minutes_confirmed") {
      setIsTyping(true);
      timeout = window.setTimeout(() => {
        setIsTyping(false);
        setChatStep("contact_typing");
      }, 700);
    } else if (chatStep === "contact_typing") {
      setIsTyping(true);
      timeout = window.setTimeout(() => {
        setIsTyping(false);
        setChatStep("contact");
      }, 800);
    } else if (chatStep === "contact_confirmed") {
      setIsTyping(true);
      timeout = window.setTimeout(() => {
        setIsTyping(false);
        setChatStep("summary_typing");
      }, 700);
    } else if (chatStep === "summary_typing") {
      setIsTyping(true);
      timeout = window.setTimeout(() => {
        setIsTyping(false);
        setChatStep("summary");
      }, 800);
    }

    return () => {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    };
  }, [chatStep]);

  return (
    <div className="min-h-screen bg-[hsl(var(--call-surface))] text-foreground relative overflow-hidden">
      <main className="fixed inset-0 flex items-center justify-center overflow-hidden px-4">
        {/* Fluxo de chat guiado em formato de conversa quando não há duração na URL */}
        {!hasDurationParam && !inCall && (
          <div className="max-w-md w-full">
            <Card className="flex h-[540px] flex-col overflow-hidden rounded-3xl border-border/60 bg-[hsl(var(--call-surface-soft))] shadow-[var(--shadow-soft)]">
              {/* Cabeçalho do chat */}
              <header className="flex items-center gap-3 border-b border-border/60 bg-[hsl(var(--call-surface))] px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-primary/20" />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Atendente da chamada</span>
                  <span className="text-[11px] text-muted-foreground">online agora • resposta em poucos segundos</span>
                </div>
              </header>

              {/* Área de mensagens */}
              <div className="flex-1 space-y-3 overflow-y-auto bg-[hsl(var(--call-surface))] px-4 py-4">
                {/* Mensagem inicial */}
                <div className="flex gap-2">
                  <div className="mt-5 h-7 w-7 rounded-full bg-primary/25" />
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-background/90 px-3 py-2 text-sm shadow-sm">
                    <p>Oi! Vamos montar sua chamada de vídeo privada agora mesmo. Me conta:</p>
                    <p className="mt-1 font-medium">Quantos minutos você quer nessa chamada?</p>
                  </div>
                </div>

                {/* Bolhas de escolha de pacote (apenas enquanto estiver escolhendo minutos) */}
                {(chatStep === "intro" || chatStep === "minutes") && (
                  <div className="flex flex-col gap-2 pl-9">
                    {PACKAGES.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setChatStep("minutes_confirmed");
                        }}
                        className="inline-flex max-w-[80%] flex-col items-start self-start rounded-2xl rounded-tl-sm border border-border/60 bg-background/95 px-3 py-2 text-left text-sm shadow-sm transition hover:border-primary/70 hover:shadow-[var(--shadow-soft)]"
                      >
                        <span className="font-medium">{pkg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          Aproximadamente {pkg.minutes} minutos
                        </span>
                        <span className="mt-1 text-sm font-semibold text-primary">
                          R$ {pkg.price.toFixed(2).replace(".", ",")}
                        </span>
                      </button>
                    ))}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Valores de exemplo para testes — depois ajustamos os preços reais.
                    </p>
                  </div>
                )}

                {/* Resposta do cliente com o pacote escolhido */}
                {selectedPackage && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[hsl(var(--call-accent-strong))] px-3 py-2 text-sm text-primary-foreground shadow-sm">
                      {selectedPackage.label}
                    </div>
                  </div>
                )}

                {/* Pergunta de contato (só depois da "digitação") */}
                {(chatStep === "contact" || chatStep === "contact_confirmed" || chatStep === "summary_typing" || chatStep === "summary" || chatStep === "finished") &&
                  selectedPackage && (
                    <div className="mt-2 flex gap-2">
                      <div className="mt-5 h-7 w-7 rounded-full bg-primary/25" />
                      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-background/90 px-3 py-2 text-sm shadow-sm">
                        <p>
                          Perfeito, uma chamada de {selectedPackage.minutes} minutos. Onde você prefere receber o link
                          da sala?
                        </p>
                      </div>
                    </div>
                  )}

                {chatStep === "contact" && selectedPackage && (
                  <>
                    <div className="flex flex-wrap gap-2 pl-9 pt-1">
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
                      <div className="mt-3 flex justify-end">
                        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[hsl(var(--call-accent-strong))] px-3 py-2 text-sm text-primary-foreground shadow-sm">
                          <div className="space-y-1 text-xs">
                            <p className="font-semibold">
                              {contactChannel === "email" ? "Digite seu e-mail" : "Digite seu número com DDD"}
                            </p>
                            <Input
                              value={contactValue}
                              onChange={(e) => setContactValue(e.target.value)}
                              placeholder={
                                contactChannel === "email" ? "seuemail@exemplo.com" : "(11) 99999-9999"
                              }
                              className="border-none bg-background/90 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Resumo antes de gerar o link */}
                {(chatStep === "summary" || chatStep === "summary_typing") && selectedPackage && (
                  <>
                    <div className="flex gap-2">
                      <div className="mt-5 h-7 w-7 rounded-full bg-primary/25" />
                      <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-background/90 px-3 py-2 text-sm shadow-sm">
                        <p>Ótimo, revise rapidinho antes de continuar:</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Pacote: <span className="font-medium text-foreground">{selectedPackage.label}</span> —
                          <span className="font-semibold text-primary">
                            {" "}
                            R$ {selectedPackage.price.toFixed(2).replace(".", ",")}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Contato: <span className="capitalize text-foreground">{contactChannel}</span> • {contactValue}
                        </p>
                        <p className="mt-2 text-[11px]">
                          Nesta primeira versão o pagamento ainda não está integrado. O próximo passo vai gerar uma
                          chamada de teste com a minutagem escolhida.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Mensagem final após gerar link */}
                {chatStep === "finished" && (
                  <div className="flex gap-2">
                    <div className="mt-5 h-7 w-7 rounded-full bg-primary/25" />
                    <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-background/90 px-3 py-2 text-sm shadow-sm">
                      <p>
                        Prontinho! Abrimos sua sala de chamada em outra aba. Assim que o gateway brasileiro estiver
                        conectado, aqui será o ponto em que o pagamento é aprovado e a chamada é liberada.
                      </p>
                    </div>
                  </div>
                )}

                {/* Indicador de digitando */}
                {isTyping && (
                  <div className="flex gap-2">
                    <div className="mt-5 h-7 w-7 rounded-full bg-primary/25" />
                    <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm bg-background/80 px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
                      <span>digitando</span>
                      <span className="inline-flex gap-0.5">
                        <span>·</span>
                        <span>·</span>
                        <span>·</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações no rodapé do chat */}
              <footer className="flex items-center justify-between gap-3 border-t border-border/60 bg-[hsl(var(--call-surface))] px-4 py-3 text-xs text-muted-foreground">
                <div className="flex flex-col">
                  <span>Fluxo de teste da chamada</span>
                  <span>Depois vamos plugar o pagamento e automatizar tudo.</span>
                </div>
                <div className="flex items-center gap-2">
                  {(chatStep === "contact" || chatStep === "summary" || chatStep === "summary_typing") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (chatStep === "summary" || chatStep === "summary_typing") {
                          setChatStep("contact");
                        } else {
                          setChatStep("minutes");
                          setSelectedPackage(null);
                          setContactChannel(null);
                          setContactValue("");
                        }
                      }}
                    >
                      Voltar
                    </Button>
                  )}
                  {chatStep === "contact" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="call-primary"
                      disabled={!contactChannel || !contactValue.trim()}
                      onClick={() => setChatStep("contact_confirmed")}
                    >
                      Continuar
                    </Button>
                  )}
                  {chatStep === "summary" && selectedPackage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="call-primary"
                      onClick={() => {
                        const seconds = selectedPackage.minutes * 60;
                        const url = `${window.location.origin}/?seconds=${seconds}`;
                        window.open(url, "_blank");
                        setChatStep("finished");
                        toast({
                          title: "Sala de chamada aberta",
                          description:
                            "Abrimos a sala de chamada em uma nova aba com a duração escolhida. Depois conectamos o pagamento aqui.",
                        });
                      }}
                    >
                      Gerar chamada de teste
                    </Button>
                  )}
                  {chatStep === "finished" && (
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
                      Criar outra chamada
                    </Button>
                  )}
                </div>
              </footer>
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
