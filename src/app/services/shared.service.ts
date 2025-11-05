import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedService {

  constructor() { }
  private eventSubject = new Subject<any>();

  sendEvent(data: any) {
    this.eventSubject.next(data);
  }

  getEvent() {
    return this.eventSubject.asObservable();
  }
}

/*//uses//
///Send an event 
export class ComponentA {
  constructor(private sharedService: SharedService) {}

  sendData() {
    this.sharedService.sendEvent({ message: 'Hello from A!' });
  }
}

//Receive the event **ngOnDestroy() important Clean up to avoid memory leaks
export class ComponentB implements OnInit, OnDestroy {
  receivedData: any;
  private subscription!: Subscription;

  constructor(private sharedService: SharedService) {}

  ngOnInit() {
    this.subscription = this.sharedService.getEvent().subscribe(data => {
      this.receivedData = data;
      console.log('Component B received:', data);
    });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe(); // Clean up to avoid memory leaks
  }
}
*/
