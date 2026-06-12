import { useState, useEffect, useRef } from "react";
import { useStartDownload, useGetDownloadJob, getGetDownloadJobQueryKey } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Music, Youtube, Loader2, DownloadCloud, AlertCircle, CheckCircle2 } from "lucide-react";

type DownloadSource = "spotify" | "youtube";

export default function Home() {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<DownloadSource | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const startDownload = useStartDownload();

  // Polling logic
  const isPolling = jobId && startDownload.isSuccess;
  const { data: job } = useGetDownloadJob(jobId || "", {
    query: {
      enabled: !!jobId,
      queryKey: getGetDownloadJobQueryKey(jobId || ""),
      refetchInterval: (query) => {
        const state = query.state?.data?.status;
        if (state === "done" || state === "error") return false;
        return 2000;
      },
    },
  });

  // Auto-detect source
  useEffect(() => {
    if (url.includes("spotify.com")) {
      setSource("spotify");
    } else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      setSource("youtube");
    } else if (!url) {
      setSource(null);
    }
  }, [url]);

  // Handle completion
  const handledDone = useRef(false);
  useEffect(() => {
    if (job?.status === "done" && !handledDone.current) {
      handledDone.current = true;
      toast({
        title: "Download pronto!",
        description: "Seu arquivo está sendo baixado.",
      });
      // Trigger file download
      window.location.href = `/api/download/${jobId}/file`;
    } else if (job?.status === "error" && !handledDone.current) {
      handledDone.current = true;
      toast({
        title: "Falha no download",
        description: job.errorMessage || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    }
  }, [job, jobId, toast]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    
    // Fallback if auto-detect missed it
    const finalSource: DownloadSource = source || (url.includes("spotify") ? "spotify" : "youtube");
    
    if (!finalSource) {
      toast({
        title: "Link inválido",
        description: "Por favor, cole um link válido do Spotify ou YouTube.",
        variant: "destructive",
      });
      return;
    }

    handledDone.current = false;
    setJobId(null);
    
    startDownload.mutate(
      { data: { url, source: finalSource } },
      {
        onSuccess: (data) => {
          setJobId(data.jobId);
        },
        onError: (error) => {
          toast({
            title: "Erro ao iniciar download",
            description: error.error || "Não foi possível conectar ao servidor.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const isWorking = startDownload.isPending || (job && (job.status === "pending" || job.status === "processing"));

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50 blur-3xl pointer-events-none" />
      
      <div className="z-10 w-full max-w-xl mx-auto space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-secondary/50 border border-border shadow-2xl mb-4">
            <Music className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-foreground">
            Piratão <span className="text-primary">do MP3</span>
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Cole o link, baixe o MP3. Simples assim.
          </p>
        </div>

        <Card className="p-2 border-border bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden rounded-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Input
                data-testid="input-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Cole o link do Spotify ou YouTube..."
                className="h-14 bg-transparent border-0 focus-visible:ring-0 text-base placeholder:text-muted-foreground/50 px-4"
                disabled={isWorking}
              />
              {source && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md border border-border">
                  {source === "spotify" ? <Music className="w-4 h-4 text-green-500" /> : <Youtube className="w-4 h-4 text-red-500" />}
                  {source}
                </div>
              )}
            </div>
            <Button 
              data-testid="button-submit"
              type="submit" 
              disabled={isWorking || !url}
              className="h-14 px-8 rounded-xl font-bold tracking-wide transition-all shadow-lg hover:shadow-primary/25 disabled:opacity-50"
            >
              {isWorking ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  PROCESSANDO
                </>
              ) : (
                <>
                  <DownloadCloud className="w-5 h-5 mr-2" />
                  BAIXAR
                </>
              )}
            </Button>
          </form>
        </Card>

        {jobId && job && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-6 bg-secondary/30 border-border/50 backdrop-blur-sm rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                {job.status === "pending" || job.status === "processing" ? (
                  <div className="relative">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
                  </div>
                ) : job.status === "done" ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-destructive" />
                )}
                
                <div>
                  <h3 className="font-semibold text-sm tracking-wide text-foreground uppercase">
                    {job.status === "processing" ? "Extraindo áudio..." : 
                     job.status === "pending" ? "Iniciando..." : 
                     job.status === "done" ? "Pronto" : "Erro"}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate max-w-[250px] md:max-w-md mt-1">
                    {job.errorMessage || job.url}
                  </p>
                </div>
              </div>
              
              {job.status === "done" && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = `/api/download/${job.jobId}/file`}
                  className="rounded-full font-medium"
                >
                  Baixar novamente
                </Button>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
