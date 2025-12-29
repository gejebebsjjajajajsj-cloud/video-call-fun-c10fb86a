import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import remoteVideo from "@/assets/fake-call-remote.mp4";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const CallScreen = () => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Erro ao acessar câmera/microfone:", error);
      }
    };

    setupCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleMute = () => {
    if (!streamRef.current) return;
    const audioTracks = streamRef.current.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((prev) => !prev);
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTracks = streamRef.current.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsCameraOff((prev) => !prev);
  };

  const hangUp = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause();
    }
  };

  return (
    <div className="w-screen h-screen bg-background text-foreground overflow-hidden relative">
      <video
        ref={remoteVideoRef}
        className="w-full h-full object-cover"
        src={remoteVideo}
        playsInline
        autoPlay
        loop
        muted
      />
      <video
        ref={localVideoRef}
        className="absolute top-4 right-4 w-24 h-40 rounded-xl border border-border shadow-lg object-cover bg-background/80"
        autoPlay
        muted
        playsInline
      />

      <div className="absolute inset-x-0 bottom-6 flex justify-center">
        <div className="flex items-center gap-4 rounded-full bg-background/60 border border-border/70 px-4 py-2 backdrop-blur-md">
          <button
            onClick={toggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <span className="sr-only">Toggle mute</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {isMuted ? (
                <path
                  d="M9 9v6a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-6 0v1.34M5 10v2a7 7 0 0 0 9.9 6.32M9.34 4.06 4 9.4M20 4 4 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm0 14a5 5 0 0 0 5-5M7 12a5 5 0 0 0 5 5m0 0v4m0 0H9m3 0h3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <button
            onClick={toggleCamera}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            <span className="sr-only">Toggle camera</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              aria-hidden="true"
            >
              {isCameraOff ? (
                <path
                  d="M4 4 20 20M4 7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3.34L20 8v8l-2-1.33V17a2 2 0 0 1-2 2H7.34L4 15.66Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M4 7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3l4-3v8l-4-3v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </button>

          <button
            onClick={hangUp}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            <span className="sr-only">Hang up</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="h-5 w-5 rotate-[-30deg]"
              aria-hidden="true"
            >
              <path
                d="M5 15.5c1.5-1.5 3.5-2.5 7-2.5s5.5 1 7 2.5l-2 3c-1.2-1-2.6-1.5-5-1.5s-3.8.5-5 1.5Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CallScreen />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
