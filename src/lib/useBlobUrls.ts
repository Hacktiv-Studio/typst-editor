import { useEffect, useRef, useState } from "react";

export function useBlobUrls(pages: string[]): string[] {
  const prevSvgs = useRef<string[]>([]);
  const prevUrls = useRef<string[]>([]);
  const stableResult = useRef<string[]>([]);

  const prev = prevSvgs.current;
  const old = prevUrls.current;
  const urls: string[] = [];
  const toRevoke: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    if (i < prev.length && prev[i] === pages[i]) {
      urls.push(old[i]);
    } else {
      if (old[i]) toRevoke.push(old[i]);
      urls.push(
        pages[i]
          ? URL.createObjectURL(new Blob([pages[i]], { type: "image/svg+xml" }))
          : "",
      );
    }
  }
  for (let i = pages.length; i < old.length; i++) {
    toRevoke.push(old[i]);
  }

  prevSvgs.current = pages;
  prevUrls.current = urls;

  const changed =
    urls.length !== stableResult.current.length ||
    urls.some((u, i) => u !== stableResult.current[i]);
  if (changed) stableResult.current = urls;

  if (toRevoke.length > 0) {
    setTimeout(() => toRevoke.forEach(URL.revokeObjectURL), 0);
  }

  useEffect(
    () => () => {
      prevUrls.current.forEach(URL.revokeObjectURL);
      prevUrls.current = [];
      prevSvgs.current = [];
      stableResult.current = [];
    },
    [],
  );

  return stableResult.current;
}

export function useBlobUrl(svg: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!svg) { setUrl(null); return }
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [svg])
  return url
}
