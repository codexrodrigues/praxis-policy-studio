import { Injectable, signal } from '@angular/core';
import type { StudioNavItem } from './studio-navigation';

@Injectable({ providedIn: 'root' })
export class StudioCapabilitiesService {
  private readonly capabilitiesSignal = signal<ReadonlySet<string> | null>(null);
  readonly serverCapabilities = this.capabilitiesSignal.asReadonly();

  applyServerCapabilities(capabilities: readonly string[] | null | undefined): void {
    if (!capabilities) {
      this.capabilitiesSignal.set(null);
      return;
    }
    const normalized = new Set(
      capabilities
        .filter((entry): entry is string => typeof entry === 'string')
        .map(entry => entry.trim())
        .filter(Boolean)
    );
    this.capabilitiesSignal.set(normalized);
  }

  reset(): void {
    this.capabilitiesSignal.set(null);
  }

  isModuleVisible(item: Pick<StudioNavItem, 'requiredCapability'>): boolean {
    const required = item.requiredCapability?.trim();
    if (!required) {
      return true;
    }
    const serverSet = this.capabilitiesSignal();
    return serverSet !== null && serverSet.has(required);
  }
}
