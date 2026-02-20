import { GraphCollection } from "@/lib/runtime/architecture";
import { NodeData } from "@/lib/schema/node";

type RuntimeLayer = 0 | 1 | 2 | 3;

type RuntimeNode = {
  id: string;
  data: NodeData;
};

type RuntimeEdge = {
  source: string;
  target: string;
};

export type RuntimeExecutionNode = {
  id: string;
  kind: NodeData["kind"];
  label: string;
};

type RuntimeStartOptions = {
  onOrder?: (
    node: RuntimeExecutionNode,
    index: number,
    total: number,
  ) => void;
  onExecute?: (
    node: RuntimeExecutionNode,
    index: number,
    total: number,
  ) => void;
};

const getRuntimeLayer = (node: NodeData): RuntimeLayer | null => {
  switch (node.kind) {
    case "api_binding":
      return 0;
    case "process":
      return 1;
    case "database":
      return 2;
    case "infra":
    case "queue":
      return 3;
    default:
      return null;
  }
};

const compareNodeIds = (a: RuntimeNode, b: RuntimeNode): number => {
  const layerA = getRuntimeLayer(a.data) ?? Number.MAX_SAFE_INTEGER;
  const layerB = getRuntimeLayer(b.data) ?? Number.MAX_SAFE_INTEGER;
  if (layerA !== layerB) return layerA - layerB;
  return a.id.localeCompare(b.id);
};

export class RuntimeEngine {
  private readonly graphs: GraphCollection;

  constructor(graphs: GraphCollection) {
    this.graphs = graphs;
  }

  public start(options?: RuntimeStartOptions): RuntimeExecutionNode[] {
    const { nodes, edges } = this.collectGraphData();
    const sortedNodes = this.topologicalSort(nodes, edges);
    const executionOrder = sortedNodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      label: node.data.label || node.id,
    }));

    console.log("[RuntimeEngine] Execution order:");
    for (const [index, node] of executionOrder.entries()) {
      console.log(`- ${node.kind}:${node.id}`);
      options?.onOrder?.(node, index, executionOrder.length);
    }

    for (const [index, node] of executionOrder.entries()) {
      console.log(`[RuntimeEngine] Executing ${node.kind}:${node.id}`);
      options?.onExecute?.(node, index, executionOrder.length);
    }

    return executionOrder;
  }

  private collectGraphData(): { nodes: RuntimeNode[]; edges: RuntimeEdge[] } {
    const nodeById = new Map<string, RuntimeNode>();
    const edges: RuntimeEdge[] = [];

    for (const graph of Object.values(this.graphs)) {
      for (const node of graph?.nodes ?? []) {
        if (getRuntimeLayer(node.data) === null) continue;
        if (!nodeById.has(node.id)) {
          nodeById.set(node.id, { id: node.id, data: node.data });
        }
      }

      for (const edge of graph?.edges ?? []) {
        edges.push({ source: edge.source, target: edge.target });
      }
    }

    // Enforce architecture-layer dependency direction:
    // API -> Process -> Data -> Infra.
    const layerBuckets: Record<RuntimeLayer, string[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
    };

    for (const node of nodeById.values()) {
      const layer = getRuntimeLayer(node.data);
      if (layer !== null) {
        layerBuckets[layer].push(node.id);
      }
    }

    for (let layer = 0 as RuntimeLayer; layer < 3; layer = (layer + 1) as RuntimeLayer) {
      const nextLayer = (layer + 1) as RuntimeLayer;
      for (const source of layerBuckets[layer]) {
        for (const target of layerBuckets[nextLayer]) {
          edges.push({ source, target });
        }
      }
    }

    return { nodes: [...nodeById.values()], edges };
  }

  private topologicalSort(nodes: RuntimeNode[], edges: RuntimeEdge[]): RuntimeNode[] {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const adjacency = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.id, new Set<string>());
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
      if (edge.source === edge.target) continue;

      const neighbors = adjacency.get(edge.source);
      if (!neighbors || neighbors.has(edge.target)) continue;

      neighbors.add(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }

    const ready: RuntimeNode[] = nodes
      .filter((node) => (inDegree.get(node.id) ?? 0) === 0)
      .sort(compareNodeIds);

    const ordered: RuntimeNode[] = [];

    while (ready.length > 0) {
      const current = ready.shift();
      if (!current) break;

      ordered.push(current);
      const neighbors = adjacency.get(current.id);
      if (!neighbors) continue;

      for (const neighborId of neighbors) {
        const nextDegree = (inDegree.get(neighborId) ?? 0) - 1;
        inDegree.set(neighborId, nextDegree);
        if (nextDegree === 0) {
          const neighbor = nodeById.get(neighborId);
          if (neighbor) ready.push(neighbor);
        }
      }

      ready.sort(compareNodeIds);
    }

    if (ordered.length !== nodes.length) {
      const unresolved = nodes
        .filter((node) => !ordered.some((visited) => visited.id === node.id))
        .sort(compareNodeIds);
      console.warn(
        "[RuntimeEngine] Cycle or unresolved dependencies detected. Appending remaining nodes.",
      );
      ordered.push(...unresolved);
    }

    return ordered;
  }
}
