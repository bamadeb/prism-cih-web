import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HeaderService {
  private titleSource = new BehaviorSubject<string>('Dashboard');
  title$ = this.titleSource.asObservable();

  setTitle(title: string) {
    this.titleSource.next(title);
    console.log('title :: ',title);
  }
}
