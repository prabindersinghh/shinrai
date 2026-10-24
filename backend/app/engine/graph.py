"""Entity graph built during an investigation, plus networkx analytics."""
from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

import networkx as nx

RISK_ORDER = {"none": 0, "low": 1, "med": 2, "high": 3, "critical": 4}


def short_hash(text: str) -> str:
    return hashlib.sha1(text.lower().encode()).hexdigest()[:8]


def company_id(cin: str) -> str:
    return f"c_{cin}"


def person_id(din: str | None, name: str) -> str:
    return f"p_{din}" if din else f"p_{short_hash(name)}"


def address_id(address: str) -> str:
    return f"a_{short_hash(' '.join(address.lower().replace(',', ' ').split()))}"


@dataclass
class GraphState:
    nodes: dict[str, dict] = field(default_factory=dict)
    edges: dict[tuple[str, str, str], dict] = field(default_factory=dict)

    def add_node(self, node_id: str, type_: str, label: str, key: str = "", risk: str = "none",
                 **attrs) -> tuple[dict, bool]:
        if node_id in self.nodes:
            node = self.nodes[node_id]
            node["attrs"].update({k: v for k, v in attrs.items() if v is not None})
            return node, False
        node = {"id": node_id, "type": type_, "label": label, "key": key, "risk": risk, "community": None,
                "attrs": {k: v for k, v in attrs.items() if v is not None}}
        self.nodes[node_id] = node
        return node, True

    def add_edge(self, src: str, dst: str, type_: str, **attrs) -> tuple[dict, bool]:
        key = (src, dst, type_)
        if key in self.edges:
            return self.edges[key], False
        edge = {"src": src, "dst": dst, "type": type_, "attrs": attrs}
        self.edges[key] = edge
        return edge, True

    def raise_risk(self, node_id: str, risk: str) -> bool:
        node = self.nodes.get(node_id)
        if node is None or RISK_ORDER[risk] <= RISK_ORDER[node["risk"]]:
            return False
        node["risk"] = risk
        return True

    def nx(self) -> nx.Graph:
        g = nx.Graph()
        g.add_nodes_from(self.nodes)
        g.add_edges_from((e["src"], e["dst"]) for e in self.edges.values())
        return g

    def communities(self) -> dict[str, int]:
        g = self.nx()
        if g.number_of_edges() == 0:
            return {n: 0 for n in g.nodes}
        groups = nx.community.louvain_communities(g, seed=7, resolution=1.0)
        ordered = sorted(groups, key=lambda c: (-len(c), sorted(c)[0]))
        mapping = {n: i for i, group in enumerate(ordered) for n in group}
        for n, c in mapping.items():
            self.nodes[n]["community"] = c
        return mapping

    def neighbors(self, node_id: str, edge_type: str | None = None) -> list[str]:
        out = []
        for e in self.edges.values():
            if edge_type and e["type"] != edge_type:
                continue
            if e["src"] == node_id:
                out.append(e["dst"])
            elif e["dst"] == node_id:
                out.append(e["src"])
        return out

    def degree_by_type(self, node_type: str, edge_type: str) -> dict[str, int]:
        return {n: len(self.neighbors(n, edge_type)) for n, v in self.nodes.items() if v["type"] == node_type}

    def snapshot(self) -> dict:
        return {"nodes": list(self.nodes.values()), "edges": list(self.edges.values())}
