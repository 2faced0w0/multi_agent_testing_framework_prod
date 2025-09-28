class MetricsRegistry {
  private counters: Record<string, number> = {};
  inc(name: string, value = 1) {
    this.counters[name] = (this.counters[name] || 0) + value;
  }
  toText(): string {
    const lines: string[] = [];
    // Include a basic self metric so output is never empty
    if (!this.counters['app_info']) {
      this.counters['app_info'] = 1;
    }
    lines.push('# HELP app_info Static metric to confirm exporter is working');
    lines.push('# TYPE app_info counter');
    lines.push(`app_info ${this.counters['app_info']}`);
    for (const [k, v] of Object.entries(this.counters)) {
      if (k === 'app_info') continue;
      lines.push(`# TYPE ${k} counter`);
      lines.push(`${k} ${v}`);
    }
    return lines.join('\n');
  }
}

export const metrics = new MetricsRegistry();
