import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ClaimT, FlagT, GraphNode, GroundT, MoneyT, Risk, Signal, Subscores } from "./api";

/** A graph node as rendered: the server node plus mutable layout and animation fields. */
export interface VizNode extends GraphNode {
  x?: number;
  y?: number;
  addedAt: number;
  pulseAt?: number;
  degree: number;
}
export interface VizLink {
  source: string | VizNode;
  target: string | VizNode;
  type: string;
}

export interface LogLine {
  id: string;
  step: string;
  kind: "query" | "note";
  adapter?: string;
  source?: string;
  label?: string;
  query?: Record<string, unknown>;
  mode?: string;
  status: "running" | "ok" | "empty" | "failed" | "skipped" | "note";
  records?: number;
  latency?: number;
  summary?: string;
  error?: string;
  evidence_id?: string;
  icon?: string | null;
  level?: string;
  text?: string;
}

export interface StepState {
  id: string;
  en: string;
  ja: string;
  status: "pending" | "active" | "done" | "skipped";
  summary?: string;
}

export interface ScoreState {
  overall: number | null;
  band: string | null;
  band_ja?: string;
  band_en?: string;
  subscores: Subscores;
  final: boolean;
  fit?: any;
}

export interface TheaterState {
  started: boolean;
  demo: boolean;
  mode: string;
  steps: StepState[];
  log: LogLine[];
  flags: FlagT[];
  claims: ClaimT[];
  score: ScoreState;
  outlook: Signal[];
  ground: GroundT | null;
  money: MoneyT | null;
  narrative: { summary_en: string; summary_ja: string; method: string } | null;
  communities: number;
  done: boolean;
  failed: boolean;
  error: string | null;
  durationMs: number | null;
  reassess: string | null;
}

const initial: TheaterState = {
  started: false,
  demo: false,
  mode: "seed",
  steps: [],
  log: [],
  flags: [],
  claims: [],
  score: { overall: null, band: null, subscores: {}, final: false },
  outlook: [],
  ground: null,
  money: null,
  narrative: null,
  communities: 0,
  done: false,
  failed: false,
  error: null,
  durationMs: null,
  reassess: null,
};

type Ev = Record<string, any> & { type: string; seq: number };

function reduce(state: TheaterState, ev: Ev): TheaterState {
  switch (ev.type) {
    case "reset":
      return initial;
    case "investigation.started":
      return {
        ...state,
        started: true,
        demo: ev.demo,
        mode: ev.mode,
        steps: ev.steps.map((s: any) => ({ ...s, status: "pending" })),
      };
    case "reassess.started":
      return { ...state, reassess: ev.reason, done: false };
    case "step.started":
      return {
        ...state,
        steps: state.steps.map((s) => (s.id === ev.step ? { ...s, status: "active" } : s)),
        log: [...state.log, { id: `h${ev.seq}`, step: ev.step, kind: "note", status: "note", level: "header", text: ev.step }],
      };
    case "step.finished":
      return {
        ...state,
        steps: state.steps.map((s) =>
          s.id === ev.step ? { ...s, status: ev.skipped ? "skipped" : "done", summary: ev.summary } : s,
        ),
      };
    case "query.started":
      return {
        ...state,
        log: [
          ...state.log,
          {
            id: ev.qid + ":" + ev.seq,
            step: ev.step,
            kind: "query",
            adapter: ev.adapter,
            source: ev.source,
            label: ev.label,
            query: ev.query,
            mode: ev.mode,
            status: "running",
            icon: ev.icon,
          },
        ],
      };
    case "query.finished": {
      const idx = [...state.log].reverse().findIndex((l) => l.id.startsWith(ev.qid + ":") && l.status === "running");
      if (idx === -1) return state;
      const i = state.log.length - 1 - idx;
      const log = state.log.slice();
      log[i] = {
        ...log[i],
        status: ev.status,
        records: ev.records,
        latency: ev.latency_ms,
        summary: ev.summary,
        error: ev.error,
        evidence_id: ev.evidence_id,
        mode: ev.mode,
      };
      return { ...state, log };
    }
    case "log.note":
      return {
        ...state,
        log: [...state.log, { id: `n${ev.seq}`, step: ev.step, kind: "note", status: "note", text: ev.text, level: ev.level, icon: ev.icon }],
      };
    case "flag.raised":
      return { ...state, flags: [...state.flags, ev.flag] };
    case "claim.checked": {
      const key = ev.claim.node ?? ev.claim.text;
      const rest = state.claims.filter((c) => (c.node ?? c.text) !== key);
      const pos = state.claims.findIndex((c) => (c.node ?? c.text) === key);
      const claims = pos === -1 ? [...rest, ev.claim] : [...rest.slice(0, pos), ev.claim, ...rest.slice(pos)];
      return { ...state, claims };
    }
    case "score.updated":
      return {
        ...state,
        score: {
          overall: ev.overall,
          band: ev.band,
          band_ja: ev.band_ja ?? state.score.band_ja,
          band_en: ev.band_en ?? state.score.band_en,
          subscores: ev.subscores,
          final: ev.final,
          fit: ev.fit ?? state.score.fit,
        },
      };
    case "outlook":
      return { ...state, outlook: ev.signals };
    case "ground.ready":
      return { ...state, ground: ev.ground };
    case "money.received":
      return { ...state, money: ev.money };
    case "narrative.ready":
      return { ...state, narrative: { summary_en: ev.summary_en, summary_ja: ev.summary_ja, method: ev.method } };
    case "graph.communities":
      return { ...state, communities: ev.count };
    case "error":
      return { ...state, error: ev.message, failed: true };
    case "done":
      return { ...state, done: true, failed: !!ev.failed || state.failed, durationMs: ev.duration_ms ?? state.durationMs, reassess: null };
    default:
      return state;
  }
}

