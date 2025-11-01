// services/logger.ts
export interface LogEntry {
  timestamp: Date;
  source: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  details?: any;
}

class Logger {
  private history: LogEntry[] = [];
  private subscribers: ((logs: LogEntry[]) => void)[] = [];

  log(source: string, level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date(),
      source,
      level,
      message,
      details,
    };
    this.history.push(entry);
    if (level === 'ERROR' || level === 'WARN') {
        console[level.toLowerCase()](`[${source}] ${message}`, details);
    } else {
        console.log(`[${source}] ${message}`, details);
    }
    this.notifySubscribers();
  }

  getHistory(): LogEntry[] {
    return [...this.history];
  }

  subscribe(callback: (logs: LogEntry[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notifySubscribers() {
    for (const subscriber of this.subscribers) {
      subscriber(this.getHistory());
    }
  }

  clear() {
    this.history = [];
    this.notifySubscribers();
  }
}

export const logger = new Logger();
