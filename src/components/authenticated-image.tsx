import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type AuthenticatedImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export function AuthenticatedImage({ src, alt, className, loading }: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(src.startsWith("blob:") ? src : null);

  useEffect(() => {
    if (src.startsWith("blob:")) {
      setObjectUrl(src);
      return;
    }

    const controller = new AbortController();
    let createdUrl: string | null = null;

    void fetch(src, { credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Falha ao carregar imagem (${response.status}).`);
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setObjectUrl(null);
      });

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [src]);

  return objectUrl
    ? <img src={objectUrl} alt={alt} className={className} loading={loading} />
    : <div className={cn(className, "bg-muted")} role="img" aria-label={alt || "Imagem indisponível"} />;
}
