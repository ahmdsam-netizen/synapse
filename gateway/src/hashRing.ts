import crypto from 'crypto';

export interface ConsistentHashRingOptions {
  virtualNodes?: number;
}

export class ConsistentHashRing {
  private readonly virtualNodes: number;
  private readonly ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private readonly nodes: Set<string> = new Set();

  constructor(nodes: string[] = [], options: ConsistentHashRingOptions = {}) {
    this.virtualNodes = options.virtualNodes || 100;
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  private hash(key: string): number {
    const hash = crypto.createHash('md5').update(key).digest();
    // Read 32-bit unsigned integer from the first 4 bytes of MD5
    return hash.readUInt32BE(0);
  }

  public addNode(node: string): void {
    if (this.nodes.has(node)) return;
    this.nodes.add(node);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNodeKey = `${node}#${i}`;
      const hash = this.hash(virtualNodeKey);
      this.ring.set(hash, node);
      this.sortedKeys.push(hash);
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  public removeNode(node: string): void {
    if (!this.nodes.has(node)) return;
    this.nodes.delete(node);

    for (let i = 0; i < this.virtualNodes; i++) {
      const virtualNodeKey = `${node}#${i}`;
      const hash = this.hash(virtualNodeKey);
      this.ring.delete(hash);
    }

    this.sortedKeys = this.sortedKeys.filter((k) => this.ring.has(k));
  }

  public getNode(key: string): string | null {
    if (this.sortedKeys.length === 0) return null;

    const hash = this.hash(key);

    // Binary search for first sorted key >= hash
    let low = 0;
    let high = this.sortedKeys.length - 1;
    let foundIndex = 0;

    if (hash > this.sortedKeys[high]) {
      // Wrap around to first key on ring
      foundIndex = 0;
    } else {
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (this.sortedKeys[mid] >= hash) {
          foundIndex = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }
    }

    const ringKey = this.sortedKeys[foundIndex];
    return this.ring.get(ringKey) || null;
  }

  public getNodes(): string[] {
    return Array.from(this.nodes);
  }
}