/** Subscribes to an investigation's SSE stream (live, or a paced replay of the stored trace). */
export function useInvestigationStream(id: number, opts: { replay?: boolean; speed?: number } = {}) {
  const [state, dispatch] = useReducer(reduce, initial);
  const nodes = useRef(new Map<string, VizNode>());
  const links = useRef<VizLink[]>([]);
  const linkKeys = useRef(new Set<string>());
  const [graphVersion, setGraphVersion] = useState(0);
  const [runKey, setRunKey] = useState(0);
  const [replaying, setReplaying] = useState(!!opts.replay);
  const [connected, setConnected] = useState(false);

  const applyGraph = useCallback((ev: Ev) => {
    const now = performance.now();
    if (ev.type === "node.added") {
      const n = ev.node as GraphNode;
      if (!nodes.current.has(n.id)) nodes.current.set(n.id, { ...n, addedAt: now, degree: 0 });
    } else if (ev.type === "node.updated") {
      const n = nodes.current.get(ev.node.id);
      if (n) {
        if (ev.node.risk) n.risk = ev.node.risk as Risk;
        if (ev.node.attrs) n.attrs = { ...n.attrs, ...ev.node.attrs };
        if (ev.node.community !== undefined) n.community = ev.node.community;
        if (ev.pulse) n.pulseAt = now;
      }
    } else if (ev.type === "edge.added") {
      const e = ev.edge;
      const key = `${e.src}|${e.dst}|${e.type}`;
      if (!linkKeys.current.has(key) && nodes.current.has(e.src) && nodes.current.has(e.dst)) {
        linkKeys.current.add(key);
        links.current.push({ source: e.src, target: e.dst, type: e.type });
        nodes.current.get(e.src)!.degree += 1;
        nodes.current.get(e.dst)!.degree += 1;
      }
    } else if (ev.type === "graph.communities") {
      for (const [nid, c] of Object.entries(ev.mapping as Record<string, number>)) {
        const n = nodes.current.get(nid);
        if (n) n.community = c;
      }
    } else {
      return;
    }
    setGraphVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!id) return;
    dispatch({ type: "reset", seq: 0 });
    nodes.current = new Map();
    links.current = [];
    linkKeys.current = new Set();
    setGraphVersion((v) => v + 1);
    const params = replaying ? `?replay=1&speed=${opts.speed ?? 1}` : "";
    const es = new EventSource(`/api/investigations/${id}/stream${params}`);
    es.onopen = () => setConnected(true);
    es.onmessage = (msg) => {
      const ev = JSON.parse(msg.data) as Ev;
      applyGraph(ev);
      dispatch(ev);
    };
    es.addEventListener("end", () => {
      es.close();
      setConnected(false);
    });
    es.onerror = () => {
      es.close();
      setConnected(false);
    };
    return () => es.close();
  }, [id, runKey, replaying, applyGraph, opts.speed]);

  const replay = useCallback(() => {
    setReplaying(true);
    setRunKey((k) => k + 1);
  }, []);

  return {
    state,
    graph: { nodes: nodes.current, links: links.current, version: graphVersion },
    replay,
    replaying,
    connected,
  };
}
