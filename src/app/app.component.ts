import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PolicyStudioI18n } from './core/i18n';
import { RuntimeConfigService } from './core/runtime-config.service';

@Component({
  selector: 'pax-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  readonly runtime = inject(RuntimeConfigService);
  readonly i18n = inject(PolicyStudioI18n);

  ngOnInit(): void { void this.runtime.load(); }
}
