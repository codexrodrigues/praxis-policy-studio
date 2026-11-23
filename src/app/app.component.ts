import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RuntimeConfigService } from './core/runtime-config.service';

@Component({
  selector: 'pax-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  private readonly runtime = inject(RuntimeConfigService);

  ngOnInit(): void {
    void this.runtime.load();
  }
}
