import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { IdleTimeoutService } from './services/idle-timeout';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('prism-cih-web');
  constructor(private idleService: IdleTimeoutService) {}

  ngOnInit(): void {

    // Check session when app loads
    this.idleService.checkSession();

    // Start idle monitoring
    this.idleService.startWatching();

  }
}
