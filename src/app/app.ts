import { Component } from '@angular/core';
import { MatchDashboard } from './components/match-dashboard/match-dashboard';

@Component({
  selector: 'app-root',
  imports: [MatchDashboard],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App { }
