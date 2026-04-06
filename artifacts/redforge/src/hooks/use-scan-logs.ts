import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface ScanLogEntry {
  level: string;
  message: string;
  createdAt: string;
}

export interface LiveScanStatus {
  status: string;
  findingsCount: number;
  criticalCount: number;
  riskScore?: number | null;
}

export function useScanLogs(scanId: string | undefined, status: string | undefined) {
  const [logs, setLogs] = useState<ScanLogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [scanDone, setScanDone] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveScanStatus | null>(null);
  const queryClient = useQueryClient();
  const seenIds = useRef(new Set<string>());
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedRef = useRef(false);

  useEffect(() => {
    if (!scanId || status === "COMPLETED" || status === "FAILED") {
      setConnected(false);
      return;
    }

    seenIds.current.clear();
    closedRef.current = false;
    setLogs([]);
    setScanDone(false);
    setLiveStatus(null);

    let es: EventSource | null = null;

    const connect = () => {
      if (closedRef.current) return;
      es = new EventSource(`/api/scans/${scanId}/logs`, { withCredentials: true });

      es.onopen = () => setConnected(true);

      es.onmessage = (e) => {
        try {
          const data: ScanLogEntry & { id?: string } = JSON.parse(e.data);
          const key = data.id || data.message + data.createdAt;
          if (!seenIds.current.has(key)) {
            seenIds.current.add(key);
            setLogs((prev) => [...prev, data]);
          }
        } catch {
          // ignore parse errors
        }
      };

      es.addEventListener("status", (e: MessageEvent) => {
        try {
          const data: LiveScanStatus = JSON.parse(e.data);
          setLiveStatus(data);
        } catch {
          // ignore
        }
      });

      es.addEventListener("done", () => {
        setConnected(false);
        setScanDone(true);
        closedRef.current = true;
        es?.close();
        queryClient.invalidateQueries({ queryKey: [`/api/scans/${scanId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      });

      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!closedRef.current) {
          retryRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    const findingsPoll = setInterval(() => {
      if (!closedRef.current) {
        queryClient.invalidateQueries({ queryKey: [`/api/scans/${scanId}`] });
      }
    }, 8000);

    return () => {
      closedRef.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      clearInterval(findingsPoll);
      es?.close();
      setConnected(false);
    };
  }, [scanId, status, queryClient]);

  return { logs, connected, scanDone, liveStatus };
}
