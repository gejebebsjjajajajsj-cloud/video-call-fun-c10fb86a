import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Video, PhoneOff, Mic, MicOff, Camera, CameraOff } from "lucide-react";
import remoteVideoSrc from "@/assets/fake-call-remote.mp4";
import { supabase } from "@/integrations/supabase/client";

interface MediaState {
  micOn: boolean;
  camOn: boolean;
}

const CALL_DURATION_LIMIT_MINUTES = 30;

const Index = () => {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mediaState, setMediaState] = useState<MediaState>({ micOn: true, camOn: true });
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [configVideoUrl, setConfigVideoUrl] = useState<string | null>(null);
  const [configAudioUrl, setConfigAudioUrl] = useState<string | null>(null);
  const [durationLimitSeconds, setDurationLimitSeconds] = useState<number | null>(null);

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
      }
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
    // Inicia a chamada automaticamente ao carregar a página
    startCall();
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
      <main className="fixed inset-0 flex items-center justify-center overflow-hidden">
        {inCall ? (
          <>
            {/* Vídeo remoto ocupando a tela inteira (respeita vídeo em pé) */}
            <video
              ref={remoteVideoRef}
              className="absolute inset-0 h-full w-full object-cover bg-black"
              src={configVideoUrl || remoteVideoSrc}
              autoPlay
              loop
              muted
              playsInline
            />

            {/* Áudio da modelo tocando junto com o vídeo */}
            {configAudioUrl && <audio ref={remoteAudioRef} src={configAudioUrl} loop />}

            {/* Webcam do cliente no topo direito */}
            <div className="pointer-events-none absolute right-3 top-3 z-20 h-32 w-24 overflow-hidden rounded-2xl border border-[hsl(var(--call-surface-soft))] bg-[hsl(var(--call-surface-soft))] shadow-[0_10px_28px_hsl(210_80%_2%/0.85)] sm:right-5 sm:top-5 sm:h-40 sm:w-32">
              <video
                ref={selfVideoRef}
                className="h-full w-full object-cover"
                autoPlay
                playsInline
                muted
              />
            </div>

            {/* Gradiente inferior para destacar controles */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(var(--call-surface)/0.96)] via-[hsl(var(--call-surface)/0.7)] to-transparent" />

            {/* Controles de chamada */}
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
        ) : null}
      </main>
    </div>
  );
};

export default Index;
